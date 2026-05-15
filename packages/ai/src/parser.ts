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
    if (typeof comment.severity !== "string") {
      throw new Error(`Invalid AI response: comments[${i}].severity must be a string`);
    }
    if (typeof comment.category !== "string") {
      throw new Error(`Invalid AI response: comments[${i}].category must be a string`);
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

export function parseReview(raw: string): RawReviewResult {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    assertRawReviewResult(parsed);
    return parsed;
  } catch (err) {
    throw new Error(
      `Could not parse AI response as JSON. Reason: ${err instanceof Error ? err.message : String(err)} (raw length: ${raw.length})`
    );
  }
}
