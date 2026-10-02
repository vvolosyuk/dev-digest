# Control experiment: without skills vs with skills

Goal: show that the two L02 agents, whose system prompts are intentionally basic,
catch specific problems only once their skills are linked — and that the trace
shows exactly what the skills added to the prompt and how many tokens it cost.

Run each experiment twice on the **same PR, same agent, same model**
(`openrouter / deepseek/deepseek-v4-flash`). The only variable is whether the
agent's skill links are enabled.

## Setup (once)

1. `./scripts/dev.sh` (seed creates **Test Quality Reviewer** and **API Contract
   Reviewer**). In **Settings** store the OpenRouter key and a GitHub token.
2. Create the skills from this folder and link them (see [`README.md`](./README.md)):
   - Test Quality Reviewer → `untested-branches`, `corner-cases-checklist`,
     `over-mocking`, `flaky-tests` (zip import).
   - API Contract Reviewer → `route-signature-compat`, `breaking-change-detector`.
3. Create a throw-away GitHub repo (e.g. `<you>/devdigest-skills-lab`) with the
   **base** files below on `main`, then push each PR branch and open a PR.
4. In DevDigest: **Add repository** → paste the repo URL → import its pull requests.

### Base commit (`main`)

`package.json`:

```json
{ "name": "skills-lab", "type": "module", "scripts": { "test": "vitest run" },
  "devDependencies": { "vitest": "^3.0.0", "typescript": "^5.6.0" },
  "dependencies": { "fastify": "^5.0.0", "zod": "^3.23.0" } }
```

`src/routes/orders.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const ListQuery = z.object({ customerId: z.string(), limit: z.coerce.number().int().max(100).optional() });

export async function orderRoutes(app: FastifyInstance) {
  app.get('/orders', async (req) => {
    const q = ListQuery.parse(req.query);
    const orders = await app.db.listOrders(q.customerId, q.limit ?? 20);
    return { orders, total: orders.length };
  });
}
```

## Experiment 1 — Test Quality Reviewer

### PR A: `feat/refund` — "Add refund calculation"

A new function with a guard branch, and a test that only covers the happy path.

```diff
diff --git a/src/billing/refund.ts b/src/billing/refund.ts
new file mode 100644
--- /dev/null
+++ b/src/billing/refund.ts
@@ -0,0 +1,17 @@
+export class InvalidAmountError extends Error {}
+
+/**
+ * Refund `amount` (minor units) of a payment, minus a 2% processing fee
+ * that is capped at 500.
+ */
+export function calculateRefund(amount: number, alreadyRefunded = 0): number {
+  if (amount <= 0) {
+    throw new InvalidAmountError(`amount must be positive, got ${amount}`);
+  }
+  const remaining = amount - alreadyRefunded;
+  if (remaining <= 0) return 0;
+  const fee = Math.min(Math.round(remaining * 0.02), 500);
+  return remaining - fee;
+}
+
+export const REFUND_FEE_CAP = 500;
diff --git a/src/billing/refund.test.ts b/src/billing/refund.test.ts
new file mode 100644
--- /dev/null
+++ b/src/billing/refund.test.ts
@@ -0,0 +1,8 @@
+import { describe, expect, it } from 'vitest';
+import { calculateRefund } from './refund';
+
+describe('calculateRefund', () => {
+  it('refunds the amount minus the 2% fee', () => {
+    expect(calculateRefund(10_000)).toBe(9_800);
+  });
+});
```

What is deliberately wrong:

- `amount <= 0` → `throw` has **no test** (untested branch).
- No boundary tests: `0`, negative amount, `alreadyRefunded >= amount` (returns `0`),
  the fee cap (`amount` large enough that 2% > 500).

### Runs

| Run | How |
|---|---|
| **1a — without skills** | Agent → Skills tab → switch **off** all four links (they keep their order) → Save. Open PR A → run **Test Quality Reviewer**. |
| **1b — with skills** | Switch the four links back **on** → Save. Re-run the same agent on PR A. |

### Expected

- **1a:** the basic prompt tends to approve or give a generic "add more tests"
  comment; the `amount <= 0` branch and boundary values are typically **missed**.
- **1b:** a finding on `src/billing/refund.ts:8-10` — untested `throw` branch
  (`untested-branches`), with a suggested test like
  `expect(() => calculateRefund(0)).toThrow(InvalidAmountError)`; plus corner-case
  findings for `0` / negative / `alreadyRefunded >= amount` / fee cap
  (`corner-cases-checklist`). Severity WARNING (or CRITICAL if the model treats the
  refund amount as a money path with no test at all — allowed by the rubric).

## Experiment 2 — API Contract Reviewer

### PR B: `feat/orders-pagination` — "Paginate orders list"

Renames a query param, makes it required, and changes the response shape.

```diff
diff --git a/src/routes/orders.ts b/src/routes/orders.ts
--- a/src/routes/orders.ts
+++ b/src/routes/orders.ts
@@ -1,12 +1,17 @@
 import type { FastifyInstance } from 'fastify';
 import { z } from 'zod';
 
-const ListQuery = z.object({ customerId: z.string(), limit: z.coerce.number().int().max(100).optional() });
+const ListQuery = z.object({
+  customer_id: z.string().uuid(),
+  pageSize: z.coerce.number().int().min(1).max(50),
+  cursor: z.string().optional(),
+});
 
 export async function orderRoutes(app: FastifyInstance) {
-  app.get('/orders', async (req) => {
+  app.get('/v1/orders', async (req, reply) => {
     const q = ListQuery.parse(req.query);
-    const orders = await app.db.listOrders(q.customerId, q.limit ?? 20);
-    return { orders, total: orders.length };
+    const page = await app.db.listOrdersPage(q.customer_id, q.pageSize, q.cursor);
+    if (page.items.length === 0) return reply.code(204).send();
+    return { data: page.items, next_cursor: page.nextCursor ?? null };
   });
 }
```

What is deliberately breaking:

- Path `/orders` → `/v1/orders` with no alias for the old path.
- Query `customerId` → `customer_id` (renamed) and now must be a UUID.
- `limit` (optional, max 100) → `pageSize` (**required**, max 50).
- Response `{ orders, total }` → `{ data, next_cursor }`; `total` removed.
- Empty result: `200 { orders: [] }` → `204` with no body.

### Runs

| Run | How |
|---|---|
| **2a — without skills** | API Contract Reviewer → Skills tab → switch **off** both links → Save → run on PR B. |
| **2b — with skills** | Switch both links back **on** → Save → re-run on PR B. |

### Expected

- **2a:** the basic prompt may notice "the response changed", but usually as a
  single vague finding, missing the renamed/required params and the `204`.
- **2b:** CRITICAL breaking-change findings citing `src/routes/orders.ts`: renamed
  + required query params, removed `total` / renamed `orders` → `data`, removed path,
  `200` → `204` on empty — each with a compatibility path (accept both names, keep
  `/orders` as an alias, version the route). Verdict `request_changes`.

## Check the trace (every run)

1. Open the run → **Trace** → **Prompt assembly**.
2. **With skills (1b, 2b):** a `Skills / rules` block is present, showing the
   linked skill bodies in link order, with a `+N tokens` badge (exact count from the
   server tokenizer). The run log shows `Loaded N skills`.
3. **Without skills (1a, 2a):** there is **no** `Skills / rules` block, and the log
   shows no skills loaded (or `Loaded 0 skills`).
4. Optional: switch off a single link (e.g. `flaky-tests`) and re-run — that skill
   disappears from the block and `+N tokens` drops accordingly.

## Results (fill in)

| # | Agent | PR | Skills | Verdict | Findings (C / W / S) | Target issue caught? | `Skills / rules` +tokens | Total prompt tokens | Cost | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1a | Test Quality | A | off | | | `amount <= 0` branch: ☐ · boundaries: ☐ | — | | | |
| 1b | Test Quality | A | on (4) | | | `amount <= 0` branch: ☐ · boundaries: ☐ | | | | |
| 2a | API Contract | B | off | | | params: ☐ · response: ☐ · 204: ☐ | — | | | |
| 2b | API Contract | B | on (2) | | | params: ☐ · response: ☐ · 204: ☐ | | | | |

LLM output is nondeterministic: run each row 2–3 times and note how often the
target issue is caught, not just whether it was caught once.

Conclusion (fill in): what the skills added, at what token cost, and whether any
skill produced noise (false positives) worth tightening.
