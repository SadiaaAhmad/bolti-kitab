/**
 * Bolti Kitab — Billing Routes Plugin
 *
 * Routes:
 *   POST /checkout/book           Initiate direct book purchase (Requires Idempotency-Key)
 *   POST /checkout/subscribe      Initiate subscription checkout (Requires Idempotency-Key)
 *   GET  /subscriptions/me        Retrieve user subscription with effective expiry
 *   POST /subscriptions/cancel    Cancel auto-renewal while keeping remaining access
 *   GET  /entitlements            Retrieve user entitlements (usable by default)
 *   POST /webhook/mock            Mock payment webhook (Isolated strictly to non-production)
 */

import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../config/env.js';
import * as service from './service.js';
import {
  checkoutBookBodySchema,
  checkoutSubscriptionBodySchema,
  checkoutSessionResponseSchema,
  subscriptionMeResponseSchema,
  entitlementsQuerySchema,
  mockWebhookBodySchema,
} from './schemas.js';
import { registerPaymentProvider } from './providers/payment-provider.js';
import { MockPaymentProvider } from './providers/mock-provider.js';
import type { PaymentGateway } from './types.js';

// Register mock provider only in non-production environments
if (!config.server.isProduction) {
  registerPaymentProvider(new MockPaymentProvider());
}

const billingRoutes: FastifyPluginAsync = async (fastify) => {
  // ── POST /checkout/book ─────────────────────────────────────────────────────
  fastify.post('/checkout/book', {
    schema: {
      body: checkoutBookBodySchema,
      response: { 200: checkoutSessionResponseSchema, 201: checkoutSessionResponseSchema },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const rawIdempotencyKey = request.headers['idempotency-key'];
    if (!rawIdempotencyKey || typeof rawIdempotencyKey !== 'string' || rawIdempotencyKey.trim().length === 0) {
      const err = new Error("Header 'Idempotency-Key' is required for checkout.") as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    const body = request.body as { bookId: string; gateway: PaymentGateway };
    const session = await service.checkoutBook(
      request.authUser.id,
      request.authUser.email,
      {
        bookId: body.bookId,
        gateway: body.gateway,
        idempotencyKey: rawIdempotencyKey.trim(),
      },
    );

    const statusCode = session.isExisting ? 200 : 201;
    return reply.code(statusCode).send(session);
  });

  // ── POST /checkout/subscribe ────────────────────────────────────────────────
  fastify.post('/checkout/subscribe', {
    schema: {
      body: checkoutSubscriptionBodySchema,
      response: { 200: checkoutSessionResponseSchema, 201: checkoutSessionResponseSchema },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const rawIdempotencyKey = request.headers['idempotency-key'];
    if (!rawIdempotencyKey || typeof rawIdempotencyKey !== 'string' || rawIdempotencyKey.trim().length === 0) {
      const err = new Error("Header 'Idempotency-Key' is required for checkout.") as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }

    const body = request.body as { planId: string; gateway: PaymentGateway };
    const session = await service.checkoutSubscription(
      request.authUser.id,
      request.authUser.email,
      {
        planId: body.planId,
        gateway: body.gateway,
        idempotencyKey: rawIdempotencyKey.trim(),
      },
    );

    const statusCode = session.isExisting ? 200 : 201;
    return reply.code(statusCode).send(session);
  });

  // ── GET /subscriptions/me ───────────────────────────────────────────────────
  fastify.get('/subscriptions/me', {
    schema: {
      response: { 200: subscriptionMeResponseSchema },
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const sub = await service.getMySubscription(request.authUser.id);
    return reply.send(sub);
  });

  // ── POST /subscriptions/cancel ──────────────────────────────────────────────
  fastify.post('/subscriptions/cancel', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const res = await service.cancelMySubscription(request.authUser.id);
    return reply.send(res);
  });

  // ── GET /entitlements ───────────────────────────────────────────────────────
  fastify.get('/entitlements', {
    schema: {
      querystring: entitlementsQuerySchema,
    },
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const query = request.query as { include_expired?: string };
    const includeExpired = query.include_expired === 'true';
    const entitlements = await service.getMyEntitlements(request.authUser.id, includeExpired);
    return reply.send({ entitlements });
  });

  // ── POST /webhook/mock (Non-production only) ─────────────────────────────────
  if (!config.server.isProduction) {
    fastify.post('/webhook/mock', {
      schema: {
        body: mockWebhookBodySchema,
      },
    }, async (request, reply) => {
      const signature = request.headers['x-mock-signature'] as string | undefined;
      const result = await service.handleWebhook('mock', request.body, signature);
      return reply.send(result);
    });
  }
};

export default billingRoutes;
