/**
 * Bolti Kitab — Fastify Application Factory
 *
 * Builds and returns a configured Fastify instance with:
 *   - Structured JSON logging (Pino)
 *   - Security headers (@fastify/helmet)
 *   - CORS (@fastify/cors)
 *   - Sensible error handling (@fastify/sensible)
 *   - PostgreSQL database plugin
 *   - Health check routes
 *
 * All business module routes are registered here as they are implemented.
 */

import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import { config } from './config/env.js';
import dbPlugin from './plugins/db.js';
import authPlugin from './plugins/auth.js';
import healthRoutes from './routes/health.js';
import authRoutes from './modules/auth/index.js';
import catalogRoutes from './modules/catalog/index.js';
import recordingRoutes from './modules/recordings/index.js';
import playbackRoutes from './modules/playback/index.js';
import billingRoutes from './modules/billing/index.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: config.server.logLevel,
      ...(config.server.isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            },
          }),
    },
    trustProxy: true,
    ajv: {
      customOptions: {
        strict: false,
        coerceTypes: false,
        allErrors: false,
      },
    },
  });

  // ─── Security Headers ─────────────────────────────────────────────────────
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // API — no HTML served
  });

  // ─── CORS ─────────────────────────────────────────────────────────────────
  await fastify.register(cors, {
    origin: config.cors.origin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    credentials: true,
  });

  // ─── Sensible Error Utilities ─────────────────────────────────────────────
  await fastify.register(sensible);

  // ─── Auth Plugin (authenticate + requireRole decorators) ────────────────
  await fastify.register(authPlugin);

  // ─── Database Pool ──────────────────────────────────────────────────────
  await fastify.register(dbPlugin);

  // ─── Routes ──────────────────────────────────────────────────────
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(catalogRoutes, { prefix: '/api/v1/books' });
  await fastify.register(recordingRoutes, { prefix: '/api/v1' });
  await fastify.register(playbackRoutes, { prefix: '/api/v1/playback' });
  await fastify.register(billingRoutes, { prefix: '/api/v1/billing' });

  // ─── 404 Handler ──────────────────────────────────────────────────────────
  fastify.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'Route not found',
    });
  });

  // ─── Global Error Handler ─────────────────────────────────────────────────
  fastify.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    fastify.log.error({ err: error }, 'Unhandled error');
    reply.code(statusCode).send({
      statusCode,
      error: error.name ?? 'InternalServerError',
      message: config.server.isProduction
        ? statusCode >= 500
          ? 'Internal server error'
          : error.message
        : error.message,
    });
  });

  return fastify;
}
