import { describe, expect, it } from "vitest";
import type { StoredReview } from "./history-store.js";
import { computeTrend } from "./output.js";

function makeReview(
  id: string,
  generatedAt: string,
  stats: { high: number; medium: number; low: number; info: number }
): StoredReview {
  const total = stats.high + stats.medium + stats.low + stats.info;
  return {
    id,
    generatedAt,
    model: "test-model",
    diffSource: "staged changes",
    summary: "Test review",
    comments: [],
    stats: { ...stats, total },
  };
}

describe("computeTrend", () => {
  it("returns empty entries and stable direction for no reviews", () => {
    const result = computeTrend([], 10);
    expect(result.entries).toHaveLength(0);
    expect(result.direction).toBe("stable");
    expect(result.slope).toBe(0);
  });

  it("returns stable direction for a single review", () => {
    const reviews = [
      makeReview("1000-abc", "2026-01-01T10:00:00Z", { high: 2, medium: 1, low: 0, info: 0 }),
    ];
    const result = computeTrend(reviews, 10);
    expect(result.entries).toHaveLength(1);
    expect(result.direction).toBe("stable");
    expect(result.slope).toBe(0);
  });

  it("sorts entries chronologically (oldest first)", () => {
    const reviews = [
      makeReview("2000-abc", "2026-01-02T10:00:00Z", { high: 3, medium: 0, low: 0, info: 0 }),
      makeReview("1000-abc", "2026-01-01T10:00:00Z", { high: 1, medium: 0, low: 0, info: 0 }),
    ];
    const result = computeTrend(reviews, 10);
    expect(result.entries[0]?.date).toBe("2026-01-01T10:00:00Z");
    expect(result.entries[1]?.date).toBe("2026-01-02T10:00:00Z");
  });

  it("detects improving trend when issues decrease over time", () => {
    const reviews = [
      makeReview("1000-a", "2026-01-01T10:00:00Z", { high: 5, medium: 3, low: 2, info: 0 }),
      makeReview("2000-a", "2026-01-02T10:00:00Z", { high: 4, medium: 2, low: 1, info: 0 }),
      makeReview("3000-a", "2026-01-03T10:00:00Z", { high: 2, medium: 1, low: 1, info: 0 }),
      makeReview("4000-a", "2026-01-04T10:00:00Z", { high: 1, medium: 1, low: 0, info: 0 }),
      makeReview("5000-a", "2026-01-05T10:00:00Z", { high: 0, medium: 1, low: 0, info: 0 }),
    ];
    const result = computeTrend(reviews, 10);
    expect(result.direction).toBe("improving");
    expect(result.slope).toBeLessThan(0);
  });

  it("detects degrading trend when issues increase over time", () => {
    const reviews = [
      makeReview("1000-a", "2026-01-01T10:00:00Z", { high: 0, medium: 1, low: 0, info: 0 }),
      makeReview("2000-a", "2026-01-02T10:00:00Z", { high: 1, medium: 1, low: 1, info: 0 }),
      makeReview("3000-a", "2026-01-03T10:00:00Z", { high: 2, medium: 2, low: 1, info: 0 }),
      makeReview("4000-a", "2026-01-04T10:00:00Z", { high: 3, medium: 2, low: 2, info: 0 }),
      makeReview("5000-a", "2026-01-05T10:00:00Z", { high: 4, medium: 3, low: 2, info: 0 }),
    ];
    const result = computeTrend(reviews, 10);
    expect(result.direction).toBe("degrading");
    expect(result.slope).toBeGreaterThan(0);
  });

  it("detects stable when issue count is flat", () => {
    const reviews = [
      makeReview("1000-a", "2026-01-01T10:00:00Z", { high: 2, medium: 0, low: 0, info: 0 }),
      makeReview("2000-a", "2026-01-02T10:00:00Z", { high: 2, medium: 0, low: 0, info: 0 }),
      makeReview("3000-a", "2026-01-03T10:00:00Z", { high: 2, medium: 0, low: 0, info: 0 }),
    ];
    const result = computeTrend(reviews, 10);
    expect(result.direction).toBe("stable");
    expect(result.slope).toBeCloseTo(0);
  });

  it("respects the limit parameter", () => {
    const reviews = Array.from({ length: 20 }, (_, i) =>
      makeReview(`${(i + 1) * 1000}-a`, `2026-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`, {
        high: 1,
        medium: 0,
        low: 0,
        info: 0,
      })
    );
    const result = computeTrend(reviews, 5);
    expect(result.entries).toHaveLength(5);
  });

  it("takes the most recent N reviews when limit is smaller than total", () => {
    const reviews = Array.from({ length: 20 }, (_, i) =>
      makeReview(`${(i + 1) * 1000}-a`, `2026-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`, {
        high: 1,
        medium: 0,
        low: 0,
        info: 0,
      })
    );
    const result = computeTrend(reviews, 5);
    expect(result.entries[0]?.date).toBe("2026-01-16T10:00:00Z");
    expect(result.entries[4]?.date).toBe("2026-01-20T10:00:00Z");
  });

  it("maps entry fields correctly", () => {
    const r = makeReview("1000-abc", "2026-01-01T10:00:00Z", {
      high: 2,
      medium: 3,
      low: 1,
      info: 0,
    });
    const result = computeTrend([r], 10);
    const entry = result.entries[0];
    expect(entry?.id).toBe("1000-abc");
    expect(entry?.total).toBe(6);
    expect(entry?.high).toBe(2);
    expect(entry?.medium).toBe(3);
    expect(entry?.low).toBe(1);
    expect(entry?.info).toBe(0);
    expect(entry?.diffSource).toBe("staged changes");
    expect(entry?.model).toBe("test-model");
  });

  it("handles all-zero issue reviews without crashing", () => {
    const reviews = [
      makeReview("1000-a", "2026-01-01T10:00:00Z", { high: 0, medium: 0, low: 0, info: 0 }),
      makeReview("2000-a", "2026-01-02T10:00:00Z", { high: 0, medium: 0, low: 0, info: 0 }),
    ];
    const result = computeTrend(reviews, 10);
    expect(result.direction).toBe("stable");
    expect(result.entries).toHaveLength(2);
  });

  it("returns entries in chronological order even when input is reversed", () => {
    const reviews = Array.from({ length: 5 }, (_, i) =>
      makeReview(`${(5 - i) * 1000}-a`, `2026-01-0${5 - i}T10:00:00Z`, {
        high: i,
        medium: 0,
        low: 0,
        info: 0,
      })
    );
    const result = computeTrend(reviews, 10);
    for (let i = 1; i < result.entries.length; i++) {
      const curr = result.entries[i];
      const prev = result.entries[i - 1];
      if (curr && prev) {
        expect(curr.date >= prev.date).toBe(true);
      }
    }
  });

  it("slope is negative for monotonically decreasing issues", () => {
    const reviews = [10, 8, 6, 4, 2].map((total, i) =>
      makeReview(`${(i + 1) * 1000}-a`, `2026-01-0${i + 1}T10:00:00Z`, {
        high: total,
        medium: 0,
        low: 0,
        info: 0,
      })
    );
    const result = computeTrend(reviews, 10);
    expect(result.slope).toBeLessThan(-1);
  });

  it("slope is positive for monotonically increasing issues", () => {
    const reviews = [1, 3, 5, 7, 9].map((total, i) =>
      makeReview(`${(i + 1) * 1000}-a`, `2026-01-0${i + 1}T10:00:00Z`, {
        high: total,
        medium: 0,
        low: 0,
        info: 0,
      })
    );
    const result = computeTrend(reviews, 10);
    expect(result.slope).toBeGreaterThan(1);
  });

  it("handles limit larger than number of reviews", () => {
    const reviews = [
      makeReview("1000-a", "2026-01-01T10:00:00Z", { high: 1, medium: 0, low: 0, info: 0 }),
      makeReview("2000-a", "2026-01-02T10:00:00Z", { high: 2, medium: 0, low: 0, info: 0 }),
    ];
    const result = computeTrend(reviews, 100);
    expect(result.entries).toHaveLength(2);
  });
});
