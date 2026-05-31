import type { ReviewComment } from "@ai-review/shared";
import type { StoredReview } from "./history-store.js";

export interface CompareResult {
  a: Pick<StoredReview, "id" | "generatedAt" | "diffSource" | "model" | "stats">;
  b: Pick<StoredReview, "id" | "generatedAt" | "diffSource" | "model" | "stats">;
  delta: { high: number; medium: number; low: number; info: number; total: number };
  resolved: ReviewComment[];
  added: ReviewComment[];
}

function commentKey(c: ReviewComment): string {
  return `${c.file}\0${c.message}`;
}

export function compareReviews(a: StoredReview, b: StoredReview): CompareResult {
  const aKeys = new Set(a.comments.map(commentKey));
  const bKeys = new Set(b.comments.map(commentKey));

  return {
    a: {
      id: a.id,
      generatedAt: a.generatedAt,
      diffSource: a.diffSource,
      model: a.model,
      stats: a.stats,
    },
    b: {
      id: b.id,
      generatedAt: b.generatedAt,
      diffSource: b.diffSource,
      model: b.model,
      stats: b.stats,
    },
    delta: {
      high: b.stats.high - a.stats.high,
      medium: b.stats.medium - a.stats.medium,
      low: b.stats.low - a.stats.low,
      info: b.stats.info - a.stats.info,
      total: b.stats.total - a.stats.total,
    },
    resolved: a.comments.filter((c) => !bKeys.has(commentKey(c))),
    added: b.comments.filter((c) => !aKeys.has(commentKey(c))),
  };
}
