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
      `Could not parse AI response as JSON.\n\nRaw response:\n${raw}\n\nReason: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
