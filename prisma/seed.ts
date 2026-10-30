import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial distributor data...');

  // 1. Seed Customers
  const cust1 = await prisma.customer.upsert({
    where: { code: 'CUST-001' },
    update: {},
    create: {
      code: 'CUST-001',
      name: 'Apex Supermart & Provisions',
      companyName: 'Apex Retail Ltd',
      phone: '+1 (555) 234-5678',
      deliveryAddress: '448 Central Ave, Warehouse Dock #2',
      city: 'Metro City',
      pricingTier: 'WHOLESALE',
      discountPercentage: 10.0,
      creditLimit: 15000,
      outstandingBalance: 1250.0
    }
  });

  const cust2 = await prisma.customer.upsert({
    where: { code: 'CUST-002' },
    update: {},
    create: {
      code: 'CUST-002',
      name: 'Horizon Corner Grocers',
      companyName: 'Horizon Corp',
      phone: '+1 (555) 987-6543',
      deliveryAddress: '12 West Elm Street',
      city: 'North Hills',
      pricingTier: 'STANDARD',
      discountPercentage: 0.0,
      creditLimit: 5000,
      outstandingBalance: 420.50
    }
  });

  const cust3 = await prisma.customer.upsert({
    where: { code: 'CUST-003' },
    update: {},
    create: {
      code: 'CUST-003',
      name: 'Starlight Premier Resorts & Cafe',
      companyName: 'Starlight Hospitality LLC',
      phone: '+1 (555) 345-6789',
      deliveryAddress: '88 Coastal Highway, Receiving Bay B',
      city: 'Harbor Bay',
      pricingTier: 'VIP',
      discountPercentage: 15.0,
      creditLimit: 25000,
      outstandingBalance: 3100.0
    }
  });

  // 2. Seed Products
  const prod1 = await prisma.product.upsert({
    where: { sku: 'BEV-001' },
    update: {},
    create: {
      sku: 'BEV-001',
      name: 'Organic Sparkling Spring Water (24x500ml)',
      category: 'Beverages',
      unit: 'Case',
      unitPrice: 28.50,
      costPrice: 18.00,
      currentStock: 140,
      minStockAlert: 25
    }
  });

  const prod2 = await prisma.product.upsert({
    where: { sku: 'BEV-002' },
    update: {},
    create: {
      sku: 'BEV-002',
      name: 'Artisan Cold Brew Coffee (12x330ml)',
      category: 'Beverages',
      unit: 'Case',
      unitPrice: 36.00,
      costPrice: 22.50,
      currentStock: 8, // LOW STOCK - TRIGGER ALERT
      minStockAlert: 20
    }
  });

  const prod3 = await prisma.product.upsert({
    where: { sku: 'DRY-001' },
    update: {},
    create: {
      sku: 'DRY-001',
      name: 'Premium Jasmine Rice (20kg Sack)',
      category: 'Grains & Pantry',
      unit: 'Bag',
      unitPrice: 42.00,
      costPrice: 31.00,
      currentStock: 85,
      minStockAlert: 15
    }
  });

  const prod4 = await prisma.product.upsert({
    where: { sku: 'DRY-002' },
    update: {},
    create: {
      sku: 'DRY-002',
      name: 'Extra Virgin Greek Olive Oil (4x5L)',
      category: 'Oils & Condiments',
      unit: 'Carton',
      unitPrice: 110.00,
      costPrice: 82.00,
      currentStock: 32,
      minStockAlert: 10
    }
  });

  const prod5 = await prisma.product.upsert({
    where: { sku: 'SNK-001' },
    update: {},
    create: {
      sku: 'SNK-001',
      name: 'Sea Salt & Vinegar Kettle Chips (48x50g)',
      category: 'Snacks',
      unit: 'Box',
      unitPrice: 32.00,
      costPrice: 20.00,
      currentStock: 6, // LOW STOCK
      minStockAlert: 15
    }
  });

  // 3. Initial Stock Movement Records
  await prisma.stockMovement.createMany({
    data: [
      {
        productId: prod1.id,
        type: 'INBOUND',
        quantity: 150,
        referenceId: 'PO-2026-001',
        notes: 'Initial warehouse intake'
      },
      {
        productId: prod2.id,
        type: 'INBOUND',
        quantity: 50,
        referenceId: 'PO-2026-002',
        notes: 'Supplier shipment'
      },
      {
        productId: prod3.id,
        type: 'INBOUND',
        quantity: 100,
        referenceId: 'PO-2026-003',
        notes: 'Mill delivery'
      }
    ]
  });

  // 4. Sample Recent Orders
  const order1 = await prisma.order.create({
    data: {
      orderNumber: 'ORD-20261030-0001',
      customerId: cust1.id,
      status: 'DISPATCHED',
      paymentStatus: 'UNPAID',
      subtotal: 285.00,
      discountAmount: 28.50,
      netTotal: 256.50,
      dispatchedAt: new Date(),
      notes: 'Deliver before noon at dock #2',
      items: {
        create: [
          {
            productId: prod1.id,
            quantity: 10,
            unitPrice: 28.50,
            lineTotal: 285.00
          }
        ]
      }
    }
  });

  const order2 = await prisma.order.create({
    data: {
      orderNumber: 'ORD-20261030-0002',
      customerId: cust2.id,
      status: 'PENDING',
      paymentStatus: 'PAID',
      subtotal: 154.00,
      discountAmount: 0.0,
      netTotal: 154.00,
      notes: 'Customer paid cash on order booking',
      items: {
        create: [
          {
            productId: prod2.id,
            quantity: 2,
            unitPrice: 36.00,
            lineTotal: 72.00
          },
          {
            productId: prod3.id,
            quantity: 1,
            unitPrice: 42.00,
            lineTotal: 42.00
          },
          {
            productId: prod5.id,
            quantity: 1,
            unitPrice: 32.00,
            lineTotal: 32.00
          }
        ]
      }
    }
  });

  console.log('Seed completed successfully with 3 customers, 5 products, and 2 sample orders.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
