/** Constants for ImportSkillModal. */
export const MODAL_WIDTH = 760;

/** File types the server's import preview understands. */
export const ACCEPT = ".md,.zip";

/** Server `ignored_files[].reason` values that have a translated label. */
export const KNOWN_IGNORED_REASONS = ["executable", "not-skill-core", "nested-archive"] as const;
