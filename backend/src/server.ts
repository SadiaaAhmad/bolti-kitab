/**
 * Bolti Kitab — Server Entry Point
 *
 * Starts the Fastify server, handles graceful shutdown on SIGTERM/SIGINT.
 */

import { buildApp } from './app.js';
import { config } from './config/env.js';

async function main() {
  const fastify = await buildApp();

  // ─── Start Listening ────────────────────────────────────────────────────────
  try {
    await fastify.listen({
      host: config.server.host,
      port: config.server.port,
    });
    fastify.log.info(
      `[server] Bolti Kitab backend listening on ${config.server.host}:${config.server.port}`,
    );
    fastify.log.info(`[server] Environment: ${config.server.nodeEnv}`);
  } catch (err) {
    fastify.log.error(err, '[server] Failed to start server');
    process.exit(1);
  }

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    fastify.log.info(`[server] Received ${signal} — initiating graceful shutdown...`);
    try {
      await fastify.close();
      fastify.log.info('[server] Server closed cleanly. Bye!');
      process.exit(0);
    } catch (err) {
      fastify.log.error(err, '[server] Error during shutdown');
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

main();
