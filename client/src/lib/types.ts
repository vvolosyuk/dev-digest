/**
 * Shared contract types re-exported from @devdigest/shared (single source of
 * truth). F2 imports these rather than redefining them.
 *
 * F1 (@devdigest/shared) currently exports all the platform/findings/brief/
 * knowledge/trace contracts we need for the scaffolding screens, so there are
 * NO local placeholders required at this time. If a feature agent's contract is
 * not yet exported, add a placeholder below marked
 * `// TODO: reconcile with @devdigest/shared`.
 */
export type {
  Settings,
  SettingsUpdate,
  ConnTestProvider,
  ConnTestResult,
  SecretsStatus,
  FeatureModelId,
  FeatureModelChoice,
  FeatureModelDef,
  Provider,
  ModelInfo,
  Repo,
  RepoInput,
  PrMeta,
  PrDetail,
  PrFile,
  PrCommit,
  PrReviewComment,
  PrStatus,
  SpecFile,
  IndexStatus,
} from "@devdigest/shared";

export type { Review, Finding, Severity, Verdict } from "@devdigest/shared";
export type { PrBrief, SmartDiff } from "@devdigest/shared";

import type { PrMeta } from "@devdigest/shared";

/** Per-severity finding tally, e.g. for the PR list's Findings column and the
 *  Agent-runs Timeline's per-run counter (never `null` — an unreviewed PR or a
 *  finding-free run both report an all-zero object). */
export type FindingsBySeverity = Record<"CRITICAL" | "WARNING" | "SUGGESTION", number>;

/** `PrMeta` plus the list's Findings column data. Not part of the vendored
 *  `@devdigest/shared` contract (see `server/src/modules/pulls/routes.ts`'s
 *  matching local `PrMetaWithFindings` type) — this route has no Fastify
 *  response schema, so extending the shape doesn't require touching vendor. */
export type PrMetaWithFindings = PrMeta & { findings_by_severity: FindingsBySeverity };
