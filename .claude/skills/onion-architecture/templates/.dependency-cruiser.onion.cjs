/**
 * Onion Architecture rules for server/ (skill onion-architecture v1.0.0).
 * Run from server/:  npx depcruise src --config ../.claude/skills/onion-architecture/templates/.dependency-cruiser.onion.cjs
 * Pre-existing violations are severity "warn" so the check is adoptable; flip to "error" once cleaned up.
 * NOTE: dependency-cruiser cannot see `container.db` / `container.<adapter>` usage in routes — use the rg checks in references/review-checklist.md.
 */
const SDKS = '^(openai|@anthropic-ai/sdk|octokit|simple-git|@ast-grep/napi)$';

module.exports = {
  forbidden: [
    {
      name: 'route-no-infra',
      comment: 'Rule D: routes must go through the service; no drizzle, db, adapters.',
      severity: 'warn',
      from: { path: '^src/modules/[^/]+/routes\\.ts$' },
      to: { path: ['^src/db/', '^src/adapters/', '^node_modules/drizzle-orm', '^node_modules/postgres'] },
    },
    {
      name: 'route-no-sdk',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/routes\\.ts$' },
      to: { path: SDKS, dependencyTypes: ['npm'] },
    },
    {
      name: 'service-no-fastify-or-infra',
      comment: 'Rule C: application layer must not know HTTP, SQL or SDKs.',
      severity: 'warn',
      from: { path: '^src/modules/[^/]+/(service|run-executor|findings|diff-loader)\\.ts$' },
      to: { path: ['^node_modules/fastify', '^node_modules/drizzle-orm', '^src/db/schema', '^src/adapters/'] },
    },
    {
      name: 'service-no-sdk',
      severity: 'error',
      from: { path: '^src/modules/' },
      to: { path: SDKS, dependencyTypes: ['npm'] },
    },
    {
      name: 'no-cross-module',
      comment: 'Share via Container or modules/_shared, not by importing another module.',
      severity: 'warn',
      from: { path: '^src/modules/([^/_][^/]*)/' },
      to: { path: '^src/modules/([^/_][^/]*)/', pathNot: '^src/modules/$1/' },
    },
    {
      name: 'adapter-no-modules-or-seed',
      severity: 'warn',
      from: { path: '^src/adapters/' },
      to: { path: ['^src/modules/', '^src/db/seed\\.ts$'] },
    },
    {
      name: 'domain-pure',
      comment: 'reviewer-core is the center: no server, fastify or drizzle.',
      severity: 'error',
      from: { path: '^\\.\\./reviewer-core/src/' },
      to: { path: ['^src/(?!vendor/shared)', '^node_modules/(fastify|drizzle-orm|postgres)'] },
    },
    { name: 'no-circular', severity: 'warn', from: {}, to: { circular: true } },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^src/vendor/|\\.test\\.ts$|^test/)' },
  },
};
