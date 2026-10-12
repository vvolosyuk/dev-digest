/** Constants for the skills module (validation + import limits). */

/** Version recorded for a newly-created skill. */
export const INITIAL_SKILL_VERSION = 1;

/** A skill's name is its kebab-case identifier, unique per workspace. */
export const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;
export const SKILL_NAME_MAX = 63;
export const SKILL_DESCRIPTION_MIN = 10;
export const SKILL_DESCRIPTION_MAX = 300;
export const SKILL_BODY_MIN = 1;
export const SKILL_BODY_MAX = 20_000;
export const SKILL_NOTE_MAX = 500;
export const SKILL_SEARCH_MAX = 200;

/** `POST /skills/import/preview` route body limit (base64 JSON envelope). */
export const IMPORT_BODY_LIMIT_BYTES = 2 * 1024 * 1024;
/** Max size of the uploaded file itself (decoded `content_base64`). */
export const IMPORT_MAX_COMPRESSED_BYTES = 1024 * 1024;
/** Max decompressed size of `SKILL.md` (and of a plain `.md` upload). */
export const IMPORT_MAX_SKILL_MD_BYTES = 100 * 1024;
/** Max number of entries in an imported `.zip`. */
export const IMPORT_MAX_ZIP_ENTRIES = 200;

/** The only file read out of an imported zip (root or exactly one folder deep). */
export const SKILL_MD_FILENAME = 'skill.md';

/** Extensions flagged as `executable` in the import preview (never run). */
export const EXECUTABLE_EXTENSIONS = [
  '.sh',
  '.py',
  '.js',
  '.ts',
  '.mjs',
  '.exe',
  '.bat',
  '.ps1',
] as const;

/** Reasons shown for zip entries that were not read. */
export const IGNORED_REASON = {
  executable: 'executable',
  nestedArchive: 'nested-archive',
  notSkillCore: 'not-skill-core',
} as const;

/** Zip local-file-header magic bytes `PK\x03\x04`. */
export const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

/** Postgres unique-violation SQLSTATE. */
export const PG_UNIQUE_VIOLATION = '23505';
