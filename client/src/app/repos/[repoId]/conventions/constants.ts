/** Constants for the /repos/:repoId/conventions route. */

/** Confidence (0..1) at/above which a candidate bar is green / amber; below → red. */
export const CONFIDENCE_HIGH = 0.8;
export const CONFIDENCE_MID = 0.6;

/** Suffix of the default skill name: `<repo>-conventions`. */
export const SKILL_NAME_SUFFIX = "-conventions";
/** Mirrors the server's skill-name limit (63 chars). */
export const SKILL_NAME_MAX = 63;

export const SKELETON_CARDS = 3;
