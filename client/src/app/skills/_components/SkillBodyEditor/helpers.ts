/** Pure helpers for SkillBodyEditor. */

/**
 * Rough token estimate (`ceil(chars / 4)`) shown while editing. It is labelled
 * approximate in the UI — the exact tiktoken count appears in the run trace.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Number of lines in the editor (an empty body still has line 1). */
export function lineCount(text: string): number {
  return text.split("\n").length;
}
