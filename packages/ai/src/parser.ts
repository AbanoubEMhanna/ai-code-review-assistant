import type { ReviewComment } from "@ai-review/shared";

export interface RawReviewResult {
  summary: string;
  comments: Array<{
    file: string;
    line?: number | null;
    severity: ReviewComment["severity"];
    category: ReviewComment["category"];
    message: string;
    suggestion?: string | null;
  }>;
}

function assertRawReviewResult(value: unknown): asserts value is RawReviewResult {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid AI response: expected object");
  }
  const v = value as Partial<RawReviewResult>;
  if (typeof v.summary !== "string") {
    throw new Error("Invalid AI response: missing or non-string summary");
  }
  if (!Array.isArray(v.comments)) {
    throw new Error("Invalid AI response: comments must be an array");
  }
  for (const [i, c] of v.comments.entries()) {
    if (!c || typeof c !== "object") {
      throw new Error(`Invalid AI response: comments[${i}] must be an object`);
    }
    const comment = c as Record<string, unknown>;
    if (typeof comment.file !== "string" || comment.file.trim() === "") {
      throw new Error(`Invalid AI response: comments[${i}].file must be a non-empty string`);
    }
    if (typeof comment.message !== "string") {
      throw new Error(`Invalid AI response: comments[${i}].message must be a string`);
    }
    const VALID_SEVERITIES = ["high", "medium", "low", "info"] as const;
    const VALID_CATEGORIES = [
      "bug",
      "security",
      "performance",
      "maintainability",
      "style",
    ] as const;
    if (typeof comment.severity !== "string") {
      throw new Error(`Invalid AI response: comments[${i}].severity must be a string`);
    }
    if (!(VALID_SEVERITIES as readonly string[]).includes(comment.severity)) {
      throw new Error(
        `Invalid AI response: comments[${i}].severity must be one of ${VALID_SEVERITIES.join(", ")}, got "${comment.severity}"`
      );
    }
    if (typeof comment.category !== "string") {
      throw new Error(`Invalid AI response: comments[${i}].category must be a string`);
    }
    if (!(VALID_CATEGORIES as readonly string[]).includes(comment.category)) {
      throw new Error(
        `Invalid AI response: comments[${i}].category must be one of ${VALID_CATEGORIES.join(", ")}, got "${comment.category}"`
      );
    }
    if ("line" in comment && comment.line != null && !Number.isInteger(comment.line)) {
      throw new Error(`Invalid AI response: comments[${i}].line must be an integer or null`);
    }
    if (
      "suggestion" in comment &&
      comment.suggestion != null &&
      typeof comment.suggestion !== "string"
    ) {
      throw new Error(`Invalid AI response: comments[${i}].suggestion must be a string or null`);
    }
  }
}

/**
 * Finds the span of a balanced `{...}` object starting at `text[start]`
 * (which must be "{"), correctly skipping braces inside quoted strings.
 * Returns the index of the matching closing brace, or -1 if unbalanced.
 */
function findMatchingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Locates every balanced `{...}` object in a raw model response, in the
 * order they appear. Local models frequently ignore "respond with only
 * JSON" instructions and wrap the object in explanatory prose and/or a code
 * fence, and that surrounding text can itself contain brace-delimited
 * content (a code sample, a stray JS object) that isn't the review — so
 * parseReview tries each candidate in turn rather than only the first.
 */
function findJsonObjectCandidates(text: string): string[] {
  const candidates: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{") {
      const end = findMatchingBrace(text, i);
      if (end === -1) {
        i++;
        continue;
      }
      candidates.push(text.slice(i, end + 1));
      i = end + 1;
    } else {
      i++;
    }
  }
  return candidates;
}

export function parseReview(raw: string): RawReviewResult {
  const candidates = findJsonObjectCandidates(raw);
  let lastError: unknown;
  for (const candidate of candidates.length > 0 ? candidates : [raw.trim()]) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      assertRawReviewResult(parsed);
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Could not parse AI response as JSON. Reason: ${lastError instanceof Error ? lastError.message : String(lastError)} (raw length: ${raw.length})`
  );
}
