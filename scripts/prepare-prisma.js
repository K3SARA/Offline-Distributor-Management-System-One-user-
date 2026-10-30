const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const dbUrl = process.env.DATABASE_URL || '';
const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_STATIC_URL);
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://') || (isRailway && !dbUrl.startsWith('file:'));

if (isPostgres) {
  console.log('[Prisma Prep] PostgreSQL detected. Setting provider = "postgresql"...');
  schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
} else {
  console.log('[Prisma Prep] SQLite / local file detected. Setting provider = "sqlite"...');
  schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'file:./distributor.db';
  }
}

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('[Prisma Prep] prisma/schema.prisma is configured and ready.');
