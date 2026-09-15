/**
 * Bolti Kitab — Catalog Routes Plugin
 *
 * Mounts public read routes and RBAC-protected management routes for books & chapters.
 *
 * Public routes:
 *   GET /api/v1/books
 *   GET /api/v1/books/:id
 *   GET /api/v1/books/:id/chapters
 *
 * Management routes (requires editor or admin role):
 *   POST   /api/v1/books
 *   PATCH  /api/v1/books/:id
 *   POST   /api/v1/books/:id/chapters
 *   PATCH  /api/v1/books/:id/chapters/:chapterId
 */

import type { FastifyPluginAsync } from 'fastify';
import {
  listBooks,
  getBookById,
  createBook,
  updateBook,
  listChapters,
  createChapter,
  updateChapter,
} from './service.js';
import {
  listBooksSchema,
  getBookSchema,
  getChaptersSchema,
  createBookSchema,
  updateBookSchema,
  createChapterSchema,
  updateChapterSchema,
} from './schemas.js';
import type {
  ListBooksQuery,
  CreateBookInput,
  UpdateBookInput,
  CreateChapterInput,
  UpdateChapterInput,
} from './types.js';

interface BookParams {
  id: string;
}

interface ChapterParams {
  id: string;
  chapterId: string;
}

const catalogRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── GET / (List Books) ───────────────────────────────────────────────────
  fastify.get<{ Querystring: ListBooksQuery }>(
    '/',
    {
      schema: listBooksSchema,
      preHandler: [fastify.optionalAuthenticate],
    },
    async (request, reply) => {
      const result = await listBooks(request.query, request.authUser?.role);
      return reply.code(200).send(result);
    },
  );

  // ─── GET /:id (Get Book) ──────────────────────────────────────────────────
  fastify.get<{ Params: BookParams }>(
    '/:id',
    {
      schema: getBookSchema,
      preHandler: [fastify.optionalAuthenticate],
    },
    async (request, reply) => {
      try {
        const book = await getBookById(request.params.id, request.authUser?.role);
        return reply.code(200).send({ book });
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'BOOK_NOT_FOUND') {
          return reply.code(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Book not found.',
          });
        }
        throw err;
      }
    },
  );

  // ─── GET /:id/chapters (List Chapters) ────────────────────────────────────
  fastify.get<{ Params: BookParams }>(
    '/:id/chapters',
    {
      schema: getChaptersSchema,
      preHandler: [fastify.optionalAuthenticate],
    },
    async (request, reply) => {
      try {
        const result = await listChapters(request.params.id, request.authUser?.role);
        return reply.code(200).send(result);
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'BOOK_NOT_FOUND') {
          return reply.code(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Book not found.',
          });
        }
        throw err;
      }
    },
  );

  // ─── POST / (Create Book — Editor/Admin) ───────────────────────────────────
  fastify.post<{ Body: CreateBookInput }>(
    '/',
    {
      schema: createBookSchema,
      preHandler: [fastify.authenticate, fastify.requireRole('editor', 'admin')],
    },
    async (request, reply) => {
      const book = await createBook(request.body);
      return reply.code(201).send({ book });
    },
  );

  // ─── PATCH /:id (Update Book — Editor/Admin) ──────────────────────────────
  fastify.patch<{ Params: BookParams; Body: UpdateBookInput }>(
    '/:id',
    {
      schema: updateBookSchema,
      preHandler: [fastify.authenticate, fastify.requireRole('editor', 'admin')],
    },
    async (request, reply) => {
      try {
        const book = await updateBook(request.params.id, request.body);
        return reply.code(200).send({ book });
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'BOOK_NOT_FOUND') {
          return reply.code(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Book not found.',
          });
        }
        throw err;
      }
    },
  );

  // ─── POST /:id/chapters (Create Chapter — Editor/Admin) ───────────────────
  fastify.post<{ Params: BookParams; Body: CreateChapterInput }>(
    '/:id/chapters',
    {
      schema: createChapterSchema,
      preHandler: [fastify.authenticate, fastify.requireRole('editor', 'admin')],
    },
    async (request, reply) => {
      try {
        const chapter = await createChapter(request.params.id, request.body);
        return reply.code(201).send({ chapter });
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'BOOK_NOT_FOUND') {
          return reply.code(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Book not found.',
          });
        }
        if (error.code === 'TIMING_INVALID') {
          return reply.code(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: error.message,
          });
        }
        if (error.code === 'DUPLICATE_CHAPTER_NUM') {
          return reply.code(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: error.message,
          });
        }
        throw err;
      }
    },
  );

  // ─── PATCH /:id/chapters/:chapterId (Update Chapter — Editor/Admin) ───────
  fastify.patch<{ Params: ChapterParams; Body: UpdateChapterInput }>(
    '/:id/chapters/:chapterId',
    {
      schema: updateChapterSchema,
      preHandler: [fastify.authenticate, fastify.requireRole('editor', 'admin')],
    },
    async (request, reply) => {
      try {
        const chapter = await updateChapter(
          request.params.id,
          request.params.chapterId,
          request.body,
        );
        return reply.code(200).send({ chapter });
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'BOOK_NOT_FOUND' || error.code === 'CHAPTER_NOT_FOUND') {
          return reply.code(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.code === 'TIMING_INVALID') {
          return reply.code(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: error.message,
          });
        }
        if (error.code === 'DUPLICATE_CHAPTER_NUM') {
          return reply.code(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: error.message,
          });
        }
        throw err;
      }
    },
  );
};

export default catalogRoutes;
