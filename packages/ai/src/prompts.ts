export const SYSTEM_PROMPT = `You are an expert code reviewer. Analyze the provided git diff and return a JSON review report.

Your review must be a valid JSON object matching this exact schema:
{
  "summary": "string — 1-3 sentence overview",
  "comments": [
    {
      "file": "string — relative file path",
      "line": number | null,
      "severity": "high" | "medium" | "low" | "info",
      "category": "bug" | "security" | "performance" | "maintainability" | "style",
      "message": "string — what the issue is",
      "suggestion": "string | null — concrete fix suggestion"
    }
  ]
}

Severity guide:
- high: bugs, security vulnerabilities, data loss risks
- medium: performance problems, missing error handling, unclear logic
- low: maintainability issues, code duplication, poor naming
- info: style, minor suggestions

Focus on real issues. Skip obvious or trivial style nitpicks. Respond with only the JSON object, no markdown fences.`;

// Local models (Ollama/LM Studio) commonly cap context around 8K-32K tokens.
// At ~4 chars/token, 100K chars (~25K tokens) leaves headroom for the system
// prompt and response tokens while still covering all but very large diffs.
export const DEFAULT_MAX_DIFF_CHARS = 100_000;

export interface TruncatedDiff {
  diff: string;
  truncated: boolean;
  originalLength: number;
}

export function truncateDiff(diff: string, maxChars = DEFAULT_MAX_DIFF_CHARS): TruncatedDiff {
  // Guard against callers passing a non-positive, non-integer, or non-finite
  // limit (e.g. NaN/-1/2.5) — fall back to the default rather than letting
  // String.slice() silently produce a nonsensical (often empty) result.
  const limit = Number.isInteger(maxChars) && maxChars > 0 ? maxChars : DEFAULT_MAX_DIFF_CHARS;
  if (diff.length <= limit) {
    return { diff, truncated: false, originalLength: diff.length };
  }
  return { diff: diff.slice(0, limit), truncated: true, originalLength: diff.length };
}

export function buildUserPrompt(
  diff: string,
  diffSource: string,
  maxChars = DEFAULT_MAX_DIFF_CHARS
): string {
  const { diff: bounded, truncated, originalLength } = truncateDiff(diff, maxChars);
  const truncationNote = truncated
    ? `\n\n[NOTE: This diff was truncated to ${bounded.length.toLocaleString()} of ${originalLength.toLocaleString()} total characters to fit the model's context window. Only the changes above were reviewed — mention this limitation in your summary.]`
    : "";
  return `Review this git diff (${diffSource}):\n\n${bounded}${truncationNote}`;
}
