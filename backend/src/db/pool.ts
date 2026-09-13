/**
 * Bolti Kitab — PostgreSQL Connection Pool
 *
 * Provides a single shared pg.Pool instance for the entire backend.
 * Uses environment-based configuration with no hardcoded credentials.
 *
 * Usage:
 *   import { pool, query, withTransaction } from '../db/pool.js';
 */

import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

// ─── Pool Singleton ───────────────────────────────────────────────────────────
export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  max: config.db.pool.max,
  min: config.db.pool.min,
  idleTimeoutMillis: config.db.pool.idleTimeoutMs,
  connectionTimeoutMillis: config.db.pool.connectionTimeoutMs,
  // Enforce statement_timeout to prevent runaway queries
  statement_timeout: 30_000,
});

pool.on('error', (err) => {
  // Log unexpected idle client errors — do not crash the process
  console.error('[db:pool] Unexpected error on idle client:', err.message);
});

// ─── Simple Typed Query Helper ────────────────────────────────────────────────
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, values);
}

// ─── Transaction Helper ───────────────────────────────────────────────────────
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Health Check ─────────────────────────────────────────────────────────────
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
  poolSize: number;
  idleCount: number;
  waitingCount: number;
  message?: string;
}> {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return {
      healthy: true,
      latencyMs: Date.now() - start,
      poolSize: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
  } catch (err) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      poolSize: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
export async function closePool(): Promise<void> {
  if (!pool.ended) {
    await pool.end();
  }
}
