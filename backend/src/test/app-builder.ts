/**
 * Bolti Kitab — Test Application Builder
 *
 * Builds a Fastify instance configured to use the bolti_kitab_test database.
 *
 * How test isolation works:
 *   The auth service and db/pool modules use a singleton Pool. To redirect them
 *   to bolti_kitab_test, we set environment variables BEFORE importing any module
 *   that reads from process.env (via dotenv). We also override DB_NAME so the
 *   pool.ts singleton connects to the test database.
 *
 * The test instance disables the pino-pretty transport (no TTY in test runner)
 * and reduces logging verbosity.
 */

import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { TEST_DB_NAME } from './db-setup.js';

// Override DB_NAME to point at the test database BEFORE any module resolves env
// This must run at module load time, before buildApp() calls config/env.ts
process.env['DB_NAME'] = TEST_DB_NAME;

export async function buildTestApp(): Promise<FastifyInstance> {
  // buildApp() reads from config which reads from process.env at module load.
  // Since process.env['DB_NAME'] is overridden above, the pool will connect
  // to bolti_kitab_test.
  const app = await buildApp();
  return app;
}
