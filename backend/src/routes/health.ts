/**
 * Bolti Kitab — Health Check Routes
 *
 * GET /health        — Liveness probe (always 200 if server is alive)
 * GET /health/db     — Readiness probe (checks PostgreSQL connectivity)
 */

import type { FastifyPluginAsync } from 'fastify';
import { checkDatabaseHealth } from '../db/pool.js';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── Liveness ───────────────────────────────────────────────────────────────
  fastify.get('/health', {
    schema: {
      tags: ['health'],
      summary: 'Liveness probe',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    return reply.code(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // ─── Readiness (Database) ────────────────────────────────────────────────────
  fastify.get('/health/db', {
    schema: {
      tags: ['health'],
      summary: 'Database readiness probe',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            database: {
              type: 'object',
              properties: {
                healthy: { type: 'boolean' },
                latencyMs: { type: 'number' },
                poolSize: { type: 'number' },
                idleCount: { type: 'number' },
                waitingCount: { type: 'number' },
                message: { type: 'string' },
              },
            },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            database: { type: 'object' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    const dbHealth = await checkDatabaseHealth();
    const statusCode = dbHealth.healthy ? 200 : 503;

    return reply.code(statusCode).send({
      status: dbHealth.healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbHealth,
    });
  });
};

export default healthRoutes;
