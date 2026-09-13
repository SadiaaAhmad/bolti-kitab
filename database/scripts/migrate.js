/**
 * Bolti Kitab (بولتی کتاب)
 * Initial Phase 1 PostgreSQL schema/migration baseline runner (Node.js).
 *
 * Usage:
 *   node database/scripts/migrate.js --status
 *   node database/scripts/migrate.js --dry-run
 *   node database/scripts/migrate.js --up
 *   node database/scripts/migrate.js --down
 *
 * Configuration:
 *   Reads connection settings from DATABASE_URL or individual DB_* environment variables.
 *   Credentials are never hardcoded in this script.
 */

const fs = require('fs');
const path = require('path');

// Optional: Parse .env file from project root if present without external dependencies
const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const config = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'bolti_kitab_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    };

const migrationsDir = path.join(__dirname, '..', 'migrations');

async function main() {
  let pg;
  try {
    pg = require('pg');
  } catch (err) {
    console.error('[NOTICE] Node module "pg" is not yet installed in node_modules.');
    console.error('To run Node migrations, run "npm install pg" or use the Python runner:');
    console.error('  python database/scripts/migrate.py --status');
    process.exit(0);
  }

  const { Client } = pg;
  const client = new Client(config);
  await client.connect();

  const arg = process.argv[2] || '--status';
  const targetInfo = process.env.DATABASE_URL ? 'DATABASE_URL' : `${config.database}@${config.host}:${config.port}`;

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const { rows } = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC;');
    const applied = rows.map((r) => r.version);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
      .sort();

    if (arg === '--status') {
      console.log(`\n--- Bolti Kitab Migration Status [${targetInfo}] ---`);
      for (const file of files) {
        const isApplied = applied.includes(file);
        console.log(`  [${isApplied ? 'APPLIED' : 'PENDING'}] ${file}`);
      }
      console.log('');
    } else if (arg === '--dry-run') {
      console.log(`\n[DRY RUN] Validating migrations against ${targetInfo}...`);
      await client.query('BEGIN');
      for (const file of files) {
        console.log(`  Validating ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        await client.query(sql);
        console.log(`  [OK] ${file} passed validation.`);
      }
      await client.query('ROLLBACK');
      console.log('[SUCCESS] All migrations passed validation. Transaction rolled back.\n');
    } else if (arg === '--up') {
      console.log(`\nApplying pending migrations to ${targetInfo}...`);
      let count = 0;
      for (const file of files) {
        if (!applied.includes(file)) {
          console.log(`  Applying ${file}...`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1);', [file]);
          await client.query('COMMIT');
          console.log(`  [SUCCESS] ${file} applied.`);
          count++;
        } else {
          console.log(`  [SKIPPED] ${file} already applied.`);
        }
      }
      console.log(`\nMigration complete. ${count} new migration(s) applied.\n`);
    } else if (arg === '--down') {
      if (applied.length === 0) {
        console.log('No applied migrations to roll back.');
        return;
      }
      const latest = applied[applied.length - 1];
      const downFile = latest.replace('.sql', '.down.sql');
      const downPath = path.join(migrationsDir, downFile);
      if (!fs.existsSync(downPath)) {
        console.error(`[ERROR] Down migration not found: ${downFile}`);
        process.exit(1);
      }
      console.log(`  Rolling back ${latest}...`);
      const sql = fs.readFileSync(downPath, 'utf-8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('DELETE FROM schema_migrations WHERE version = $1;', [latest]);
      await client.query('COMMIT');
      console.log(`  [SUCCESS] Rolled back ${latest}.\n`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`[ERROR] Migration failed: ${err.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
