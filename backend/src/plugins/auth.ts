/**
 * Bolti Kitab — Fastify Authentication & RBAC Plugin
 *
 * Decorates the Fastify instance with two reusable preHandlers:
 *
 *   fastify.authenticate
 *     Validates the `Authorization: Bearer <token>` header.
 *     Attaches `request.authUser` on success.
 *     Returns 401 on missing, expired, or invalid token.
 *
 *   fastify.requireRole(...roles)
 *     Factory that returns a preHandler enforcing that request.authUser.role
 *     is one of the provided roles. Returns 403 if not.
 *     MUST be used after authenticate in the preHandler chain.
 *
 * Usage:
 *   preHandler: [fastify.authenticate]
 *   preHandler: [fastify.authenticate, fastify.requireRole('admin', 'editor')]
 */

import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { verifyAccessToken } from '../modules/auth/crypto.js';
import type { AuthUser, UserRole } from '../modules/auth/types.js';

// ─── Extend Fastify Types ─────────────────────────────────────────────────────
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuthenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: UserRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authUser: AuthUser;
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────
const authPlugin: FastifyPluginAsync = async (fastify) => {

  // ── authenticate preHandler ──────────────────────────────────────────────
  const authenticate = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const authHeader = request.headers.authorization;

    if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing or malformed Authorization header.',
      });
    }

    const token = authHeader.slice(7);

    try {
      const payload = verifyAccessToken(token);
      request.authUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Token has expired.',
        });
      }
      // All other JWT errors (invalid signature, malformed, etc.)
      return reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid token.',
      });
    }
  };

  // ── optionalAuthenticate preHandler ──────────────────────────────────────
  const optionalAuthenticate = async (
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> => {
    const authHeader = request.headers.authorization;
    if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
      return;
    }

    const token = authHeader.slice(7);
    try {
      const payload = verifyAccessToken(token);
      request.authUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      // Ignore token verification errors for optional auth — treat as anonymous
    }
  };

  // ── requireRole preHandler factory ───────────────────────────────────────
  const requireRole = (...allowedRoles: UserRole[]) => {
    return async (
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> => {
      // authUser is guaranteed to be set when authenticate runs first
      if (!request.authUser || !allowedRoles.includes(request.authUser.role)) {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'You do not have permission to access this resource.',
        });
      }
    };
  };

  fastify.decorate('authenticate', authenticate);
  fastify.decorate('optionalAuthenticate', optionalAuthenticate);
  fastify.decorate('requireRole', requireRole);
};

export default fp(authPlugin, {
  name: 'bolti-kitab-auth',
  fastify: '5.x',
});
