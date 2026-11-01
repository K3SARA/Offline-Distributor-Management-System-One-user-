import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Ensuring default admin account exists...');

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    await prisma.user.create({
      data: {
        username: 'admin',
        password: 'admin123',
        fullName: 'Administrator',
        role: 'ADMIN'
      }
    });
    console.log('[Seed] Created default admin account: admin / admin123');
  } else {
    console.log('[Seed] Users already present in database. No actions taken.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
