const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const envPath = path.join(__dirname, '../.env');

let schema = fs.readFileSync(schemaPath, 'utf8');

// Check the actual DATABASE_URL environment variable
const dbUrl = (process.env.DATABASE_URL || '').trim();

// Use PostgreSQL ONLY if an actual postgresql:// connection string is provided
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

if (isPostgres) {
  console.log('[Prisma Prep] Real PostgreSQL DATABASE_URL detected. Configuring provider = "postgresql"...');
  schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
} else {
  console.log('[Prisma Prep] SQLite database selected (file:./distributor.db). Configuring provider = "sqlite"...');
  schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
}

fs.writeFileSync(schemaPath, schema, 'utf8');

// Ensure DATABASE_URL is set in .env if not provided in environment
if (!process.env.DATABASE_URL) {
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const sqliteUrl = 'file:./distributor.db';
  if (!envContent.includes('DATABASE_URL=')) {
    fs.appendFileSync(envPath, `\nDATABASE_URL="${sqliteUrl}"\n`, 'utf8');
  } else if (envContent.includes('postgres')) {
    envContent = envContent.replace(/DATABASE_URL=["'][^"']*["']/g, `DATABASE_URL="${sqliteUrl}"`);
    fs.writeFileSync(envPath, envContent, 'utf8');
  }
}

console.log('[Prisma Prep] Configuration ready.');
