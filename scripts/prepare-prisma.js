const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const envPath = path.join(__dirname, '../.env');

let schema = fs.readFileSync(schemaPath, 'utf8');

const dbUrl = process.env.DATABASE_URL || '';
const isRailway = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_PROJECT_ID ||
  process.env.RAILWAY_STATIC_URL ||
  process.env.RAILWAY_SERVICE_ID
);

// Determine if we should use PostgreSQL (Railway defaults to PostgreSQL)
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://') || (isRailway && !dbUrl.startsWith('file:'));

if (isPostgres) {
  console.log('[Prisma Prep] PostgreSQL detected / Railway environment. Setting provider = "postgresql"...');
  schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
} else {
  console.log('[Prisma Prep] SQLite / local file detected. Setting provider = "sqlite"...');
  schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
}

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('[Prisma Prep] prisma/schema.prisma updated.');

// Ensure a valid DATABASE_URL exists during the build phase for Prisma schema validation
if (!process.env.DATABASE_URL) {
  const fallbackUrl = isPostgres
    ? 'postgresql://postgres:postgres@localhost:5432/railway?schema=public'
    : 'file:./distributor.db';

  console.log(`[Prisma Prep] No DATABASE_URL in environment. Ensuring fallback in .env for build phase: ${fallbackUrl}`);

  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  if (!envContent.includes('DATABASE_URL=')) {
    fs.appendFileSync(envPath, `\nDATABASE_URL="${fallbackUrl}"\n`, 'utf8');
  } else if (isPostgres && envContent.includes('file:')) {
    envContent = envContent.replace(/DATABASE_URL=["'][^"']*["']/g, `DATABASE_URL="${fallbackUrl}"`);
    fs.writeFileSync(envPath, envContent, 'utf8');
  } else if (!isPostgres && envContent.includes('postgres')) {
    envContent = envContent.replace(/DATABASE_URL=["'][^"']*["']/g, `DATABASE_URL="${fallbackUrl}"`);
    fs.writeFileSync(envPath, envContent, 'utf8');
  }
}

console.log('[Prisma Prep] Configuration complete.');
