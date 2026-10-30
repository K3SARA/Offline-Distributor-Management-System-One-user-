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
// 1. INVENTORY & WAREHOUSE MANAGEMENT
// ========================================================

// List all products
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
      include: {
        lorryStocks: {
          include: { lorry: true }
        }
      },
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

    if (product.currentStock > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: 'INBOUND',
          quantity: product.currentStock,
          notes: 'Initial warehouse intake stock'
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

// Inbound Stock / Adjustment (Supplier Bulk Inward / Physical Count)
app.post('/api/products/:id/stock-adjust', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { quantity, type, notes, referenceId } = req.body;

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
        throw new Error('Adjustment would result in negative warehouse inventory.');
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

// Delete product
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
// 2. ROUTES & FLEET (3 LORRIES ON 3 ROUTES)
// ========================================================

// List routes
app.get('/api/routes', async (_req: Request, res: Response) => {
  try {
    const routes = await prisma.route.findMany({
      include: {
        lorries: true,
        _count: { select: { customers: true, orders: true } }
      },
      orderBy: { code: 'asc' }
    });
    res.json(routes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Update Route
app.post('/api/routes', async (req: Request, res: Response) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Route code and name are required.' });
    }

    const route = await prisma.route.upsert({
      where: { code: code.trim().toUpperCase() },
      update: { name: name.trim(), description: description?.trim() },
      create: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description?.trim()
      }
    });
    res.json(route);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// List 3 Lorries with real-time floating stock & active morning loading
app.get('/api/lorries', async (_req: Request, res: Response) => {
  try {
    const lorries = await prisma.lorry.findMany({
      include: {
        route: true,
        lorryStocks: {
          include: { product: true }
        },
        loadings: {
          orderBy: { date: 'desc' },
          take: 1,
          include: {
            items: { include: { product: true } }
          }
        }
      },
      orderBy: { vehicleNumber: 'asc' }
    });
    res.json(lorries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single lorry details
app.get('/api/lorries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lorry = await prisma.lorry.findUniqueOrThrow({
      where: { id },
      include: {
        route: true,
        lorryStocks: {
          include: { product: true }
        },
        loadings: {
          orderBy: { date: 'desc' },
          take: 5,
          include: {
            items: { include: { product: true } }
          }
        }
      }
    });
    res.json(lorry);
  } catch (error: any) {
    res.status(404).json({ error: 'Lorry not found' });
  }
});

// Update Lorry details
app.put('/api/lorries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { driverName, driverPhone, routeId, status } = req.body;

    const updated = await prisma.lorry.update({
      where: { id },
      data: {
        driverName: driverName?.trim(),
        driverPhone: driverPhone?.trim(),
        routeId: routeId || undefined,
        status: status || undefined
      },
      include: { route: true }
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 3. MORNING LORRY LOADING (WAREHOUSE -> LORRY TRANSFER)
// ========================================================
// Every morning, items are loaded from warehouse into the lorry.
// Warehouse stock is reduced immediately.
app.post('/api/lorries/:id/load', async (req: Request, res: Response) => {
  const { id: lorryId } = req.params;
  const { items, notes } = req.body;
  // items: [{ productId: string, quantity: number }]

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required for morning lorry loading.' });
  }

  try {
    const loadingSession = await prisma.$transaction(async (tx) => {
      const lorry = await tx.lorry.findUniqueOrThrow({
        where: { id: lorryId },
        include: { route: true }
      });

      // Generate Loading Number (e.g. LOAD-20261030-001)
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await tx.lorryLoading.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });
      const loadingNumber = `LOAD-${todayStr}-${(countToday + 1).toString().padStart(3, '0')}`;

      // Check warehouse stock availability
      for (const item of items) {
        if (!item.quantity || item.quantity <= 0) continue;
        const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
        if (product.currentStock < item.quantity) {
          throw new Error(`Insufficient warehouse stock for "${product.name}". Available: ${product.currentStock} ${product.unit}, requested: ${item.quantity}`);
        }
      }

      // Create LorryLoading sheet
      const newLoading = await tx.lorryLoading.create({
        data: {
          loadingNumber,
          lorryId,
          routeId: lorry.routeId,
          status: 'LOADED',
          notes: notes?.trim() || `Morning dispatch for route ${lorry.route?.name || 'Assigned Route'}`
        }
      });

      let totalLoadedUnits = 0;

      // Transfer stock from warehouse to lorry
      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        if (isNaN(qty) || qty <= 0) continue;

        totalLoadedUnits += qty;

        // 1. Deduct Warehouse Stock
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: qty } }
        });

        // 2. Record Warehouse Outward Movement
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'LORRY_LOAD',
            quantity: -qty,
            referenceId: loadingNumber,
            notes: `Loaded into Lorry ${lorry.vehicleNumber} (${lorry.driverName})`
          }
        });

        // 3. Increment Lorry Floating Stock
        await tx.lorryStock.upsert({
          where: {
            lorryId_productId: {
              lorryId,
              productId: item.productId
            }
          },
          update: {
            quantity: { increment: qty }
          },
          create: {
            lorryId,
            productId: item.productId,
            quantity: qty
          }
        });

        // 4. Record Loading Item
        await tx.lorryLoadingItem.create({
          data: {
            loadingId: newLoading.id,
            productId: item.productId,
            loadedQty: qty,
            soldQty: 0,
            returnedQty: 0,
            discrepancyQty: 0
          }
        });
      }

      // Update total units count
      return await tx.lorryLoading.update({
        where: { id: newLoading.id },
        data: { totalLoadedItems: totalLoadedUnits },
        include: {
          lorry: { include: { route: true } },
          items: { include: { product: true } }
        }
      });
    });

    res.status(201).json(loadingSession);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get current active loading sheet for a lorry
app.get('/api/lorries/:id/current-loading', async (req: Request, res: Response) => {
  try {
    const { id: lorryId } = req.params;
    const activeLoading = await prisma.lorryLoading.findFirst({
      where: {
        lorryId,
        status: { in: ['LOADED', 'IN_TRANSIT'] }
      },
      orderBy: { date: 'desc' },
      include: {
        lorry: { include: { route: true } },
        items: { include: { product: true } }
      }
    });

    res.json(activeLoading || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 4. EVENING OFFICE BILL ENTRY (DRIVER PAPER BILLS -> SYSTEM)
// ========================================================
// Office manager receives physical bills from driver and enters them.
// Stock is deducted from the LORRY's floating stock (not warehouse).
app.post('/api/lorries/:id/bills', async (req: Request, res: Response) => {
  const { id: lorryId } = req.params;
  const {
    paperBillNumber,
    customerId,
    items,
    paymentMethod, // CASH, CREDIT, CHEQUE
    cashReceived,
    notes
  } = req.body;

  if (!customerId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer and bill items are required.' });
  }

  try {
    const orderResult = await prisma.$transaction(async (tx) => {
      const lorry = await tx.lorry.findUniqueOrThrow({
        where: { id: lorryId },
        include: { route: true }
      });

      const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });

      // Find current active loading sheet for this lorry
      let activeLoading = await tx.lorryLoading.findFirst({
        where: {
          lorryId,
          status: { in: ['LOADED', 'IN_TRANSIT'] }
        },
        orderBy: { date: 'desc' },
        include: { items: true }
      });

      let subtotal = 0;
      const orderItemsToCreate = [];

      // Validate Lorry floating inventory
      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        if (isNaN(qty) || qty <= 0) continue;

        const lorryStock = await tx.lorryStock.findUnique({
          where: {
            lorryId_productId: {
              lorryId,
              productId: item.productId
            }
          },
          include: { product: true }
        });

        const product = lorryStock?.product || await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
        const availableInLorry = lorryStock?.quantity || 0;

        if (availableInLorry < qty) {
          throw new Error(
            `Insufficient stock on Lorry ${lorry.vehicleNumber} for "${product.name}". Available in lorry: ${availableInLorry} ${product.unit}, bill requires: ${qty}`
          );
        }

        const lineTotal = product.unitPrice * qty;
        subtotal += lineTotal;

        orderItemsToCreate.push({
          productId: product.id,
          quantity: qty,
          unitPrice: product.unitPrice,
          lineTotal
        });

        // 1. Deduct from Lorry Floating Stock
        await tx.lorryStock.update({
          where: {
            lorryId_productId: {
              lorryId,
              productId: item.productId
            }
          },
          data: { quantity: { decrement: qty } }
        });

        // 2. Update active loading sheet sold quantities if exists
        if (activeLoading) {
          const loadingItem = activeLoading.items.find(li => li.productId === item.productId);
          if (loadingItem) {
            await tx.lorryLoadingItem.update({
              where: { id: loadingItem.id },
              data: { soldQty: { increment: qty } }
            });
          }
        }
      }

      // Calculations
      const discountPercentage = customer.discountPercentage || 0;
      const discountAmount = (subtotal * discountPercentage) / 100;
      const netTotal = subtotal - discountAmount;

      const paidAmount = parseFloat(cashReceived !== undefined ? cashReceived : (paymentMethod === 'CASH' ? netTotal : 0));
      const paymentStatus = paidAmount >= netTotal ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID');

      // Order number
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await tx.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });
      const orderNumber = `ORD-${todayStr}-${(countToday + 1).toString().padStart(4, '0')}`;

      // 3. Create Order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          paperBillNumber: paperBillNumber?.trim() || null,
          customerId,
          lorryId,
          routeId: lorry.routeId || customer.routeId || null,
          status: 'DELIVERED',
          paymentStatus,
          paymentMethod: paymentMethod || 'CASH',
          subtotal,
          discountAmount,
          taxAmount: 0.0,
          netTotal,
          cashReceived: paidAmount,
          notes: notes?.trim() || `Driver: ${lorry.driverName} (${lorry.vehicleNumber})`,
          dispatchedAt: new Date(),
          deliveredAt: new Date(),
          items: {
            create: orderItemsToCreate
          }
        },
        include: {
          customer: true,
          lorry: { include: { route: true } },
          route: true,
          items: { include: { product: true } }
        }
      });

      // 4. Update Customer Outstanding Balance if credit/unpaid
      const creditAmount = netTotal - paidAmount;
      if (creditAmount > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: { outstandingBalance: { increment: creditAmount } }
        });
      }

      // 5. Update Loading sheet cumulative stats
      if (activeLoading) {
        await tx.lorryLoading.update({
          where: { id: activeLoading.id },
          data: {
            totalSoldItems: { increment: orderItemsToCreate.reduce((a, b) => a + b.quantity, 0) },
            totalSalesAmount: { increment: netTotal },
            cashCollected: { increment: paidAmount },
            creditGiven: { increment: creditAmount > 0 ? creditAmount : 0 }
          }
        });
      }

      return newOrder;
    });

    res.status(201).json(orderResult);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 5. DAY-END LORRY SETTLEMENT & UNSOLD RETURN TO WAREHOUSE
// ========================================================
// Reconcile loaded vs sold vs returned.
// Any returned unsold stock is credited back to Main Warehouse stock.
app.post('/api/lorries/:id/settle', async (req: Request, res: Response) => {
  const { id: lorryId } = req.params;
  const { loadingId, returns, cashHandover, notes } = req.body;
  // returns: [{ productId: string, returnedQty: number }]

  try {
    const settlementSummary = await prisma.$transaction(async (tx) => {
      const lorry = await tx.lorry.findUniqueOrThrow({
        where: { id: lorryId },
        include: { route: true }
      });

      const loading = await tx.lorryLoading.findUniqueOrThrow({
        where: { id: loadingId },
        include: { items: { include: { product: true } } }
      });

      let totalReturned = 0;

      // Process each returned product
      for (const ret of returns || []) {
        const returnQty = parseInt(ret.returnedQty, 10) || 0;
        if (returnQty < 0) continue;

        totalReturned += returnQty;

        // 1. Credit back to Main Warehouse
        if (returnQty > 0) {
          await tx.product.update({
            where: { id: ret.productId },
            data: { currentStock: { increment: returnQty } }
          });

          await tx.stockMovement.create({
            data: {
              productId: ret.productId,
              type: 'LORRY_RETURN',
              quantity: returnQty,
              referenceId: loading.loadingNumber,
              notes: `Unsold stock returned from Lorry ${lorry.vehicleNumber}`
            }
          });
        }

        // 2. Update loading item line (returned + calculate discrepancy)
        const itemLine = loading.items.find(i => i.productId === ret.productId);
        if (itemLine) {
          const discrepancy = itemLine.loadedQty - (itemLine.soldQty + returnQty);
          await tx.lorryLoadingItem.update({
            where: { id: itemLine.id },
            data: {
              returnedQty: returnQty,
              discrepancyQty: discrepancy
            }
          });
        }

        // 3. Clear Lorry Floating Stock for settled products
        await tx.lorryStock.upsert({
          where: {
            lorryId_productId: {
              lorryId,
              productId: ret.productId
            }
          },
          update: { quantity: 0 },
          create: {
            lorryId,
            productId: ret.productId,
            quantity: 0
          }
        });
      }

      // Mark Loading Sheet as SETTLED
      const settledLoading = await tx.lorryLoading.update({
        where: { id: loadingId },
        data: {
          status: 'SETTLED',
          settledAt: new Date(),
          totalReturnedItems: totalReturned,
          cashCollected: cashHandover !== undefined ? parseFloat(cashHandover) : loading.cashCollected,
          notes: notes?.trim() || loading.notes
        },
        include: {
          lorry: { include: { route: true } },
          items: { include: { product: true } }
        }
      });

      return settledLoading;
    });

    res.json(settlementSummary);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 6. CUSTOMER & CLIENT DIRECTORY
// ========================================================

// List customers
app.get('/api/customers', async (req: Request, res: Response) => {
  try {
    const { search, routeId } = req.query;
    const where: any = {};

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { phone: { contains: search } },
        { companyName: { contains: search } }
      ];
    }

    if (routeId && typeof routeId === 'string' && routeId !== 'ALL') {
      where.routeId = routeId;
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        route: true,
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
    const { name, companyName, phone, deliveryAddress, city, routeId, pricingTier, discountPercentage, creditLimit } = req.body;

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
        routeId: routeId || null,
        pricingTier: pricingTier || 'STANDARD',
        discountPercentage: parseFloat(discountPercentage || 0),
        creditLimit: parseFloat(creditLimit || 50000)
      },
      include: { route: true }
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
    const { name, companyName, phone, deliveryAddress, city, routeId, pricingTier, discountPercentage, creditLimit, outstandingBalance } = req.body;

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: name?.trim(),
        companyName: companyName?.trim(),
        phone: phone?.trim(),
        deliveryAddress: deliveryAddress?.trim(),
        city: city?.trim(),
        routeId: routeId !== undefined ? routeId : undefined,
        pricingTier,
        discountPercentage: discountPercentage !== undefined ? parseFloat(discountPercentage) : undefined,
        creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : undefined,
        outstandingBalance: outstandingBalance !== undefined ? parseFloat(outstandingBalance) : undefined
      },
      include: { route: true }
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
        lorry: true,
        route: true,
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
// 7. ORDERS & BILL HISTORY
// ========================================================

// List orders with filter
app.get('/api/orders', async (req: Request, res: Response) => {
  try {
    const { status, lorryId, routeId, limit } = req.query;
    const where: any = {};
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }
    if (lorryId && typeof lorryId === 'string' && lorryId !== 'ALL') {
      where.lorryId = lorryId;
    }
    if (routeId && typeof routeId === 'string' && routeId !== 'ALL') {
      where.routeId = routeId;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        lorry: true,
        route: true,
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

// Get single order
app.get('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        lorry: true,
        route: true,
        items: { include: { product: true } }
      }
    });
    res.json(order);
  } catch (error: any) {
    res.status(404).json({ error: 'Order not found' });
  }
});

// Create counter POS order (Direct warehouse sale if needed)
app.post('/api/orders', async (req: Request, res: Response) => {
  const { customerId, items, notes, paymentStatus, paymentMethod, cashReceived, lorryId } = req.body;

  if (lorryId) {
    // Forward to lorry bill entry logic
    return res.redirect(307, `/api/lorries/${lorryId}/bills`);
  }

  if (!customerId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer and line items are required.' });
  }

  try {
    const newOrder = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });

      let subtotal = 0;
      const orderItemsToCreate = [];

      for (const item of items) {
        const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });

        if (product.currentStock < item.quantity) {
          throw new Error(`Insufficient warehouse stock for "${product.name}". Only ${product.currentStock} ${product.unit} available.`);
        }

        const lineTotal = product.unitPrice * item.quantity;
        subtotal += lineTotal;

        orderItemsToCreate.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.unitPrice,
          lineTotal
        });

        await tx.product.update({
          where: { id: product.id },
          data: { currentStock: { decrement: item.quantity } }
        });
      }

      const discountPercentage = customer.discountPercentage || 0;
      const discountAmount = (subtotal * discountPercentage) / 100;
      const netTotal = subtotal - discountAmount;

      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await tx.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });
      const orderNumber = `ORD-${todayStr}-${(countToday + 1).toString().padStart(4, '0')}`;

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          status: 'DELIVERED',
          paymentStatus: paymentStatus || 'PAID',
          paymentMethod: paymentMethod || 'CASH',
          subtotal,
          discountAmount,
          taxAmount: 0.0,
          netTotal,
          cashReceived: cashReceived !== undefined ? parseFloat(cashReceived) : netTotal,
          notes: notes?.trim() || 'Counter Warehouse Sale',
          items: {
            create: orderItemsToCreate
          }
        },
        include: {
          customer: true,
          items: { include: { product: true } }
        }
      });

      for (const item of items) {
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'OUTBOUND',
            quantity: -item.quantity,
            referenceId: createdOrder.orderNumber,
            notes: `Counter Sale to ${customer.name}`
          }
        });
      }

      if (paymentStatus !== 'PAID') {
        const remainingCredit = netTotal - (cashReceived ? parseFloat(cashReceived) : 0);
        if (remainingCredit > 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: { outstandingBalance: { increment: remainingCredit } }
          });
        }
      }

      return createdOrder;
    });

    res.status(201).json(newOrder);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update order status
app.patch('/api/orders/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: true, customer: true }
      });

      if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
        for (const item of existing.items) {
          // If order was from lorry, return to lorry or warehouse
          if (existing.lorryId) {
            await tx.lorryStock.upsert({
              where: {
                lorryId_productId: {
                  lorryId: existing.lorryId,
                  productId: item.productId
                }
              },
              update: { quantity: { increment: item.quantity } },
              create: {
                lorryId: existing.lorryId,
                productId: item.productId,
                quantity: item.quantity
              }
            });
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: { increment: item.quantity } }
            });
          }

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
          deliveredAt: status === 'DELIVERED' ? new Date() : existing.deliveredAt
        },
        include: { customer: true, lorry: true, route: true, items: { include: { product: true } } }
      });
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 8. REPORTING & ANALYTICS (LORRY PERFORMANCE, ROUTES, CASH)
// ========================================================

// Dashboard statistics with date range support
app.get('/api/reports/dashboard-stats', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const startDate = from ? new Date(from as string) : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = to ? new Date(to as string) : new Date(new Date().setHours(23, 59, 59, 999));

    const [periodOrders, allProducts, customerBalances, lorries] = await Promise.all([
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: { customer: true, lorry: true, route: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.findMany({
        include: { lorryStocks: true }
      }),
      prisma.customer.aggregate({
        _sum: { outstandingBalance: true }
      }),
      prisma.lorry.findMany({
        include: {
          route: true,
          lorryStocks: true,
          loadings: {
            where: {
              date: {
                gte: startDate,
                lte: endDate
              }
            },
            include: { items: true }
          }
        }
      })
    ]);

    const lowStockProducts = allProducts.filter(p => p.currentStock <= p.minStockAlert);
    const validOrders = periodOrders.filter(o => o.status !== 'CANCELLED');
    const revenueToday = validOrders.reduce((acc, order) => acc + order.netTotal, 0);
    const cashToday = validOrders.reduce((acc, order) => acc + order.cashReceived, 0);
    const creditToday = revenueToday - cashToday;

    // Lorry fleet status breakdown
    const fleetStatus = lorries.map(l => {
      const activeLoading = l.loadings[0];
      const floatingStockUnits = l.lorryStocks.reduce((a, b) => a + b.quantity, 0);
      return {
        id: l.id,
        vehicleNumber: l.vehicleNumber,
        driverName: l.driverName,
        routeName: l.route?.name || 'Unassigned',
        status: activeLoading ? (activeLoading.status === 'SETTLED' ? 'SETTLED' : 'ACTIVE') : 'READY_TO_LOAD',
        floatingStockUnits,
        todaySales: activeLoading?.totalSalesAmount || 0,
        todayCash: activeLoading?.cashCollected || 0
      };
    });

    res.json({
      revenueToday,
      cashToday,
      creditToday,
      ordersTodayCount: validOrders.length,
      lowStockCount: lowStockProducts.length,
      totalOutstanding: customerBalances._sum.outstandingBalance || 0,
      fleetStatus,
      recentOrders: periodOrders.slice(0, 15),
      lowStockItems: lowStockProducts.slice(0, 5),
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Lorry Performance & Settlement Report with date filtering
app.get('/api/reports/lorry-performance', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const where: any = {};
    if (from || to) {
      where.date = {
        gte: from ? new Date(from as string) : undefined,
        lte: to ? new Date(to as string) : undefined
      };
    }

    const loadings = await prisma.lorryLoading.findMany({
      where,
      include: {
        lorry: { include: { route: true } },
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json(loadings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sales summary by route with date filtering
app.get('/api/reports/route-sales', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const orderWhere: any = { status: { not: 'CANCELLED' } };
    if (from || to) {
      orderWhere.createdAt = {
        gte: from ? new Date(from as string) : undefined,
        lte: to ? new Date(to as string) : undefined
      };
    }

    const routes = await prisma.route.findMany({
      include: {
        lorries: true,
        customers: true,
        orders: {
          where: orderWhere,
          include: { items: true }
        }
      }
    });

    const routeSummaries = routes.map(r => {
      const totalSales = r.orders.reduce((acc, o) => acc + o.netTotal, 0);
      const totalCash = r.orders.reduce((acc, o) => acc + o.cashReceived, 0);
      const totalCredit = totalSales - totalCash;
      const totalBills = r.orders.length;

      return {
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        lorry: r.lorries[0] || null,
        customerCount: r.customers.length,
        totalBills,
        totalSales,
        totalCash,
        totalCredit
      };
    });

    res.json(routeSummaries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// End-of-day sales summary
app.get('/api/reports/sales-summary', async (req: Request, res: Response) => {
  try {
    const { from, to, lorryId, routeId } = req.query;
    const startDate = from ? new Date(from as string) : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = to ? new Date(to as string) : new Date(new Date().setHours(23, 59, 59, 999));

    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    };

    if (lorryId && typeof lorryId === 'string' && lorryId !== 'ALL') {
      where.lorryId = lorryId;
    }
    if (routeId && typeof routeId === 'string' && routeId !== 'ALL') {
      where.routeId = routeId;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        lorry: true,
        route: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const validOrders = orders.filter(o => o.status !== 'CANCELLED');
    const totalGross = validOrders.reduce((acc, o) => acc + o.subtotal, 0);
    const totalDiscounts = validOrders.reduce((acc, o) => acc + o.discountAmount, 0);
    const totalNet = validOrders.reduce((acc, o) => acc + o.netTotal, 0);
    const totalCash = validOrders.reduce((acc, o) => acc + o.cashReceived, 0);

    res.json({
      from: startDate.toISOString(),
      to: endDate.toISOString(),
      ordersCount: validOrders.length,
      totalGross,
      totalDiscounts,
      totalNet,
      totalCash,
      totalCredit: totalNet - totalCash,
      orders
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Stock movement history with date filtering
app.get('/api/reports/stock-movements', async (req: Request, res: Response) => {
  try {
    const { type, limit, from, to } = req.query;
    const where: any = {};
    if (type && typeof type === 'string' && type !== 'ALL') {
      where.type = type;
    }
    if (from || to) {
      where.createdAt = {
        gte: from ? new Date(from as string) : undefined,
        lte: to ? new Date(to as string) : undefined
      };
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
      include: { route: true },
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

async function seedIfEmpty() {
  try {
    // 1. Ensure Routes exist (3 Routes)
    const routeCount = await prisma.route.count();
    let r1, r2, r3;
    if (routeCount === 0) {
      console.log('[Auto-Seed] Seeding 3 distribution routes...');
      r1 = await prisma.route.create({
        data: {
          code: 'R-01',
          name: 'Route 1 - Colombo South',
          description: 'Wellawatte, Dehiwala, Mount Lavinia, Moratuwa, Panadura'
        }
      });
      r2 = await prisma.route.create({
        data: {
          code: 'R-02',
          name: 'Route 2 - Kandy Road',
          description: 'Peliyagoda, Kelaniya, Kiribathgoda, Kadawatha, Nittambuwa'
        }
      });
      r3 = await prisma.route.create({
        data: {
          code: 'R-03',
          name: 'Route 3 - Negombo Coastal',
          description: 'Wattala, Kandana, Ja-Ela, Seeduwa, Katunayake, Negombo'
        }
      });
    } else {
      const existingRoutes = await prisma.route.findMany({ orderBy: { code: 'asc' } });
      r1 = existingRoutes[0];
      r2 = existingRoutes[1] || r1;
      r3 = existingRoutes[2] || r1;
    }

    // 2. Ensure Lorries exist (3 Lorries assigned to the 3 routes)
    const lorryCount = await prisma.lorry.count();
    if (lorryCount === 0) {
      console.log('[Auto-Seed] Seeding 3 distribution lorries...');
      await prisma.lorry.createMany({
        data: [
          {
            vehicleNumber: 'WP-DA-1024',
            driverName: 'Sunil Perera',
            driverPhone: '+94 77 123 4501',
            routeId: r1.id,
            status: 'ACTIVE'
          },
          {
            vehicleNumber: 'WP-GB-5521',
            driverName: 'Kamal Silva',
            driverPhone: '+94 71 876 5402',
            routeId: r2.id,
            status: 'ACTIVE'
          },
          {
            vehicleNumber: 'WP-LC-3098',
            driverName: 'Nimal Fernando',
            driverPhone: '+94 78 554 3203',
            routeId: r3.id,
            status: 'ACTIVE'
          }
        ]
      });
    }

    // 3. Ensure Products exist in warehouse
    const productCount = await prisma.product.count();
    if (productCount === 0) {
      console.log('[Auto-Seed] Seeding warehouse stock catalog...');
      await prisma.product.createMany({
        data: [
          {
            sku: 'BEV-001',
            name: 'Ceylon Premium Black Tea (24x250g)',
            category: 'Beverages',
            unit: 'Case',
            unitPrice: 7200.00,
            costPrice: 5100.00,
            currentStock: 150,
            minStockAlert: 20
          },
          {
            sku: 'BEV-002',
            name: 'Natural Mineral Spring Water (12x1.5L)',
            category: 'Beverages',
            unit: 'Case',
            unitPrice: 2160.00,
            costPrice: 1400.00,
            currentStock: 250,
            minStockAlert: 30
          },
          {
            sku: 'DRY-001',
            name: 'Samba Rice Premium Quality (25kg Bag)',
            category: 'Grains & Staples',
            unit: 'Bag',
            unitPrice: 6500.00,
            costPrice: 5200.00,
            currentStock: 180,
            minStockAlert: 25
          },
          {
            sku: 'DRY-002',
            name: 'White Sugar Refined (50kg Bag)',
            category: 'Grains & Staples',
            unit: 'Bag',
            unitPrice: 13500.00,
            costPrice: 11200.00,
            currentStock: 90,
            minStockAlert: 15
          },
          {
            sku: 'OIL-001',
            name: 'Pure Coconut Oil Bottle (12x750ml)',
            category: 'Oils & Fats',
            unit: 'Case',
            unitPrice: 9600.00,
            costPrice: 7800.00,
            currentStock: 110,
            minStockAlert: 20
          },
          {
            sku: 'SNK-001',
            name: 'Cream Cracker Biscuits (40x100g Carton)',
            category: 'Confectionery',
            unit: 'Carton',
            unitPrice: 4800.00,
            costPrice: 3600.00,
            currentStock: 140,
            minStockAlert: 25
          }
        ]
      });
    }

    // 4. Ensure Customers exist with route assignment
    const customerCount = await prisma.customer.count();
    if (customerCount === 0) {
      console.log('[Auto-Seed] Seeding route retail customers...');
      await prisma.customer.createMany({
        data: [
          {
            code: 'CUST-001',
            name: 'Apex Supermart & Provisions',
            companyName: 'Apex Retail Ltd',
            phone: '+94 77 123 4567',
            deliveryAddress: '448 Galle Road, Colombo 03',
            city: 'Colombo',
            routeId: r1.id,
            pricingTier: 'WHOLESALE',
            discountPercentage: 10.0,
            creditLimit: 500000,
            outstandingBalance: 42500.0
          },
          {
            code: 'CUST-002',
            name: 'Horizon Corner Grocers',
            companyName: 'Horizon Stores',
            phone: '+94 71 987 6543',
            deliveryAddress: '12 Kandy Road',
            city: 'Kadawatha',
            routeId: r2.id,
            pricingTier: 'STANDARD',
            discountPercentage: 0.0,
            creditLimit: 150000,
            outstandingBalance: 12400.0
          },
          {
            code: 'CUST-003',
            name: 'Oceanic Traders & Bakers',
            companyName: 'Oceanic Distribution Ltd',
            phone: '+94 78 444 8899',
            deliveryAddress: '88 Main Street',
            city: 'Negombo',
            routeId: r3.id,
            pricingTier: 'VIP',
            discountPercentage: 15.0,
            creditLimit: 750000,
            outstandingBalance: 0.0
          }
        ]
      });
    }

    console.log('[Auto-Seed] System initial data ready.');
  } catch (err) {
    console.error('[Auto-Seed] Warning: auto-seed check skipped:', err);
  }
}

app.listen(Number(PORT), HOST, async () => {
  console.log(`[Express Backend] Distributor Server active on http://${HOST}:${PORT}`);
  await seedIfEmpty();
});
