import { z } from 'zod';
import { Intent } from '@devdigest/shared';

/**
 * intent module schemas. The vendored `Intent` contract (intent / in_scope /
 * out_of_scope) is extended LOCALLY — the vendor copies are not edited. These
 * routes declare a response schema, so every returned field must be listed here
 * or serialization strips it. New optional fields are `.nullish()`.
 */

export const Confidence = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof Confidence>;

export const IntentSourceKind = z.enum([
  'title',
  'description',
  'issue',
  'doc',
  'branch',
  'commits',
  'files',
  'risk_signal',
  'ticket_key',
  'external_link',
]);
export type IntentSourceKind = z.infer<typeof IntentSourceKind>;

export const IntentSource = z.object({
  kind: IntentSourceKind,
  ref: z.string(),
  fetched: z.boolean(),
  chars: z.number().int().nullish(),
  note: z.string().nullish(),
});
export type IntentSource = z.infer<typeof IntentSource>;

export const RiskKind = z.enum([
  'auth',
  'dependency',
  'data',
  'config',
  'performance',
  'security',
  'ci',
  'other',
]);
export type RiskKind = z.infer<typeof RiskKind>;

export const IntentRiskArea = z.object({
  label: z.string(),
  kind: RiskKind,
  source: z.enum(['heuristic', 'model']),
});
export type IntentRiskArea = z.infer<typeof IntentRiskArea>;

/**
 * LLM output. Every field is required (no optional/default) because strict
 * `response_format: json_schema` needs all properties present; every string and
 * array is bounded so a hostile or rambling model can't bloat the record.
 */
export const PrIntentClassification = z.object({
  intent: z.string().max(280),
  in_scope: z.array(z.string().max(200)).max(8),
  out_of_scope: z.array(z.string().max(200)).max(8),
  risk_areas: z.array(z.object({ label: z.string().max(60), kind: RiskKind })).max(6),
  confidence: Confidence,
});
export type PrIntentClassification = z.infer<typeof PrIntentClassification>;

/** The persisted record as returned by the API (snake_case, like `Intent`). */
export const PrIntentRecord = Intent.extend({
  confidence: Confidence.nullish(),
  sources: z.array(IntentSource).nullish(),
  risk_areas: z.array(IntentRiskArea).nullish(),
  provider: z.string().nullish(),
  model: z.string().nullish(),
  head_sha: z.string().nullish(),
  tokens_in: z.number().int().nullish(),
  tokens_out: z.number().int().nullish(),
  cost_usd: z.number().nullish(),
  computed_at: z.string().nullish(),
});
export type PrIntentRecord = z.infer<typeof PrIntentRecord>;

export const IntentResponse = z.object({
  intent: PrIntentRecord.nullable(),
  /** The stored record was computed from different inputs/model than current. */
  stale: z.boolean(),
  /** The feature model that a (re)compute would use right now. */
  model: z.object({ provider: z.string(), model: z.string() }),
});
export type IntentResponse = z.infer<typeof IntentResponse>;
