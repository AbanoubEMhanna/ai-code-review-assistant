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
 * Finds the first balanced top-level `{...}` object in `text`, respecting
 * string boundaries so braces inside string values don't throw off the count.
 * Returns null if no balanced object is found.
 */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

export function parseReview(raw: string): RawReviewResult {
  // Reasoning models (e.g. DeepSeek R1, Qwen3 in thinking mode) often emit a
  // <think>...</think> trace ahead of the actual answer; strip it before
  // looking for the JSON payload.
  const withoutThinking = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const cleaned = withoutThinking
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  const candidates = [cleaned];
  const extracted = extractJsonObject(cleaned);
  if (extracted != null && extracted !== cleaned) {
    candidates.push(extracted);
  }

  let lastErr: unknown;
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      assertRawReviewResult(parsed);
      return parsed;
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    `Could not parse AI response as JSON. Reason: ${lastErr instanceof Error ? lastErr.message : String(lastErr)} (raw length: ${raw.length})`
  );
}
