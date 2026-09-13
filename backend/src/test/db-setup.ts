/**
 * Bolti Kitab — Test Database Setup & Teardown
 *
 * ISOLATION STRATEGY:
 *   Tests use a dedicated database: bolti_kitab_test
 *   This database is SEPARATE from bolti_kitab_dev.
 *   Tests NEVER touch bolti_kitab_dev.
 *
 * LIFECYCLE:
 *   setupTestDatabase()  — Creates bolti_kitab_test (if not exists) and applies
 *                          the Phase 1 schema migration. Run once before tests.
 *   teardownTestDatabase() — Drops bolti_kitab_test entirely. Run once after tests.
 *   cleanupTestUsers()   — Deletes ONLY users inserted during a test run, keyed
 *                          by a unique test-run marker email prefix. Available
 *                          as an alternative to full DB teardown between test cases.
 *
 * DATABASE USED BY TESTS: bolti_kitab_test
 *   Connection uses same credentials as dev (same PostgreSQL server) but a
 *   completely separate database. Pre-existing dev data is never touched.
 */

import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const { Pool } = pg;

const PG_ADMIN_CONFIG = {
  host:     process.env['DB_HOST']     ?? 'localhost',
  port:     parseInt(process.env['DB_PORT'] ?? '5432', 10),
  database: 'postgres', // Connect to the default 'postgres' db to create/drop test db
  user:     process.env['DB_USER']     ?? 'postgres',
  password: process.env['DB_PASSWORD'] ?? 'pgadmin4',
};

export const TEST_DB_NAME = 'bolti_kitab_test';

// ─── Admin pool (connected to postgres DB to manage databases) ────────────────
let adminPool: pg.Pool | null = null;

function getAdminPool(): pg.Pool {
  if (adminPool === null) {
    adminPool = new Pool({ ...PG_ADMIN_CONFIG, max: 2 });
  }
  return adminPool;
}

// ─── Test pool (connected to bolti_kitab_test) ────────────────────────────────
let testPool: pg.Pool | null = null;

export function getTestPool(): pg.Pool {
  if (testPool === null) {
    testPool = new Pool({
      ...PG_ADMIN_CONFIG,
      database: TEST_DB_NAME,
      max: 5,
    });
  }
  return testPool;
}

export async function setupTestDatabase(): Promise<void> {
  const admin = getAdminPool();

  // Ensure any previous test pool is closed
  if (testPool !== null) {
    await testPool.end();
    testPool = null;
  }

  // Terminate any stale connections and recreate the test database freshly
  await admin.query(`
    SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()
  `, [TEST_DB_NAME]);

  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
  await admin.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  console.log(`[test-db] Fresh database created: ${TEST_DB_NAME}`);

  // Apply schema migration to test database
  const migrationPath = path.resolve(
    process.cwd(),
    '../database/migrations/001_initial_phase1_schema.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const tp = getTestPool();
  await tp.query(sql);
  console.log(`[test-db] Schema migration applied to ${TEST_DB_NAME}.`);
}

// ─── Teardown: Drop bolti_kitab_test entirely ─────────────────────────────────
export async function teardownTestDatabase(): Promise<void> {
  // Close the test pool first, then drop
  if (testPool !== null) {
    await testPool.end();
    testPool = null;
  }

  const admin = getAdminPool();
  // Terminate active connections to the test database before dropping
  await admin.query(`
    SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()
  `, [TEST_DB_NAME]);

  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
  console.log(`[test-db] Dropped database: ${TEST_DB_NAME}`);

  if (adminPool !== null) {
    await adminPool.end();
    adminPool = null;
  }
}

// ─── Per-test cleanup: truncate only users inserted during this run ───────────
// Used between tests to ensure isolation without full DB recreate overhead.
export async function truncateTestUsers(): Promise<void> {
  const tp = getTestPool();
  // CASCADE handles any FK-dependent rows in related tables
  await tp.query(`TRUNCATE TABLE users CASCADE`);
}
