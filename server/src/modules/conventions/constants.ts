import type { FeatureModelChoice } from '@devdigest/shared';

/** How many rank-ordered source files go into the sample (plus configs). */
export const SAMPLE_TOP_FILES = 12;

/**
 * Style/tooling config files read verbatim when present (missing ones are
 * skipped silently). Exact repo-root paths — no globbing, deterministic.
 */
export const CONFIG_FILES = [
  'tsconfig.json',
  'tsconfig.base.json',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  '.prettierrc.cjs',
  'prettier.config.js',
  'prettier.config.mjs',
  'prettier.config.cjs',
  '.editorconfig',
] as const;

/** Per-file truncation so a huge file can't blow the token budget. */
export const SAMPLE_MAX_LINES = 300;
export const SAMPLE_MAX_CHARS = 12_000;

/** Upper bound of candidates the model may return. */
export const MAX_CANDIDATES = 20;

export const RULE_MAX = 500;
export const CATEGORY_MAX = 40;
export const SNIPPET_MAX_LINES = 40;
export const DEFAULT_CATEGORY = 'general';

export const EXTRACTION_SCHEMA_NAME = 'ConventionExtraction';
export const SYSTEM_PROMPT_FILE = 'conventions.system.md';
export const EXTRACTION_TEMPERATURE = 0.2;
export const EXTRACTION_TIMEOUT_MS = 120_000;

/** Key under which Settings stores per-feature model overrides. */
export const FEATURE_MODELS_SETTINGS_KEY = 'feature_models';

/**
 * Cheap-model fallback chain when the workspace hasn't picked a model for the
 * `conventions` feature: first provider with a configured key wins.
 */
export const CHEAP_MODEL_CHAIN: FeatureModelChoice[] = [
  { provider: 'openai', model: 'gpt-5.4-mini' },
  { provider: 'anthropic', model: 'claude-3-5-haiku-latest' },
  { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
];

export const PG_UNIQUE_VIOLATION = '23505';

/** Mirrors the skills module's limits (modules don't import each other). */
export const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;
export const SKILL_NAME_MAX = 63;
export const SKILL_DESCRIPTION_MIN = 10;
export const SKILL_DESCRIPTION_MAX = 300;
export const SKILL_BODY_MAX = 20_000;
export const MAX_MERGE_IDS = 200;

// ---- Skill draft (accepted conventions → one skill) ----

export const DRAFT_SCHEMA_NAME = 'ConventionSkillDraft';
export const DRAFT_PROMPT_FILE = 'conventions-skill.system.md';
export const DRAFT_TEMPERATURE = 0.3;
export const DRAFT_TIMEOUT_MS = 90_000;
/** Max distinct directories named in a template "Use when …" clause. */
export const TEMPLATE_MAX_AREAS = 4;
/** Directory depth used to group evidence paths into areas (`server/src/modules`). */
export const AREA_DEPTH = 3;

/** File extension → fenced-code language for evidence snippets. */
export const FENCE_LANG: Record<string, string> = {
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  jsx: 'jsx',
  mjs: 'js',
  cjs: 'js',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  rb: 'ruby',
  cs: 'csharp',
  php: 'php',
  sql: 'sql',
  json: 'json',
  css: 'css',
  scss: 'scss',
};

/** Fixed closing section of every drafted conventions skill. */
export const FINDING_FORMAT =
  'Cite the `file:line` of the changed code that breaks the rule. In the rationale, name the rule ' +
  '(its heading above) and what deviates; in the suggestion, show the conforming version, ' +
  'pointing at the rule\'s example as the reference.';

export const TEMPLATE_SEVERITY = {
  warning: 'New or changed code that breaks one of the rules above.',
  suggestion: 'Code that follows the rule only partially, or a touched line where aligning it is cheap.',
};
