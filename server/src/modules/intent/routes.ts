import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { AppError, ConfigError } from '../../platform/errors.js';
import { IntentResponse } from './schemas.js';

/**
 * intent module.
 *   GET  /pulls/:id/intent  → stored intent + staleness + current model (never calls an LLM)
 *   POST /pulls/:id/intent  → (re)derive now with the `review_intent` feature model
 */
export default async function intentRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;

  app.get(
    '/pulls/:id/intent',
    { schema: { params: IdParams, response: { 200: IntentResponse } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return container.intent.get(workspaceId, req.params.id);
    },
  );

  // Tight per-route limit: every call is a paid LLM request.
  app.post(
    '/pulls/:id/intent',
    {
      schema: { params: IdParams, response: { 200: IntentResponse } },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      const t0 = Date.now();
      try {
        const res = await container.intent.recompute(workspaceId, req.params.id);
        const rec = res.intent;
        req.log.info(
          {
            prId: req.params.id,
            provider: res.model.provider,
            model: res.model.model,
            confidence: rec?.confidence,
            sources: rec?.sources?.map((s) => `${s.kind}:${s.ref}`),
            tokensIn: rec?.tokens_in,
            tokensOut: rec?.tokens_out,
            costUsd: rec?.cost_usd,
            ms: Date.now() - t0,
          },
          'intent: computed',
        );
        return res;
      } catch (err) {
        // Keep 404 and friends as they are; classify the rest for the card.
        if (err instanceof ConfigError) {
          req.log.warn({ prId: req.params.id, err: err.message }, 'intent: model unavailable');
          throw new AppError('intent_model_unavailable', err.message, 400);
        }
        if (err instanceof AppError) throw err;
        req.log.warn({ prId: req.params.id, err: (err as Error).message }, 'intent: failed');
        throw new AppError('intent_failed', `Intent derivation failed: ${(err as Error).message}`, 502);
      }
    },
  );
}
