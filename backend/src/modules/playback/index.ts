/**
 * Bolti Kitab — Playback Routes Plugin
 *
 * Routes:
 *   GET /books/:bookId                         Overview & chapter list with entitlement/progress
 *   GET /books/:bookId/chapters/:chapterId     Short-lived playback streaming authorization URL
 *   GET /books/:bookId/progress                Retrieve saved listening progress
 *   PUT /books/:bookId/progress                Update listening progress & playback position
 */

import type { FastifyPluginAsync } from 'fastify';
import * as service from './service.js';
import {
  bookParamsSchema,
  chapterParamsSchema,
  playbackOverviewResponseSchema,
  playbackTokenResponseSchema,
  updateProgressBodySchema,
  progressResponseSchema,
} from './schemas.js';
import type { UpdateProgressInput } from './types.js';

const playbackRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET /books/:bookId ──────────────────────────────────────────────────────
  fastify.get('/books/:bookId', {
    schema: {
      params: bookParamsSchema,
      response: { 200: playbackOverviewResponseSchema },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { bookId } = request.params as { bookId: string };
    const overview = await service.getPlaybackOverview(
      request.authUser.id,
      request.authUser.role,
      bookId,
    );
    return reply.send(overview);
  });

  // ── GET /books/:bookId/chapters/:chapterId ──────────────────────────────────
  fastify.get('/books/:bookId/chapters/:chapterId', {
    schema: {
      params: chapterParamsSchema,
      response: { 200: playbackTokenResponseSchema },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { bookId, chapterId } = request.params as { bookId: string; chapterId: string };
    const token = await service.getChapterPlaybackToken(
      request.authUser.id,
      request.authUser.role,
      bookId,
      chapterId,
    );
    return reply.send(token);
  });

  // ── GET /books/:bookId/progress ────────────────────────────────────────────
  fastify.get('/books/:bookId/progress', {
    schema: {
      params: bookParamsSchema,
      response: { 200: progressResponseSchema },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { bookId } = request.params as { bookId: string };
    const progress = await service.getListeningProgress(request.authUser.id, bookId);
    if (!progress) {
      const err = new Error('No listening progress found for this book.') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }
    return reply.send(progress);
  });

  // ── PUT /books/:bookId/progress ────────────────────────────────────────────
  fastify.put('/books/:bookId/progress', {
    schema: {
      params: bookParamsSchema,
      body: updateProgressBodySchema,
      response: { 200: progressResponseSchema },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const { bookId } = request.params as { bookId: string };
    const body = request.body as UpdateProgressInput;
    const progress = await service.saveListeningProgress(
      request.authUser.id,
      bookId,
      body,
    );
    return reply.send(progress);
  });
};

export default playbackRoutes;
