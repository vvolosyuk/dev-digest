/**
 * intent module constants. Budgets cap how much untrusted PR text can reach the
 * classifier prompt (~6k input tokens worst case); see the plan's "Data sources".
 */

/** Bump when the classifier prompt/schema changes — invalidates cached intents. */
export const PROMPT_VERSION = 'intent-v1';

/** Name of the structured-output schema (also the mock-LLM fixture key). */
export const INTENT_SCHEMA_NAME = 'PrIntentClassification';

/** Classifier call parameters: deterministic, short, bounded. */
export const INTENT_LLM = {
  temperature: 0,
  maxTokens: 800,
  timeoutMs: 30_000,
  maxRetries: 1,
} as const;

/** Per-source character budgets. */
export const BUDGET = {
  title: 300,
  description: 4_000,
  branch: 200,
  commits: 30,
  commitsChars: 2_000,
  files: 150,
  filesChars: 3_000,
  issues: 2,
  issueChars: 3_000,
  docs: 3,
  docChars: 6_000,
  docsTotalChars: 12_000,
  docReadBytes: 256 * 1024,
  externalLinks: 10,
  riskAreas: 6,
} as const;

/** A description needs at least this many real characters to count as "meaningful". */
export const MIN_MEANINGFUL_DESCRIPTION_CHARS = 40;
