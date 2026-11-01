const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function wipeAll() {
  console.log('[Database Wipe] Starting complete database purge...');

  try {
    // 1. Transaction allocations and line items
    console.log('-> Clearing Bill Payment Allocations...');
    await prisma.billPaymentAllocation.deleteMany();

    console.log('-> Clearing Customer Payments...');
    await prisma.customerPayment.deleteMany();

    console.log('-> Clearing Order Items...');
    await prisma.orderItem.deleteMany();

    console.log('-> Clearing Orders / Invoices...');
    await prisma.order.deleteMany();

    console.log('-> Clearing Lorry Loading Items...');
    await prisma.lorryLoadingItem.deleteMany();

    console.log('-> Clearing Lorry Loadings...');
    await prisma.lorryLoading.deleteMany();

    console.log('-> Clearing Purchase Order Items...');
    await prisma.purchaseOrderItem.deleteMany();

    console.log('-> Clearing Purchase Orders / GRNs...');
    await prisma.purchaseOrder.deleteMany();

    console.log('-> Clearing Expenses...');
    await prisma.expense.deleteMany();

    console.log('-> Clearing Lorry Stocks...');
    await prisma.lorryStock.deleteMany();

    console.log('-> Clearing Stock Movements...');
    await prisma.stockMovement.deleteMany();

    console.log('-> Clearing Production Run Items...');
    await prisma.productionRunItem.deleteMany();

    console.log('-> Clearing Production Runs...');
    await prisma.productionRun.deleteMany();

    console.log('-> Clearing Recipe Items...');
    await prisma.recipeItem.deleteMany();

    console.log('-> Clearing Recipes / BOMs...');
    await prisma.recipe.deleteMany();

    // 2. Master Data
    console.log('-> Clearing Customers...');
    await prisma.customer.deleteMany();

    console.log('-> Clearing Products & Inventory...');
    await prisma.product.deleteMany();

    console.log('-> Clearing Suppliers...');
    await prisma.supplier.deleteMany();

    console.log('-> Resetting Users (retaining only admin)...');
    await prisma.user.deleteMany();

    // 3. Fleet & Routes
    console.log('-> Clearing Lorries...');
    await prisma.lorry.deleteMany();

    console.log('-> Clearing Routes...');
    await prisma.route.deleteMany();

    // 4. Re-create clean default Administrator user
    console.log('-> Creating fresh default Admin account...');
    await prisma.user.create({
      data: {
        username: 'admin',
        password: 'admin123',
        fullName: 'Administrator',
        role: 'ADMIN'
      }
    });

    console.log('====================================================');
    console.log('✅ ALL DEMO/SEED DATA HAS BEEN WIPED SUCCESSFULLY!');
    console.log('   Receivables:  Rs. 0.00');
    console.log('   Expenses:     Rs. 0.00');
    console.log('   Products:     0');
    console.log('   Customers:    0');
    console.log('   Orders/Bills: 0');
    console.log('   Admin Login:  admin / admin123');
    console.log('====================================================');
  } catch (err) {
    console.error('[Database Wipe Error]', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

wipeAll();
