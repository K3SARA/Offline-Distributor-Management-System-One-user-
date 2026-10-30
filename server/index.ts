import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { prisma } from './prisma';

const app = express();
const PORT = process.env.PORT || 4812;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors({ origin: '*' }));
app.use(express.json());

// Request logging in dev
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========================================================
// 1. INVENTORY & STOCK MANAGEMENT
// ========================================================

// List all products (with optional lowStock filter)
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const { lowStock, search } = req.query;
    const where: any = {};

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { category: { contains: search } }
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    if (lowStock === 'true') {
      const filtered = products.filter(p => p.currentStock <= p.minStockAlert);
      return res.json(filtered);
    }

    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create product
app.post('/api/products', async (req: Request, res: Response) => {
  try {
    const { sku, name, category, unit, unitPrice, costPrice, currentStock, minStockAlert } = req.body;

    if (!sku || !name || unitPrice === undefined) {
      return res.status(400).json({ error: 'SKU, Name, and Unit Price are required.' });
    }

    const product = await prisma.product.create({
      data: {
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        category: category?.trim() || 'General',
        unit: unit?.trim() || 'Unit',
        unitPrice: parseFloat(unitPrice),
        costPrice: parseFloat(costPrice || 0),
        currentStock: parseInt(currentStock || 0, 10),
        minStockAlert: parseInt(minStockAlert || 10, 10)
      }
    });

    // Record initial stock movement if starting stock > 0
    if (product.currentStock > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: 'INBOUND',
          quantity: product.currentStock,
          notes: 'Initial product creation stock'
        }
      });
    }

    res.status(201).json(product);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update product
app.put('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sku, name, category, unit, unitPrice, costPrice, minStockAlert } = req.body;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        sku: sku?.trim().toUpperCase(),
        name: name?.trim(),
        category: category?.trim(),
        unit: unit?.trim(),
        unitPrice: unitPrice !== undefined ? parseFloat(unitPrice) : undefined,
        costPrice: costPrice !== undefined ? parseFloat(costPrice) : undefined,
        minStockAlert: minStockAlert !== undefined ? parseInt(minStockAlert, 10) : undefined
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Inbound Stock / Adjustment (Atomic stock modification + audit log)
app.post('/api/products/:id/stock-adjust', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { quantity, type, notes, referenceId } = req.body; // type: 'INBOUND' | 'ADJUSTMENT' | 'RETURN'

  try {
    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty === 0) {
      return res.status(400).json({ error: 'Valid non-zero quantity is required.' });
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: {
          currentStock: { increment: parsedQty }
        }
      });

      if (product.currentStock < 0) {
        throw new Error('Adjustment would result in negative inventory.');
      }

      await tx.stockMovement.create({
        data: {
          productId: id,
          type: type || 'INBOUND',
          quantity: parsedQty,
          referenceId: referenceId?.trim() || null,
          notes: notes?.trim() || null
        }
      });

      return product;
    });

    res.json(updatedProduct);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete product (only if no order history)
app.delete('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orderItemsCount = await prisma.orderItem.count({ where: { productId: id } });
    if (orderItemsCount > 0) {
      return res.status(400).json({ error: 'Cannot delete product with existing order history.' });
    }

    await prisma.product.delete({ where: { id } });
    res.json({ message: 'Product deleted successfully.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 2. CUSTOMER & CLIENT MANAGEMENT
// ========================================================

// List customers
app.get('/api/customers', async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const where: any = {};

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { phone: { contains: search } },
        { companyName: { contains: search } }
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        _count: { select: { orders: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create customer
app.post('/api/customers', async (req: Request, res: Response) => {
  try {
    const { name, companyName, phone, deliveryAddress, city, pricingTier, discountPercentage, creditLimit } = req.body;

    if (!name || !phone || !deliveryAddress) {
      return res.status(400).json({ error: 'Name, Phone, and Delivery Address are required.' });
    }

    const count = await prisma.customer.count();
    const code = `CUST-${(count + 1).toString().padStart(3, '0')}`;

    const customer = await prisma.customer.create({
      data: {
        code,
        name: name.trim(),
        companyName: companyName?.trim() || null,
        phone: phone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        city: city?.trim() || 'Local',
        pricingTier: pricingTier || 'STANDARD',
        discountPercentage: parseFloat(discountPercentage || 0),
        creditLimit: parseFloat(creditLimit || 5000)
      }
    });

    res.status(201).json(customer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update customer
app.put('/api/customers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, companyName, phone, deliveryAddress, city, pricingTier, discountPercentage, creditLimit, outstandingBalance } = req.body;

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: name?.trim(),
        companyName: companyName?.trim(),
        phone: phone?.trim(),
        deliveryAddress: deliveryAddress?.trim(),
        city: city?.trim(),
        pricingTier,
        discountPercentage: discountPercentage !== undefined ? parseFloat(discountPercentage) : undefined,
        creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : undefined,
        outstandingBalance: outstandingBalance !== undefined ? parseFloat(outstandingBalance) : undefined
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Customer order history
app.get('/api/customers/:id/orders', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orders = await prisma.order.findMany({
      where: { customerId: id },
      include: {
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 3. ORDER & DISTRIBUTION WORKFLOW (ATOMIC POS)
// ========================================================

// List orders with filter
app.get('/api/orders', async (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query;
    const where: any = {};
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string, 10) : undefined
    });

    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single order for invoice/delivery note
app.get('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } }
      }
    });
    res.json(order);
  } catch (error: any) {
    res.status(404).json({ error: 'Order not found' });
  }
});

// Create new order (Atomic: Stock Decrement + Audit Logging + Receivables)
app.post('/api/orders', async (req: Request, res: Response) => {
  const { customerId, items, notes, paymentStatus } = req.body;
  // items: [{ productId: string, quantity: number }]

  if (!customerId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer and at least one line item are required.' });
  }

  try {
    const newOrder = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });

      let subtotal = 0;
      const orderItemsToCreate = [];

      // Validate stock and prepare lines
      for (const item of items) {
        const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });

        if (product.currentStock < item.quantity) {
          throw new Error(`Insufficient stock for "${product.name}". Only ${product.currentStock} ${product.unit} available.`);
        }

        const lineTotal = product.unitPrice * item.quantity;
        subtotal += lineTotal;

        orderItemsToCreate.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.unitPrice,
          lineTotal
        });

        // 1. Decrement inventory
        await tx.product.update({
          where: { id: product.id },
          data: { currentStock: { decrement: item.quantity } }
        });
      }

      // Tier discount calculation
      const discountPercentage = customer.discountPercentage || 0;
      const discountAmount = (subtotal * discountPercentage) / 100;
      const netTotal = subtotal - discountAmount;

      // Unique Order Number
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await tx.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });
      const orderNumber = `ORD-${todayStr}-${(countToday + 1).toString().padStart(4, '0')}`;

      // 2. Create Order
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          status: 'PENDING',
          paymentStatus: paymentStatus || 'UNPAID',
          subtotal,
          discountAmount,
          taxAmount: 0.0,
          netTotal,
          notes: notes?.trim() || null,
          items: {
            create: orderItemsToCreate
          }
        },
        include: {
          customer: true,
          items: { include: { product: true } }
        }
      });

      // 3. Record Outbound Stock Movements linked to this Order
      for (const item of items) {
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'OUTBOUND',
            quantity: -item.quantity,
            referenceId: createdOrder.orderNumber,
            notes: `Dispatched to ${customer.name}`
          }
        });
      }

      // 4. Update Customer Outstanding Balance if Unpaid
      if (paymentStatus !== 'PAID') {
        await tx.customer.update({
          where: { id: customerId },
          data: { outstandingBalance: { increment: netTotal } }
        });
      }

      return createdOrder;
    });

    res.status(201).json(newOrder);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update order status (PENDING -> DISPATCHED -> DELIVERED or CANCELLED)
app.patch('/api/orders/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: true, customer: true }
      });

      // Handle cancellation: return stock to inventory & reverse balance if unpaid
      if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
        for (const item of existing.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } }
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'RETURN',
              quantity: item.quantity,
              referenceId: existing.orderNumber,
              notes: 'Order cancelled; stock restored'
            }
          });
        }

        if (existing.paymentStatus !== 'PAID') {
          await tx.customer.update({
            where: { id: existing.customerId },
            data: { outstandingBalance: { decrement: existing.netTotal } }
          });
        }
      }

      return await tx.order.update({
        where: { id },
        data: {
          status,
          dispatchedAt: status === 'DISPATCHED' ? new Date() : existing.dispatchedAt,
          deliveredAt: status === 'DELIVERED' ? new Date() : existing.deliveredAt
        },
        include: { customer: true, items: { include: { product: true } } }
      });
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 4. REPORTING & ANALYTICS
// ========================================================

// High-level dashboard stats
app.get('/api/reports/dashboard-stats', async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayOrders, allProducts, customerBalances] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: today } },
        include: { customer: true }
      }),
      prisma.product.findMany(),
      prisma.customer.aggregate({
        _sum: { outstandingBalance: true }
      })
    ]);

    const lowStockProducts = allProducts.filter(p => p.currentStock <= p.minStockAlert);
    const revenueToday = todayOrders
      .filter(o => o.status !== 'CANCELLED')
      .reduce((acc, order) => acc + order.netTotal, 0);
    const dispatchedCount = todayOrders.filter(o => o.status === 'DISPATCHED' || o.status === 'DELIVERED').length;

    res.json({
      revenueToday,
      ordersTodayCount: todayOrders.length,
      dispatchedCount,
      lowStockCount: lowStockProducts.length,
      totalOutstanding: customerBalances._sum.outstandingBalance || 0,
      recentOrders: todayOrders.slice(0, 10),
      lowStockItems: lowStockProducts.slice(0, 5)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// End-of-day sales summary
app.get('/api/reports/sales-summary', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const startDate = from ? new Date(from as string) : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = to ? new Date(to as string) : new Date();

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: { customer: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const totalGross = orders.reduce((acc, o) => acc + o.subtotal, 0);
    const totalDiscounts = orders.reduce((acc, o) => acc + o.discountAmount, 0);
    const totalNet = orders.reduce((acc, o) => acc + o.netTotal, 0);

    res.json({
      from: startDate.toISOString(),
      to: endDate.toISOString(),
      ordersCount: orders.length,
      totalGross,
      totalDiscounts,
      totalNet,
      orders
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Stock movement history
app.get('/api/reports/stock-movements', async (req: Request, res: Response) => {
  try {
    const { type, limit } = req.query;
    const where: any = {};
    if (type && typeof type === 'string' && type !== 'ALL') {
      where.type = type;
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string, 10) : 100
    });

    res.json(movements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Customer outstanding balances
app.get('/api/reports/customer-balances', async (_req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { outstandingBalance: { gt: 0 } },
      orderBy: { outstandingBalance: 'desc' }
    });

    const totalOutstanding = customers.reduce((acc, c) => acc + c.outstandingBalance, 0);

    res.json({
      totalOutstanding,
      count: customers.length,
      customers
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// SERVE PRODUCTION FRONTEND (RAILWAY / WEB HOSTING)
// ========================================================
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  console.log(`[Express] Serving static web bundle from ${distPath}`);
  app.use(express.static(distPath));

  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(Number(PORT), HOST, () => {
  console.log(`[Express Backend] Distributor Server active on http://${HOST}:${PORT}`);
});
