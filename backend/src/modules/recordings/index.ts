/**
 * Bolti Kitab — Recordings Module Route Plugin
 *
 * Routes:
 *   POST   /recording-sessions                          narrator, admin
 *   GET    /recording-sessions                          narrator (own), editor, admin
 *   GET    /recording-sessions/:sessionId               narrator (own), editor, admin
 *   POST   /recording-sessions/:sessionId/upload-token  narrator (own), admin
 *   POST   /recordings/:recordingId/confirm             narrator (own session), admin
 *   GET    /recordings/review-queue                     editor, admin
 *   PATCH  /recordings/:recordingId/approve             editor, admin
 *   PATCH  /recordings/:recordingId/reject              editor, admin
 *
 * SECURITY NOTES:
 *   - blob keys are never accepted from request bodies
 *   - clients receive blob_key from upload-token for reference; server owns identity
 *   - object existence is verified server-side before confirming any take
 */

import type { FastifyPluginAsync } from 'fastify';
import * as service from './service.js';
import type { RecordingSessionStatus } from './types.js';
import {
  createSessionBodySchema,
  sessionResponseSchema,
  listSessionsQuerySchema,
  uploadTokenResponseSchema,
  confirmTakeBodySchema,
  takeResponseSchema,
  reviewQueueQuerySchema,
  reviewQueueResponseSchema,
  rejectTakeBodySchema,
  sessionParamsSchema,
  recordingParamsSchema,
} from './schemas.js';

const recordingRoutes: FastifyPluginAsync = async (fastify) => {

  // ── POST /recording-sessions ────────────────────────────────────────────────
  fastify.post('/recording-sessions', {
    schema: {
      body: createSessionBodySchema,
      response: { 201: sessionResponseSchema },
    },
    preHandler: [
      fastify.authenticate,
      fastify.requireRole('narrator', 'admin'),
    ],
  }, async (request, reply) => {
    const body = request.body as {
      book_id: string;
      chapter_id: string;
      notes?: string;
    };
    const session = await service.createSession({
      narratorId: request.authUser.id,
      bookId:     body.book_id,
      chapterId:  body.chapter_id,
      notes:      body.notes,
    });
    return reply.code(201).send(session);
  });

  // ── GET /recording-sessions ─────────────────────────────────────────────────
  fastify.get('/recording-sessions', {
    schema: {
      querystring: listSessionsQuerySchema,
    },
    preHandler: [
      fastify.authenticate,
      fastify.requireRole('narrator', 'editor', 'admin'),
    ],
  }, async (request, reply) => {
    const query = request.query as { status?: RecordingSessionStatus };
    const sessions = await service.listSessions(
      request.authUser.id,
      request.authUser.role,
      query.status,
    );
    return reply.send(sessions);
  });

  // ── GET /recording-sessions/:sessionId ─────────────────────────────────────
  fastify.get('/recording-sessions/:sessionId', {
    schema: {
      params: sessionParamsSchema,
      response: { 200: sessionResponseSchema },
    },
    preHandler: [
      fastify.authenticate,
      fastify.requireRole('narrator', 'editor', 'admin'),
    ],
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = await service.getSession(
      sessionId,
      request.authUser.id,
      request.authUser.role,
    );
    return reply.send(session);
  });

  // ── POST /recording-sessions/:sessionId/upload-token ───────────────────────
  fastify.post('/recording-sessions/:sessionId/upload-token', {
    schema: {
      params: sessionParamsSchema,
      response: { 201: uploadTokenResponseSchema },
    },
    preHandler: [
      fastify.authenticate,
      fastify.requireRole('narrator', 'admin'),
    ],
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const tokenResponse = await service.generateUploadToken(
      sessionId,
      request.authUser.id,
      request.authUser.role,
    );
    return reply.code(201).send(tokenResponse);
  });

  // ── POST /recordings/:recordingId/confirm ───────────────────────────────────
  fastify.post('/recordings/:recordingId/confirm', {
    schema: {
      params: recordingParamsSchema,
      body: confirmTakeBodySchema,
      response: { 200: takeResponseSchema },
    },
    preHandler: [
      fastify.authenticate,
      fastify.requireRole('narrator', 'admin'),
    ],
  }, async (request, reply) => {
    const { recordingId } = request.params as { recordingId: string };
    const body = request.body as {
      duration_ms: number;
      file_size_bytes: number;
      sample_rate_hz: 22050 | 44100 | 48000;
      channels: 1 | 2;
    };
    const take = await service.confirmTake(
      recordingId,
      request.authUser.id,
      request.authUser.role,
      body,
    );
    return reply.send(take);
  });

  // ── GET /recordings/review-queue ────────────────────────────────────────────
  fastify.get('/recordings/review-queue', {
    schema: {
      querystring: reviewQueueQuerySchema,
      response: { 200: reviewQueueResponseSchema },
    },
    preHandler: [
      fastify.authenticate,
      fastify.requireRole('editor', 'admin'),
    ],
  }, async (request, reply) => {
    const query = request.query as { page?: number; limit?: number };
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;
    const result = await service.getReviewQueue(page, limit);
    return reply.send(result);
  });

  // ── PATCH /recordings/:recordingId/approve ──────────────────────────────────
  fastify.patch('/recordings/:recordingId/approve', {
    schema: {
      params: recordingParamsSchema,
      response: { 200: takeResponseSchema },
    },
    preHandler: [
      fastify.authenticate,
      fastify.requireRole('editor', 'admin'),
    ],
  }, async (request, reply) => {
    const { recordingId } = request.params as { recordingId: string };
    const take = await service.approveTake(recordingId, request.authUser.id);
    return reply.send(take);
  });

  // ── PATCH /recordings/:recordingId/reject ───────────────────────────────────
  fastify.patch('/recordings/:recordingId/reject', {
    schema: {
      params: recordingParamsSchema,
      body: rejectTakeBodySchema,
      response: { 200: takeResponseSchema },
    },
    preHandler: [
      fastify.authenticate,
      fastify.requireRole('editor', 'admin'),
    ],
  }, async (request, reply) => {
    const { recordingId } = request.params as { recordingId: string };
    const body = request.body as { review_notes: string };
    const take = await service.rejectTake(
      recordingId,
      request.authUser.id,
      { review_notes: body.review_notes },
    );
    return reply.send(take);
  });
};

export default recordingRoutes;

