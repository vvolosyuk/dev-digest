# server specs

Feature/behavior specs for `@devdigest/api`, added as lessons introduce them.

- [`findings-severity.md`](findings-severity.md) — the PR list's per-severity `findings_by_severity` aggregation over non-dismissed findings, computed on read with no migration. Frontend half: [`client/specs/findings-severity.md`](../../client/specs/findings-severity.md).
- [`run-cost.md`](run-cost.md) — persists each run's `cost_usd` and exposes it on the PR list (summed per PR), run summaries and the run trace. Frontend half: [`client/specs/run-cost.md`](../../client/specs/run-cost.md).
