/**
 * Bolti Kitab — Database Migration Runner
 *
 * Applies pending SQL migration files from database/migrations/ in order.
 * Run with: npm run db:migrate
 *
 * This is a simple, zero-dependency migration runner for Phase 1.
 * Phase 2+ can introduce a formal migration library (e.g., db-migrate, Flyway).
 *
 * Migration tracking table: _migrations
 *   - id:         sequential
 *   - filename:   migration filename (unique)
 *   - applied_at: when it was applied
 */

import fs from 'node:fs';
import path from 'node:path';
import { pool, closePool } from './pool.js';

// Resolve migrations directory relative to the project root (two levels up from src/db/)
const MIGRATIONS_DIR = path.resolve(process.cwd(), '..', 'database', 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>(
    'SELECT filename FROM _migrations ORDER BY id ASC',
  );
  return new Set(result.rows.map((r) => r.filename));
}

async function applyMigration(filename: string, sql: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function run(): Promise<void> {
  console.log('[migrate] Starting migration runner...');
  console.log(`[migrate] Migrations directory: ${MIGRATIONS_DIR}`);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`[migrate] ERROR: Migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[migrate] No migration files found.');
    return;
  }

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] SKIP   ${file} (already applied)`);
      skippedCount++;
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`[migrate] APPLY  ${file}...`);
    await applyMigration(file, sql);
    console.log(`[migrate] DONE   ${file}`);
    appliedCount++;
  }

  console.log(
    `[migrate] Complete — applied: ${appliedCount}, skipped: ${skippedCount}, total: ${files.length}`,
  );
}

run()
  .catch((err) => {
    console.error('[migrate] FATAL:', err.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });
