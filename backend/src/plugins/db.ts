/**
 * Bolti Kitab — Fastify Database Plugin
 *
 * Registers the PostgreSQL pool as a Fastify decorator so it is accessible
 * on every request via `request.server.db` or `fastify.db`.
 *
 * Also registers a `onClose` hook to drain the pool on server shutdown.
 */

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { pool, closePool } from '../db/pool.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: typeof pool;
  }
}

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('db', pool);

  fastify.addHook('onClose', async () => {
    fastify.log.info('[db] Draining PostgreSQL connection pool...');
    await closePool();
    fastify.log.info('[db] Pool drained.');
  });
};

export default fp(dbPlugin, {
  name: 'bolti-kitab-db',
  fastify: '5.x',
});
