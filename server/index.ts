import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { prisma, type PrismaClient } from './prisma';

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
    const { lowStock, search, isRawMaterial } = req.query;
    const where: any = {};

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { category: { contains: search } }
      ];
    }

    if (isRawMaterial !== undefined && isRawMaterial !== 'ALL') {
      where.isRawMaterial = isRawMaterial === 'true';
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        supplier: true,
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

    const { freeRatioBuy, freeRatioGet, isRawMaterial } = req.body;

    const product = await prisma.product.create({
      data: {
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        category: category?.trim() || 'General',
        unit: unit?.trim() || 'Unit',
        unitPrice: parseFloat(unitPrice),
        costPrice: parseFloat(costPrice || 0),
        currentStock: parseInt(currentStock || 0, 10),
        minStockAlert: parseInt(minStockAlert || 10, 10),
        freeRatioBuy: freeRatioBuy ? parseInt(freeRatioBuy, 10) : 0,
        freeRatioGet: freeRatioGet ? parseInt(freeRatioGet, 10) : 0,
        isRawMaterial: isRawMaterial ? Boolean(isRawMaterial) : false
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
    const { sku, name, category, unit, unitPrice, costPrice, minStockAlert, freeRatioBuy, freeRatioGet, isRawMaterial } = req.body;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        sku: sku?.trim().toUpperCase(),
        name: name?.trim(),
        category: category?.trim(),
        unit: unit?.trim(),
        unitPrice: unitPrice !== undefined ? parseFloat(unitPrice) : undefined,
        costPrice: costPrice !== undefined ? parseFloat(costPrice) : undefined,
        minStockAlert: minStockAlert !== undefined ? parseInt(minStockAlert, 10) : undefined,
        freeRatioBuy: freeRatioBuy !== undefined ? parseInt(freeRatioBuy, 10) : undefined,
        freeRatioGet: freeRatioGet !== undefined ? parseInt(freeRatioGet, 10) : undefined,
        isRawMaterial: isRawMaterial !== undefined ? Boolean(isRawMaterial) : undefined
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
// 1.5. SUPPLIERS & PROCUREMENT (WAREHOUSE INBOUND STOCK)
// ========================================================

// List all suppliers
app.get('/api/suppliers', async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const where: any = {};
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { contactPerson: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: { products: true, purchaseOrders: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(suppliers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single supplier with products & past purchase orders
app.get('/api/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supplier = await prisma.supplier.findUniqueOrThrow({
      where: { id },
      include: {
        products: true,
        purchaseOrders: {
          include: {
            items: { include: { product: true } }
          },
          orderBy: { date: 'desc' },
          take: 25
        }
      }
    });
    res.json(supplier);
  } catch (error: any) {
    res.status(404).json({ error: 'Supplier not found.' });
  }
});

// Create supplier
app.post('/api/suppliers', async (req: Request, res: Response) => {
  try {
    const { code, name, contactPerson, phone, email, address, city, paymentTerms } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Supplier name and contact phone are required.' });
    }

    let supplierCode = code?.trim()?.toUpperCase();
    if (!supplierCode) {
      const count = await prisma.supplier.count();
      supplierCode = `SUP-${String(count + 1).padStart(3, '0')}`;
    }

    const supplier = await prisma.supplier.create({
      data: {
        code: supplierCode,
        name: name.trim(),
        contactPerson: contactPerson?.trim() || null,
        phone: phone.trim(),
        email: email?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || 'Colombo',
        paymentTerms: paymentTerms?.trim() || 'NET 30',
        outstandingBalance: 0.0
      }
    });

    res.json(supplier);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update supplier
app.put('/api/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, contactPerson, phone, email, address, city, paymentTerms } = req.body;

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name: name?.trim(),
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim(),
        email: email?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim(),
        paymentTerms: paymentTerms?.trim()
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Record supplier payment (settles outstanding balance owed)
app.post('/api/suppliers/:id/payments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, notes } = req.body;
    const payAmount = parseFloat(amount);

    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive payment amount required.' });
    }

    const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        outstandingBalance: { decrement: payAmount }
      }
    });

    res.json({
      message: `Payment of ${payAmount} recorded for ${supplier.name}.`,
      supplier: updated
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete supplier
app.delete('/api/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const poCount = await prisma.purchaseOrder.count({ where: { supplierId: id } });
    if (poCount > 0) {
      return res.status(400).json({ error: 'Cannot delete supplier with linked purchase orders.' });
    }

    await prisma.supplier.delete({ where: { id } });
    res.json({ message: 'Supplier deleted successfully.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// List Inbound Goods Receipts / Purchase Orders
app.get('/api/purchase-orders', async (req: Request, res: Response) => {
  try {
    const { supplierId, from, to } = req.query;
    const where: any = {};

    if (supplierId && typeof supplierId === 'string' && supplierId !== 'ALL') {
      where.supplierId = supplierId;
    }
    if (from || to) {
      where.date = {
        gte: from ? new Date(from as string) : undefined,
        lte: to ? new Date(to as string) : undefined
      };
    }

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: {
          include: { product: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create Inbound Goods Received Note (GRN) - DIRECTLY WIRED WITH WAREHOUSE STOCK
app.post('/api/purchase-orders', async (req: Request, res: Response) => {
  try {
    const {
      supplierId,
      supplierInvoiceNumber,
      date,
      paymentStatus,
      paymentMethod,
      paidAmount,
      notes,
      items
    } = req.body;

    if (!supplierId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Supplier and at least one received item are required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUniqueOrThrow({ where: { id: supplierId } });

      let subtotal = 0;
      const validItems = [];

      for (const item of items) {
        const qty = parseInt(item.quantity, 10);
        const cost = parseFloat(item.costPrice);

        if (isNaN(qty) || qty <= 0) continue;
        if (isNaN(cost) || cost < 0) continue;

        const lineTotal = qty * cost;
        subtotal += lineTotal;

        validItems.push({
          productId: item.productId,
          quantity: qty,
          costPrice: cost,
          lineTotal
        });
      }

      if (validItems.length === 0) {
        throw new Error('Please specify valid product quantities and unit costs.');
      }

      const totalAmount = subtotal;
      const actualPaid = parseFloat(paidAmount !== undefined ? paidAmount : (paymentStatus === 'PAID' ? totalAmount : 0)) || 0;
      const actualPaymentStatus = paymentStatus || (actualPaid >= totalAmount ? 'PAID' : actualPaid > 0 ? 'PARTIAL' : 'UNPAID');

      // Auto-generate PO / GRN number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await tx.purchaseOrder.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });
      const orderNumber = `GRN-${dateStr}-${String(countToday + 1).padStart(4, '0')}`;

      // 1. Create Purchase Order / GRN
      const createdPO = await tx.purchaseOrder.create({
        data: {
          orderNumber,
          supplierInvoiceNumber: supplierInvoiceNumber?.trim() || null,
          supplierId,
          status: 'RECEIVED',
          paymentStatus: actualPaymentStatus,
          paymentMethod: paymentMethod || 'BANK_TRANSFER',
          date: date ? new Date(date) : new Date(),
          subtotal,
          taxAmount: 0.0,
          totalAmount,
          paidAmount: actualPaid,
          notes: notes?.trim() || null,
          receivedAt: new Date(),
          items: {
            create: validItems
          }
        },
        include: {
          supplier: true,
          items: { include: { product: true } }
        }
      });

      // 2. WIRE WITH WAREHOUSE STOCK FOR EACH ITEM:
      for (const item of validItems) {
        // Increment warehouse central inventory & update cost price
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { increment: item.quantity },
            costPrice: item.costPrice,
            supplierId: supplier.id
          }
        });

        // Record Inbound Stock Movement
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'INBOUND',
            quantity: item.quantity,
            referenceId: createdPO.orderNumber,
            notes: `Inbound GRN from ${supplier.name}${supplierInvoiceNumber ? ` (Inv #${supplierInvoiceNumber})` : ''}`
          }
        });
      }

      // 3. If unpaid balance, update supplier outstanding payable balance
      const unpaidBalance = totalAmount - actualPaid;
      if (unpaidBalance > 0) {
        await tx.supplier.update({
          where: { id: supplier.id },
          data: {
            outstandingBalance: { increment: unpaidBalance }
          }
        });
      }

      return createdPO;
    });

    res.json(result);
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

// Create a new Lorry
app.post('/api/lorries', async (req: Request, res: Response) => {
  try {
    const { vehicleNumber, driverName, driverPhone, routeId, status } = req.body;
    if (!vehicleNumber || !driverName) {
      return res.status(400).json({ error: 'Vehicle number and Driver name are required.' });
    }

    const lorry = await prisma.lorry.create({
      data: {
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        driverName: driverName.trim(),
        driverPhone: driverPhone?.trim() || null,
        routeId: routeId || null,
        status: status || 'ACTIVE'
      },
      include: { route: true }
    });
    res.json(lorry);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update Lorry details (driver name, vehicle plate number, route, phone, status)
app.put('/api/lorries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vehicleNumber, driverName, driverPhone, routeId, status } = req.body;

    const data: any = {};
    if (vehicleNumber !== undefined && vehicleNumber.trim() !== '') {
      data.vehicleNumber = vehicleNumber.trim().toUpperCase();
    }
    if (driverName !== undefined && driverName.trim() !== '') {
      data.driverName = driverName.trim();
    }
    if (driverPhone !== undefined) {
      data.driverPhone = driverPhone.trim();
    }
    if (routeId !== undefined) {
      data.routeId = routeId || null;
    }
    if (status !== undefined) {
      data.status = status;
    }

    const updated = await prisma.lorry.update({
      where: { id },
      data,
      include: {
        route: true,
        lorryStocks: { include: { product: true } }
      }
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
        items: { include: { product: true } },
        expenses: true
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
        const freeQty = parseInt(item.freeQuantity, 10) || 0;
        if (isNaN(qty) || qty <= 0) continue;

        const totalNeeded = qty + (freeQty > 0 ? freeQty : 0);

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

        if (availableInLorry < totalNeeded) {
          throw new Error(
            `Insufficient stock on Lorry ${lorry.vehicleNumber} for "${product.name}". Available in lorry: ${availableInLorry} ${product.unit}, bill requires: ${qty} sold + ${freeQty} free (${totalNeeded} total)`
          );
        }

        const lineTotal = product.unitPrice * qty;
        subtotal += lineTotal;

        orderItemsToCreate.push({
          productId: product.id,
          quantity: qty,
          freeQuantity: freeQty,
          unitPrice: product.unitPrice,
          lineTotal
        });

        // 1. Deduct from Lorry Floating Stock (both sold + free units)
        await tx.lorryStock.update({
          where: {
            lorryId_productId: {
              lorryId,
              productId: item.productId
            }
          },
          data: { quantity: { decrement: totalNeeded } }
        });

        // 2. Update active loading sheet sold & free quantities if exists
        if (activeLoading) {
          const loadingItem = activeLoading.items.find(li => li.productId === item.productId);
          if (loadingItem) {
            await tx.lorryLoadingItem.update({
              where: { id: loadingItem.id },
              data: {
                soldQty: { increment: qty },
                freeQty: { increment: freeQty }
              }
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
            totalFreeItems: { increment: orderItemsToCreate.reduce((a, b) => a + (b.freeQuantity || 0), 0) },
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
          const totalDispatched = itemLine.soldQty + (itemLine.freeQty || 0);
          const discrepancy = itemLine.loadedQty - (totalDispatched + returnQty);
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
        _count: { select: { orders: true, payments: true } }
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

// Record customer payment (settles credit balance owed)
app.post('/api/customers/:id/payments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      amount,
      paymentMethod,
      chequeNumber,
      bankName,
      chequeDate,
      reference,
      notes,
      collectedBy,
      lorryId
    } = req.body;

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive payment amount required.' });
    }

    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id },
      include: { route: true }
    });

    // Generate unique receipt number: RCPT-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const countToday = await prisma.customerPayment.count({
      where: {
        createdAt: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });
    const receiptNumber = `RCPT-${dateStr}-${(countToday + 1).toString().padStart(4, '0')}`;

    // Execute in transaction: create payment receipt & decrement customer balance
    const [payment, updatedCustomer] = await prisma.$transaction([
      prisma.customerPayment.create({
        data: {
          receiptNumber,
          customerId: id,
          amount: payAmount,
          paymentMethod: paymentMethod || 'CASH',
          chequeNumber: chequeNumber?.trim() || null,
          bankName: bankName?.trim() || null,
          chequeDate: chequeDate ? new Date(chequeDate) : null,
          reference: reference?.trim() || null,
          notes: notes?.trim() || null,
          collectedBy: collectedBy?.trim() || null,
          lorryId: lorryId || null
        },
        include: {
          customer: true,
          lorry: true
        }
      }),
      prisma.customer.update({
        where: { id },
        data: {
          outstandingBalance: { decrement: payAmount }
        },
        include: { route: true }
      })
    ]);

    res.status(201).json({
      message: `Payment of ${payAmount} recorded for ${customer.name}. Receipt: ${receiptNumber}.`,
      payment,
      customer: updatedCustomer
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// List customer payment receipts
app.get('/api/customers/:id/payments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payments = await prisma.customerPayment.findMany({
      where: { customerId: id },
      include: { lorry: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Void / Delete customer payment (restores credit balance)
app.delete('/api/customer-payments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payment = await prisma.customerPayment.findUniqueOrThrow({
      where: { id }
    });

    await prisma.$transaction([
      prisma.customer.update({
        where: { id: payment.customerId },
        data: {
          outstandingBalance: { increment: payment.amount }
        }
      }),
      prisma.customerPayment.delete({
        where: { id }
      })
    ]);

    res.json({
      message: `Payment receipt ${payment.receiptNumber} voided. Customer balance restored by ${payment.amount}.`
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
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

// Create counter POS order (Direct warehouse sale for Walk-in or direct customers)
app.post('/api/orders', async (req: Request, res: Response) => {
  const {
    customerId,
    walkInName,
    walkInPhone,
    paperBillNumber,
    items,
    notes,
    paymentStatus,
    paymentMethod,
    cashReceived,
    lorryId
  } = req.body;

  if (lorryId) {
    // Forward to lorry bill entry logic
    return res.redirect(307, `/api/lorries/${lorryId}/bills`);
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one line item is required for the bill.' });
  }

  try {
    const newOrder = await prisma.$transaction(async (tx) => {
      let customer;
      if (!customerId || customerId === 'walk-in' || customerId === 'WALK-IN') {
        customer = await tx.customer.findUnique({ where: { code: 'WALK-IN' } });
        if (!customer) {
          customer = await tx.customer.create({
            data: {
              code: 'WALK-IN',
              name: walkInName ? `Walk-in: ${walkInName.trim()}` : 'Walk-in Cash Customer',
              companyName: 'Counter Customer',
              phone: walkInPhone?.trim() || '—',
              deliveryAddress: 'Direct Warehouse Sales Counter',
              city: 'Warehouse Counter',
              pricingTier: 'STANDARD',
              discountPercentage: 0.0,
              creditLimit: 0,
              outstandingBalance: 0
            }
          });
        }
      } else {
        customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
      }

      let subtotal = 0;
      let totalBilledUnits = 0;
      let totalFreeUnits = 0;
      const orderItemsToCreate = [];

      for (const item of items) {
        const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
        const qty = parseInt(item.quantity, 10) || 0;
        const freeQty = parseInt(item.freeQuantity, 10) || 0;
        const totalNeeded = qty + freeQty;

        if (qty <= 0 && freeQty <= 0) continue;

        if (product.currentStock < totalNeeded) {
          throw new Error(
            `Insufficient warehouse stock for "${product.name}". Available in warehouse: ${product.currentStock} ${product.unit}, required: ${qty} sold + ${freeQty} free (${totalNeeded} total)`
          );
        }

        const lineTotal = product.unitPrice * qty;
        subtotal += lineTotal;
        totalBilledUnits += qty;
        totalFreeUnits += freeQty;

        orderItemsToCreate.push({
          productId: product.id,
          quantity: qty,
          freeQuantity: freeQty,
          unitPrice: product.unitPrice,
          lineTotal
        });

        // Deduct from Warehouse Main Stock
        await tx.product.update({
          where: { id: product.id },
          data: { currentStock: { decrement: totalNeeded } }
        });
      }

      if (orderItemsToCreate.length === 0) {
        throw new Error('All bill item quantities are zero.');
      }

      const discountPercentage = customer.discountPercentage || 0;
      const discountAmount = (subtotal * discountPercentage) / 100;
      const netTotal = subtotal - discountAmount;

      const paidAmount = parseFloat(cashReceived !== undefined && cashReceived !== '' ? cashReceived : (paymentMethod === 'CASH' ? netTotal : 0));
      const calculatedPaymentStatus = paymentStatus || (paidAmount >= netTotal ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID'));

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
          paperBillNumber: paperBillNumber?.trim() || null,
          customerId: customer.id,
          lorryId: null, // Direct warehouse counter sale
          routeId: customer.routeId || null,
          status: 'DELIVERED',
          paymentStatus: calculatedPaymentStatus,
          paymentMethod: paymentMethod || 'CASH',
          subtotal,
          discountAmount,
          taxAmount: 0.0,
          netTotal,
          cashReceived: paidAmount,
          notes: notes?.trim() || (walkInName ? `Walk-in: ${walkInName}` : 'Warehouse Direct Counter Sale'),
          items: {
            create: orderItemsToCreate
          }
        },
        include: {
          customer: true,
          items: { include: { product: true } }
        }
      });

      // Record Stock Movement Outbound
      for (const item of orderItemsToCreate) {
        const totalOut = item.quantity + (item.freeQuantity || 0);
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'OUTBOUND',
            quantity: -totalOut,
            referenceId: createdOrder.orderNumber,
            notes: `Counter Sale ${createdOrder.orderNumber} to ${customer.name}${item.freeQuantity ? ` (${item.freeQuantity} free promo)` : ''}`
          }
        });
      }

      // If credit given and customer is an account holder
      if (calculatedPaymentStatus !== 'PAID' && customer.code !== 'WALK-IN') {
        const remainingCredit = netTotal - paidAmount;
        if (remainingCredit > 0) {
          await tx.customer.update({
            where: { id: customer.id },
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

    const [periodOrders, allProducts, customerBalances, lorries, periodExpenses, customerPaymentsPeriod] = await Promise.all([
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
            include: { items: true, expenses: true }
          }
        }
      }),
      prisma.expense.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      prisma.customerPayment.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      })
    ]);

    const lowStockProducts = allProducts.filter(p => p.currentStock <= p.minStockAlert);
    const validOrders = periodOrders.filter(o => o.status !== 'CANCELLED');
    const revenueToday = validOrders.reduce((acc, order) => acc + order.netTotal, 0);
    const cashToday = validOrders.reduce((acc, order) => acc + order.cashReceived, 0);
    const creditToday = revenueToday - cashToday;
    const expensesToday = periodExpenses.reduce((acc, exp) => acc + exp.amount, 0);
    const netProfitToday = revenueToday - expensesToday;
    const creditCollectionsToday = (customerPaymentsPeriod || []).reduce((acc: number, p: any) => acc + p.amount, 0);

    // Lorry fleet status breakdown
    const fleetStatus = lorries.map(l => {
      const activeLoading = l.loadings[0];
      const floatingStockUnits = l.lorryStocks.reduce((a, b) => a + b.quantity, 0);
      const lorryExpenses = periodExpenses.filter(e => e.lorryId === l.id);
      const todayExpenses = lorryExpenses.reduce((acc, e) => acc + e.amount, 0);

      return {
        id: l.id,
        vehicleNumber: l.vehicleNumber,
        driverName: l.driverName,
        routeName: l.route?.name || 'Unassigned',
        status: activeLoading ? (activeLoading.status === 'SETTLED' ? 'SETTLED' : 'ACTIVE') : 'READY_TO_LOAD',
        floatingStockUnits,
        todaySales: activeLoading?.totalSalesAmount || 0,
        todayCash: activeLoading?.cashCollected || 0,
        todayExpenses
      };
    });

    res.json({
      revenueToday,
      cashToday,
      creditToday,
      expensesToday,
      netProfitToday,
      creditCollectionsToday,
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

// Profit and Loss Statement with full financial breakdown & date filtering
app.get('/api/reports/profit-and-loss', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const startDate = from ? new Date(from as string) : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = to ? new Date(to as string) : new Date(new Date().setHours(23, 59, 59, 999));

    const [orders, lorries, periodExpenses] = await Promise.all([
      prisma.order.findMany({
        where: {
          status: { not: 'CANCELLED' },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          items: {
            include: { product: true }
          },
          customer: true,
          lorry: {
            include: { route: true }
          },
          route: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.lorry.findMany({
        include: { route: true }
      }),
      prisma.expense.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        include: { lorry: true }
      })
    ]);

    let grossRevenue = 0;
    let discounts = 0;
    let netRevenue = 0;
    let cogs = 0;
    let freeIssueCost = 0;
    let totalUnitsSold = 0;
    let totalFreeUnits = 0;
    let cashCollected = 0;

    // Track product-level breakdown
    const productStatsMap = new Map<string, {
      productId: string;
      name: string;
      sku: string;
      category: string;
      unit: string;
      unitPrice: number;
      costPrice: number;
      unitsSold: number;
      unitsFree: number;
      revenue: number;
      cogs: number;
      freeCost: number;
      totalCost: number;
      grossProfit: number;
      margin: number;
    }>();

    // Track channel breakdown
    const channelMap = new Map<string, {
      id: string;
      channelName: string;
      subtext: string;
      billsCount: number;
      netRevenue: number;
      cogs: number;
      freeIssueCost: number;
      totalCost: number;
      grossProfit: number;
      margin: number;
    }>();

    // Initialize lorries in channel map
    for (const lorry of lorries) {
      channelMap.set(lorry.id, {
        id: lorry.id,
        channelName: lorry.vehicleNumber,
        subtext: `${lorry.driverName} • ${lorry.route?.name || 'Assigned Route'}`,
        billsCount: 0,
        netRevenue: 0,
        cogs: 0,
        freeIssueCost: 0,
        totalCost: 0,
        grossProfit: 0,
        margin: 0
      });
    }

    // Warehouse direct counter channel
    const COUNTER_CHANNEL_ID = 'warehouse-counter';
    channelMap.set(COUNTER_CHANNEL_ID, {
      id: COUNTER_CHANNEL_ID,
      channelName: 'Warehouse Sales Counter',
      subtext: 'Direct Counter & Walk-in Cash Sales',
      billsCount: 0,
      netRevenue: 0,
      cogs: 0,
      freeIssueCost: 0,
      totalCost: 0,
      grossProfit: 0,
      margin: 0
    });

    // Daily breakdown map
    const dailyMap = new Map<string, {
      date: string;
      revenue: number;
      cost: number;
      profit: number;
      margin: number;
    }>();

    for (const order of orders) {
      grossRevenue += order.subtotal;
      discounts += order.discountAmount;
      netRevenue += order.netTotal;
      cashCollected += order.cashReceived;

      const channelKey = order.lorryId || COUNTER_CHANNEL_ID;
      const channel = channelMap.get(channelKey);
      if (channel) {
        channel.billsCount += 1;
        channel.netRevenue += order.netTotal;
      }

      const dateKey = order.createdAt.toISOString().slice(0, 10);
      let dayStat = dailyMap.get(dateKey);
      if (!dayStat) {
        dayStat = { date: dateKey, revenue: 0, cost: 0, profit: 0, margin: 0 };
        dailyMap.set(dateKey, dayStat);
      }
      dayStat.revenue += order.netTotal;

      for (const item of order.items) {
        const prod = item.product;
        const soldQty = item.quantity;
        const freeQty = item.freeQuantity || 0;
        const itemCogs = soldQty * prod.costPrice;
        const itemFreeCost = freeQty * prod.costPrice;
        const itemLineTotal = item.lineTotal;

        cogs += itemCogs;
        freeIssueCost += itemFreeCost;
        totalUnitsSold += soldQty;
        totalFreeUnits += freeQty;

        if (channel) {
          channel.cogs += itemCogs;
          channel.freeIssueCost += itemFreeCost;
          channel.totalCost += (itemCogs + itemFreeCost);
        }

        dayStat.cost += (itemCogs + itemFreeCost);

        // Product map
        let prodStat = productStatsMap.get(prod.id);
        if (!prodStat) {
          prodStat = {
            productId: prod.id,
            name: prod.name,
            sku: prod.sku,
            category: prod.category,
            unit: prod.unit,
            unitPrice: prod.unitPrice,
            costPrice: prod.costPrice,
            unitsSold: 0,
            unitsFree: 0,
            revenue: 0,
            cogs: 0,
            freeCost: 0,
            totalCost: 0,
            grossProfit: 0,
            margin: 0
          };
          productStatsMap.set(prod.id, prodStat);
        }

        prodStat.unitsSold += soldQty;
        prodStat.unitsFree += freeQty;
        prodStat.revenue += itemLineTotal;
        prodStat.cogs += itemCogs;
        prodStat.freeCost += itemFreeCost;
        prodStat.totalCost += (itemCogs + itemFreeCost);
      }
    }

    const totalCostOfSales = cogs + freeIssueCost;
    const grossProfit = netRevenue - totalCostOfSales;
    const grossProfitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
    const markupPercentage = totalCostOfSales > 0 ? (grossProfit / totalCostOfSales) * 100 : 0;
    const creditReceivables = Math.max(0, netRevenue - cashCollected);

    // Process Operating Expenditures (OPEX)
    const totalExpenses = periodExpenses.reduce((acc, exp) => acc + exp.amount, 0);
    const netOperatingProfit = grossProfit - totalExpenses;
    const netProfitMargin = netRevenue > 0 ? (netOperatingProfit / netRevenue) * 100 : 0;

    let fleetExpenses = 0;
    let overheadExpenses = 0;
    const expenseCategoryMap = new Map<string, { category: string; amount: number; count: number }>();

    for (const exp of periodExpenses) {
      let catStat = expenseCategoryMap.get(exp.category);
      if (!catStat) {
        catStat = { category: exp.category, amount: 0, count: 0 };
        expenseCategoryMap.set(exp.category, catStat);
      }
      catStat.amount += exp.amount;
      catStat.count += 1;

      if (exp.lorryId) {
        fleetExpenses += exp.amount;
        const channel = channelMap.get(exp.lorryId);
        if (channel) {
          (channel as any).expenses = ((channel as any).expenses || 0) + exp.amount;
        }
      } else {
        overheadExpenses += exp.amount;
      }

      // Add expense to daily breakdown
      const dateKey = exp.date.toISOString().slice(0, 10);
      let dayStat = dailyMap.get(dateKey);
      if (!dayStat) {
        dayStat = { date: dateKey, revenue: 0, cost: 0, profit: 0, margin: 0 };
        dailyMap.set(dateKey, dayStat);
      }
      (dayStat as any).expenses = ((dayStat as any).expenses || 0) + exp.amount;
    }

    // Compute margins and net channel profit for channels
    const channelBreakdown = Array.from(channelMap.values()).map(c => {
      c.grossProfit = c.netRevenue - c.totalCost;
      c.margin = c.netRevenue > 0 ? (c.grossProfit / c.netRevenue) * 100 : 0;
      const channelExp = (c as any).expenses || 0;
      (c as any).expenses = channelExp;
      (c as any).netProfit = c.grossProfit - channelExp;
      return c;
    });

    // Compute margins for products & sort by profit descending
    const productBreakdown = Array.from(productStatsMap.values()).map(p => {
      p.grossProfit = p.revenue - p.totalCost;
      p.margin = p.revenue > 0 ? (p.grossProfit / p.revenue) * 100 : 0;
      return p;
    }).sort((a, b) => b.grossProfit - a.grossProfit);

    // Daily breakdown sorted by date
    const dailyBreakdown = Array.from(dailyMap.values()).map(d => {
      d.profit = d.revenue - d.cost;
      d.margin = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0;
      return d;
    }).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      },
      summary: {
        grossRevenue,
        discounts,
        netRevenue,
        cogs,
        freeIssueCost,
        totalCostOfSales,
        grossProfit,
        grossProfitMargin,
        markupPercentage,
        totalUnitsSold,
        totalFreeUnits,
        totalOrdersCount: orders.length,
        cashCollected,
        creditReceivables,
        totalExpenses,
        netOperatingProfit,
        netProfitMargin,
        fleetExpenses,
        overheadExpenses
      },
      expensesByCategory: Array.from(expenseCategoryMap.values()),
      channelBreakdown,
      productBreakdown,
      dailyBreakdown
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 9. EXPENSES & OPERATIONAL EXPENDITURES (OPEX)
// ========================================================

// List expenses with date, category, lorry, payment method & search filters
app.get('/api/expenses', async (req: Request, res: Response) => {
  try {
    const { from, to, category, lorryId, paymentMethod, search } = req.query;
    const where: any = {};

    if (from || to) {
      where.date = {
        gte: from ? new Date(from as string) : undefined,
        lte: to ? new Date(to as string) : undefined
      };
    }

    if (category && typeof category === 'string' && category !== 'ALL') {
      where.category = category;
    }

    if (lorryId && typeof lorryId === 'string' && lorryId !== 'ALL') {
      where.lorryId = lorryId === 'OVERHEAD' ? null : lorryId;
    }

    if (paymentMethod && typeof paymentMethod === 'string' && paymentMethod !== 'ALL') {
      where.paymentMethod = paymentMethod;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search } },
        { expenseNumber: { contains: search } },
        { referenceNumber: { contains: search } },
        { paidTo: { contains: search } },
        { notes: { contains: search } }
      ];
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        lorry: {
          include: { route: true }
        },
        loading: true
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
    });

    res.json(expenses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Expense Summary KPIs & Category Breakdown
app.get('/api/expenses/summary', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const startDate = from ? new Date(from as string) : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = to ? new Date(to as string) : new Date(new Date().setHours(23, 59, 59, 999));

    const [expenses, lorries] = await Promise.all([
      prisma.expense.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        include: { lorry: true }
      }),
      prisma.lorry.findMany()
    ]);

    const totalAmount = expenses.reduce((acc, exp) => acc + exp.amount, 0);
    const totalCount = expenses.length;

    let fleetExpenses = 0;
    let overheadExpenses = 0;

    const categoryMap = new Map<string, { category: string; amount: number; count: number }>();
    const lorryMap = new Map<string, { lorryId: string; vehicleNumber: string; driverName: string; amount: number; count: number }>();
    const paymentMap = new Map<string, number>();

    for (const l of lorries) {
      lorryMap.set(l.id, {
        lorryId: l.id,
        vehicleNumber: l.vehicleNumber,
        driverName: l.driverName,
        amount: 0,
        count: 0
      });
    }

    for (const exp of expenses) {
      // By category
      let cat = categoryMap.get(exp.category);
      if (!cat) {
        cat = { category: exp.category, amount: 0, count: 0 };
        categoryMap.set(exp.category, cat);
      }
      cat.amount += exp.amount;
      cat.count += 1;

      // By lorry / fleet
      if (exp.lorryId) {
        fleetExpenses += exp.amount;
        let lStat = lorryMap.get(exp.lorryId);
        if (lStat) {
          lStat.amount += exp.amount;
          lStat.count += 1;
        }
      } else {
        overheadExpenses += exp.amount;
      }

      // By payment method
      const currentPm = paymentMap.get(exp.paymentMethod) || 0;
      paymentMap.set(exp.paymentMethod, currentPm + exp.amount);
    }

    res.json({
      totalAmount,
      totalCount,
      fleetExpenses,
      overheadExpenses,
      byCategory: Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount),
      byLorry: Array.from(lorryMap.values()),
      byPaymentMethod: Array.from(paymentMap.entries()).map(([paymentMethod, amount]) => ({
        paymentMethod,
        amount
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single expense
app.get('/api/expenses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        lorry: { include: { route: true } },
        loading: true
      }
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense record not found.' });
    }

    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record a new Expense
app.post('/api/expenses', async (req: Request, res: Response) => {
  try {
    const {
      category,
      title,
      amount,
      date,
      paymentMethod,
      referenceNumber,
      paidTo,
      notes,
      lorryId,
      loadingId
    } = req.body;

    if (!category || !title || amount === undefined || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid category, title, and positive amount are required.' });
    }

    const expenseDate = date ? new Date(date) : new Date();
    const todayStr = expenseDate.toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await prisma.expense.count({
      where: {
        date: {
          gte: new Date(new Date(expenseDate).setHours(0, 0, 0, 0)),
          lte: new Date(new Date(expenseDate).setHours(23, 59, 59, 999))
        }
      }
    });
    const expenseNumber = `EXP-${todayStr}-${(countToday + 1).toString().padStart(4, '0')}`;

    // Auto-link active loading if lorryId is specified without loadingId
    let finalLoadingId = loadingId || null;
    if (lorryId && !finalLoadingId) {
      const activeLoading = await prisma.lorryLoading.findFirst({
        where: {
          lorryId,
          status: { in: ['LOADED', 'IN_TRANSIT'] }
        },
        orderBy: { date: 'desc' }
      });
      if (activeLoading) {
        finalLoadingId = activeLoading.id;
      }
    }

    const created = await prisma.expense.create({
      data: {
        expenseNumber,
        category: category.trim().toUpperCase(),
        title: title.trim(),
        amount: parseFloat(amount),
        date: expenseDate,
        paymentMethod: paymentMethod || 'CASH',
        referenceNumber: referenceNumber?.trim() || null,
        paidTo: paidTo?.trim() || null,
        notes: notes?.trim() || null,
        lorryId: lorryId || null,
        loadingId: finalLoadingId
      },
      include: {
        lorry: { include: { route: true } },
        loading: true
      }
    });

    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update an Expense
app.put('/api/expenses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      category,
      title,
      amount,
      date,
      paymentMethod,
      referenceNumber,
      paidTo,
      notes,
      lorryId,
      loadingId
    } = req.body;

    const data: any = {};
    if (category !== undefined) data.category = category.trim().toUpperCase();
    if (title !== undefined) data.title = title.trim();
    if (amount !== undefined) {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number.' });
      }
      data.amount = numAmount;
    }
    if (date !== undefined) data.date = new Date(date);
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod;
    if (referenceNumber !== undefined) data.referenceNumber = referenceNumber?.trim() || null;
    if (paidTo !== undefined) data.paidTo = paidTo?.trim() || null;
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (lorryId !== undefined) data.lorryId = lorryId || null;
    if (loadingId !== undefined) data.loadingId = loadingId || null;

    const updated = await prisma.expense.update({
      where: { id },
      data,
      include: {
        lorry: { include: { route: true } },
        loading: true
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete an Expense
app.delete('/api/expenses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.expense.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Expense record deleted.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 8. MANUFACTURING, BOM RECIPES & PRODUCTION RUNS
// ========================================================

// 1. List recipes with product and components
app.get('/api/manufacturing/recipes', async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const where: any = {};
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { product: { name: { contains: search } } }
      ];
    }

    const recipes = await prisma.recipe.findMany({
      where,
      include: {
        product: true,
        items: {
          include: { componentProduct: true }
        },
        _count: { select: { productionRuns: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(recipes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get single recipe by ID
app.get('/api/manufacturing/recipes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recipe = await prisma.recipe.findUniqueOrThrow({
      where: { id },
      include: {
        product: true,
        items: {
          include: { componentProduct: true }
        },
        productionRuns: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    res.json(recipe);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// 3. Create a new BOM Recipe
app.post('/api/manufacturing/recipes', async (req: Request, res: Response) => {
  try {
    const { name, productId, outputYield, estimatedOverheadCost, notes, items } = req.body;

    if (!name || !productId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Recipe name, target finished product, and at least 1 raw material / component are required.' });
    }

    const count = await prisma.recipe.count();
    const code = `BOM-${(count + 1).toString().padStart(3, '0')}`;

    const recipe = await prisma.recipe.create({
      data: {
        code,
        name: name.trim(),
        productId,
        outputYield: parseInt(outputYield || 1, 10),
        estimatedOverheadCost: parseFloat(estimatedOverheadCost || 0),
        notes: notes?.trim() || null,
        items: {
          create: items.map((it: any) => ({
            componentProductId: it.componentProductId,
            quantity: parseFloat(it.quantity || 1),
            notes: it.notes?.trim() || null
          }))
        }
      },
      include: {
        product: true,
        items: {
          include: { componentProduct: true }
        }
      }
    });

    res.status(201).json(recipe);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 4. Update a BOM Recipe
app.put('/api/manufacturing/recipes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, productId, outputYield, estimatedOverheadCost, notes, items } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (productId !== undefined) data.productId = productId;
    if (outputYield !== undefined) data.outputYield = parseInt(outputYield, 10);
    if (estimatedOverheadCost !== undefined) data.estimatedOverheadCost = parseFloat(estimatedOverheadCost);
    if (notes !== undefined) data.notes = notes?.trim() || null;

    if (items && Array.isArray(items)) {
      // Replace items
      await prisma.recipeItem.deleteMany({ where: { recipeId: id } });
      data.items = {
        create: items.map((it: any) => ({
          componentProductId: it.componentProductId,
          quantity: parseFloat(it.quantity || 1),
          notes: it.notes?.trim() || null
        }))
      };
    }

    const updated = await prisma.recipe.update({
      where: { id },
      data,
      include: {
        product: true,
        items: {
          include: { componentProduct: true }
        }
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 5. Delete a Recipe
app.delete('/api/manufacturing/recipes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.recipe.delete({ where: { id } });
    res.json({ success: true, message: 'Recipe removed successfully.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 6. List Production Runs
app.get('/api/manufacturing/production-runs', async (req: Request, res: Response) => {
  try {
    const { recipeId, status, from, to } = req.query;
    const where: any = {};
    if (recipeId && typeof recipeId === 'string' && recipeId !== 'ALL') where.recipeId = recipeId;
    if (status && typeof status === 'string' && status !== 'ALL') where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const runs = await prisma.productionRun.findMany({
      where,
      include: {
        recipe: {
          include: { product: true }
        },
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(runs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Get single Production Run
app.get('/api/manufacturing/production-runs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const run = await prisma.productionRun.findUniqueOrThrow({
      where: { id },
      include: {
        recipe: {
          include: { product: true }
        },
        items: {
          include: { product: true }
        }
      }
    });
    res.json(run);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// 8. Create & Execute a Production Run
app.post('/api/manufacturing/production-runs', async (req: Request, res: Response) => {
  try {
    const {
      recipeId,
      targetQuantity,
      actualQuantity,
      overheadCost,
      producedBy,
      notes,
      completeImmediately = true
    } = req.body;

    const plannedQty = parseInt(targetQuantity, 10);
    if (isNaN(plannedQty) || plannedQty <= 0) {
      return res.status(400).json({ error: 'Valid positive target quantity required.' });
    }

    const recipe = await prisma.recipe.findUniqueOrThrow({
      where: { id: recipeId },
      include: {
        product: true,
        items: {
          include: { componentProduct: true }
        }
      }
    });

    const outputQty = actualQuantity !== undefined ? parseInt(actualQuantity, 10) : plannedQty;
    const outputYield = recipe.outputYield || 1;
    const batchMultiplier = outputQty / outputYield;

    // Generate batch number BATCH-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await prisma.productionRun.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }
    });
    const batchNumber = `BATCH-${dateStr}-${(countToday + 1).toString().padStart(4, '0')}`;

    // Calculate component quantities and costs
    let totalRawMaterialCost = 0;
    const itemsData = recipe.items.map((item) => {
      const requiredQty = item.quantity * batchMultiplier;
      const unitCost = item.componentProduct.costPrice || 0;
      const lineCost = requiredQty * unitCost;
      totalRawMaterialCost += lineCost;

      return {
        productId: item.componentProductId,
        plannedQuantity: requiredQty,
        actualQuantity: requiredQty,
        unitCost,
        lineCost
      };
    });

    const additionalOverhead = parseFloat(overheadCost !== undefined ? overheadCost : (recipe.estimatedOverheadCost * batchMultiplier)) || 0;
    const totalProductionCost = totalRawMaterialCost + additionalOverhead;
    const unitCost = outputQty > 0 ? (totalProductionCost / outputQty) : 0;

    const runStatus = completeImmediately ? 'COMPLETED' : 'IN_PROGRESS';

    // Execute in transaction
    const productionRun = await prisma.$transaction(async (tx) => {
      // Create ProductionRun record
      const run = await tx.productionRun.create({
        data: {
          batchNumber,
          recipeId,
          targetQuantity: plannedQty,
          actualQuantity: completeImmediately ? outputQty : 0,
          status: runStatus,
          totalRawMaterialCost,
          overheadCost: additionalOverhead,
          totalProductionCost,
          unitCost,
          producedBy: producedBy?.trim() || null,
          notes: notes?.trim() || null,
          startDate: today,
          completedAt: completeImmediately ? today : null,
          items: {
            create: itemsData
          }
        },
        include: {
          recipe: { include: { product: true } },
          items: { include: { product: true } }
        }
      });

      if (completeImmediately) {
        // 1. Deduct raw materials from warehouse stock
        for (const item of itemsData) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: { decrement: Math.round(item.actualQuantity) }
            }
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'MANUFACTURING_CONSUMPTION',
              quantity: -Math.round(item.actualQuantity),
              referenceId: batchNumber,
              notes: `Consumed in production batch ${batchNumber} for ${recipe.product.name}`
            }
          });
        }

        // 2. Add finished product to warehouse stock and update costPrice
        await tx.product.update({
          where: { id: recipe.productId },
          data: {
            currentStock: { increment: outputQty },
            costPrice: unitCost > 0 ? parseFloat(unitCost.toFixed(2)) : undefined
          }
        });

        await tx.stockMovement.create({
          data: {
            productId: recipe.productId,
            type: 'MANUFACTURING_OUTPUT',
            quantity: outputQty,
            referenceId: batchNumber,
            notes: `Manufactured ${outputQty} units in production batch ${batchNumber}`
          }
        });
      }

      return run;
    });

    res.status(201).json(productionRun);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 9. Complete an In-Progress Production Run
app.post('/api/manufacturing/production-runs/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actualQuantity, overheadCost, notes } = req.body;

    const run = await prisma.productionRun.findUniqueOrThrow({
      where: { id },
      include: {
        recipe: { include: { product: true } },
        items: { include: { product: true } }
      }
    });

    if (run.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Production run is already marked as completed.' });
    }

    const outputQty = actualQuantity !== undefined ? parseInt(actualQuantity, 10) : run.targetQuantity;
    const completedAt = new Date();

    const updatedRun = await prisma.$transaction(async (tx) => {
      // 1. Deduct raw materials
      for (const item of run.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { decrement: Math.round(item.actualQuantity) }
          }
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'MANUFACTURING_CONSUMPTION',
            quantity: -Math.round(item.actualQuantity),
            referenceId: run.batchNumber,
            notes: `Consumed in batch ${run.batchNumber}`
          }
        });
      }

      // 2. Add finished product
      await tx.product.update({
        where: { id: run.recipe.productId },
        data: {
          currentStock: { increment: outputQty },
          costPrice: run.unitCost > 0 ? parseFloat(run.unitCost.toFixed(2)) : undefined
        }
      });

      await tx.stockMovement.create({
        data: {
          productId: run.recipe.productId,
          type: 'MANUFACTURING_OUTPUT',
          quantity: outputQty,
          referenceId: run.batchNumber,
          notes: `Manufactured ${outputQty} units in batch ${run.batchNumber}`
        }
      });

      return tx.productionRun.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          actualQuantity: outputQty,
          completedAt,
          notes: notes !== undefined ? notes : run.notes
        },
        include: {
          recipe: { include: { product: true } },
          items: { include: { product: true } }
        }
      });
    });

    res.json(updatedRun);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 10. Cancel a Production Run
app.post('/api/manufacturing/production-runs/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const run = await prisma.productionRun.findUniqueOrThrow({ where: { id } });
    if (run.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot cancel an already completed production run.' });
    }

    const updated = await prisma.productionRun.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 11. Manufacturing Summary Stats
app.get('/api/manufacturing/summary', async (req: Request, res: Response) => {
  try {
    const [totalRuns, activeRecipes, completedRunsAgg] = await Promise.all([
      prisma.productionRun.count(),
      prisma.recipe.count(),
      prisma.productionRun.aggregate({
        where: { status: 'COMPLETED' },
        _sum: {
          actualQuantity: true,
          totalProductionCost: true
        }
      })
    ]);

    res.json({
      totalBatchesCount: totalRuns,
      totalUnitsManufactured: completedRunsAgg._sum.actualQuantity || 0,
      totalProductionCost: completedRunsAgg._sum.totalProductionCost || 0,
      activeRecipesCount: activeRecipes
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 8. GENERAL & BUSINESS SETTINGS
// ========================================================
const SETTINGS_FILE = path.join(__dirname, '../settings.json');

const defaultSettings = {
  companyName: 'Distributor Pro Lanka (Pvt) Ltd',
  tagline: 'Authorized Wholesale FMCG Distribution & Fleet Console',
  phone: '+94 11 234 5678 / +94 77 123 4567',
  email: 'distribution@example.com',
  address: 'No. 88, Commercial Zone, Colombo, Sri Lanka',
  registrationNumber: 'PV-84920/2022',
  invoiceFooterNote: 'Goods once delivered and acknowledged on paper slip cannot be returned without formal warehouse return authorization.',
  defaultCurrency: 'LKR',
  defaultCreditLimit: 50000,
  lowStockThreshold: 10
};

function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error reading settings file:', err);
  }
  return defaultSettings;
}

function saveSettings(settings: any) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing settings file:', err);
  }
}

app.get('/api/settings', (_req: Request, res: Response) => {
  res.json(getSettings());
});

app.put('/api/settings', (req: Request, res: Response) => {
  try {
    const current = getSettings();
    const updated = { ...current, ...req.body };
    saveSettings(updated);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
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

    // Ensure default Walk-in Customer exists
    const walkInCustomer = await prisma.customer.findUnique({ where: { code: 'WALK-IN' } });
    if (!walkInCustomer) {
      console.log('[Auto-Seed] Seeding Walk-in Cash Customer...');
      await prisma.customer.create({
        data: {
          code: 'WALK-IN',
          name: 'Walk-in Cash Customer',
          companyName: 'Counter Desk Sale',
          phone: '—',
          deliveryAddress: 'Warehouse Direct Sales Counter',
          city: 'Warehouse Counter',
          pricingTier: 'STANDARD',
          discountPercentage: 0.0,
          creditLimit: 0,
          outstandingBalance: 0
        }
      });
    }

    // Ensure default Suppliers exist
    const supplierCount = await prisma.supplier.count();
    if (supplierCount === 0) {
      console.log('[Auto-Seed] Seeding major wholesale FMCG suppliers...');
      const sup1 = await prisma.supplier.create({
        data: {
          code: 'SUP-001',
          name: 'Ceylon Tea Mills & Plantations (Pvt) Ltd',
          contactPerson: 'Rohan De Silva',
          phone: '+94 11 234 5678',
          email: 'sales@ceylonteanational.com',
          address: '45 Plantation Way, Nuwara Eliya',
          city: 'Nuwara Eliya',
          paymentTerms: 'NET 30',
          outstandingBalance: 45000.0
        }
      });

      const sup2 = await prisma.supplier.create({
        data: {
          code: 'SUP-002',
          name: 'Lanka Pure Beverage Bottlers Ltd',
          contactPerson: 'Kanishka Perera',
          phone: '+94 11 987 6543',
          email: 'orders@lankapure.lk',
          address: '12 Industrial Zone, Biyagama',
          city: 'Biyagama',
          paymentTerms: 'NET 15',
          outstandingBalance: 0.0
        }
      });

      const sup3 = await prisma.supplier.create({
        data: {
          code: 'SUP-003',
          name: 'Maha Oya Sugar & Grain Refineries',
          contactPerson: 'Dinesh Wickramasinghe',
          phone: '+94 25 222 3344',
          email: 'distribution@mahaoyarefineries.com',
          address: '88 Agri-Industrial Park, Anuradhapura',
          city: 'Anuradhapura',
          paymentTerms: 'NET 30',
          outstandingBalance: 120000.0
        }
      });

      // Link products to suppliers
      const allProds = await prisma.product.findMany();
      for (const prod of allProds) {
        if (prod.sku.startsWith('BEV-001')) {
          await prisma.product.update({ where: { id: prod.id }, data: { supplierId: sup1.id } });
        } else if (prod.sku.startsWith('BEV-002')) {
          await prisma.product.update({ where: { id: prod.id }, data: { supplierId: sup2.id } });
        } else {
          await prisma.product.update({ where: { id: prod.id }, data: { supplierId: sup3.id } });
        }
      }
    }

    // 6. Ensure Sample Operating Expenses exist for realistic demo
    const expenseCount = await prisma.expense.count();
    if (expenseCount === 0) {
      console.log('[Auto-Seed] Seeding initial operating and fleet expenses...');
      const lorriesList = await prisma.lorry.findMany();
      const l1 = lorriesList[0];
      const l2 = lorriesList[1];

      await prisma.expense.createMany({
        data: [
          {
            expenseNumber: 'EXP-20261031-0001',
            category: 'FUEL',
            title: 'Diesel Fuel - Full Tank Refuel',
            amount: 14500.0,
            date: new Date(),
            paymentMethod: 'CASH',
            referenceNumber: 'PETRO-4921',
            paidTo: 'Ceypetco Filling Station',
            notes: 'Morning fuel refill before dispatch',
            lorryId: l1?.id || null
          },
          {
            expenseNumber: 'EXP-20261031-0002',
            category: 'DRIVER_ALLOWANCE',
            title: 'Driver & Helper Route Meal Allowance',
            amount: 2200.0,
            date: new Date(),
            paymentMethod: 'CASH',
            referenceNumber: 'ALW-1031-01',
            paidTo: l1?.driverName || 'Sunil Perera',
            notes: 'Daily field route allowance',
            lorryId: l1?.id || null
          },
          {
            expenseNumber: 'EXP-20261031-0003',
            category: 'FUEL',
            title: 'Diesel Fuel - Route Refill',
            amount: 12800.0,
            date: new Date(),
            paymentMethod: 'CASH',
            referenceNumber: 'PETRO-4938',
            paidTo: 'IOC Service Station',
            notes: 'Route delivery diesel',
            lorryId: l2?.id || null
          },
          {
            expenseNumber: 'EXP-20261031-0004',
            category: 'UTILITIES',
            title: 'Warehouse Electricity & Cold Storage',
            amount: 18500.0,
            date: new Date(),
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'CEB-948201',
            paidTo: 'Ceylon Electricity Board',
            notes: 'Monthly distribution depot power',
            lorryId: null
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
