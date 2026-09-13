/**
 * Bolti Kitab — Auth Routes Plugin
 *
 * Registers:
 *   POST /register  — User registration
 *   POST /login     — User login → RS256 JWT
 *   GET  /me        — Authenticated user profile
 *
 * All routes are registered under the prefix /api/v1/auth (set in app.ts).
 */

import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../config/env.js';
import { registerUser, loginUser, getCurrentUser } from './service.js';
import {
  registerRouteSchema,
  loginRouteSchema,
  meRouteSchema,
} from './schemas.js';

interface RegisterBody {
  email: string;
  password: string;
  full_name: string;
}

interface LoginBody {
  email: string;
  password: string;
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── POST /register ────────────────────────────────────────────────────────
  fastify.post<{ Body: RegisterBody }>(
    '/register',
    { schema: registerRouteSchema },
    async (request, reply) => {
      try {
        const result = await registerUser({
          email: request.body.email,
          password: request.body.password,
          full_name: request.body.full_name,
        });
        return reply.code(201).send(result);
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EMAIL_TAKEN') {
          return reply.code(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'An account with this email address already exists.',
          });
        }
        throw err;
      }
    },
  );

  // ─── POST /login ───────────────────────────────────────────────────────────
  fastify.post<{ Body: LoginBody }>(
    '/login',
    { schema: loginRouteSchema },
    async (request, reply) => {
      try {
        const result = await loginUser(
          {
            email: request.body.email,
            password: request.body.password,
          },
          config.jwt.expiresIn,
        );
        return reply.code(200).send(result);
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'AUTH_INVALID') {
          return reply.code(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid email or password.',
          });
        }
        if (error.code === 'ACCOUNT_SUSPENDED') {
          return reply.code(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: 'Your account has been suspended. Please contact support.',
          });
        }
        throw err;
      }
    },
  );

  // ─── GET /me ───────────────────────────────────────────────────────────────
  fastify.get(
    '/me',
    {
      schema: meRouteSchema,
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      try {
        const result = await getCurrentUser(request.authUser.id);
        return reply.code(200).send(result);
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'USER_NOT_FOUND') {
          reply.statusCode = 404;
          return reply.send({
            statusCode: 404,
            error: 'Not Found',
            message: 'User not found.',
          });
        }
        throw err;
      }
    },
  );
};

export default authRoutes;
