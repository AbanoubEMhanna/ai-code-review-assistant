import { describe, it, expect, vi, afterEach } from "vitest";
import { printHistoryListJson, printHistoryStatsJson } from "./output.js";
import type { StoredReview } from "./history-store.js";
import type { HistoryStats } from "./output.js";

function makeStoredReview(overrides: Partial<StoredReview> = {}): StoredReview {
  return {
    id: "1748000000000-abc123",
    generatedAt: "2026-05-22T00:00:00.000Z",
    model: "qwen3:latest",
    diffSource: "staged changes",
    summary: "No issues found.",
    comments: [],
    stats: { high: 0, medium: 0, low: 0, info: 0, total: 0 },
    ...overrides,
  };
}

function makeStats(overrides: Partial<HistoryStats> = {}): HistoryStats {
  return {
    reviewCount: 3,
    totalIssues: 5,
    bySeverity: { high: 1, medium: 2, low: 1, info: 1 },
    byCategory: { bug: 2, security: 1, performance: 2 },
    topSources: [{ source: "staged changes", count: 3 }],
    avgIssuesPerReview: 1.67,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("printHistoryListJson", () => {
  it("writes a valid JSON array to stdout", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    const reviews = [makeStoredReview(), makeStoredReview({ id: "1748000000001-def456" })];
    printHistoryListJson(reviews);

    expect(written).toHaveLength(1);
    const parsed = JSON.parse(written[0] ?? "") as StoredReview[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.id).toBe("1748000000000-abc123");
    expect(parsed[1]?.id).toBe("1748000000001-def456");
  });

  it("writes an empty array for no reviews", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printHistoryListJson([]);

    const parsed = JSON.parse(written[0] ?? "") as unknown[];
    expect(parsed).toEqual([]);
  });

  it("includes the id field from StoredReview", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printHistoryListJson([makeStoredReview({ id: "1748000000000-abc123" })]);

    const parsed = JSON.parse(written[0] ?? "") as StoredReview[];
    expect(parsed[0]?.id).toBe("1748000000000-abc123");
  });

  it("output ends with a newline", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printHistoryListJson([makeStoredReview()]);
    expect(written[0] ?? "").toMatch(/\n$/);
  });
});

describe("printHistoryStatsJson", () => {
  it("writes a valid JSON object to stdout", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    const stats = makeStats();
    printHistoryStatsJson(stats);

    expect(written).toHaveLength(1);
    const parsed = JSON.parse(written[0] ?? "") as HistoryStats;
    expect(parsed.reviewCount).toBe(3);
    expect(parsed.totalIssues).toBe(5);
    expect(parsed.bySeverity.high).toBe(1);
    expect(parsed.byCategory["bug"]).toBe(2);
    expect(parsed.topSources[0]?.source).toBe("staged changes");
    expect(parsed.avgIssuesPerReview).toBe(1.67);
  });

  it("serializes zero-stats correctly", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printHistoryStatsJson({
      reviewCount: 0,
      totalIssues: 0,
      bySeverity: { high: 0, medium: 0, low: 0, info: 0 },
      byCategory: {},
      topSources: [],
      avgIssuesPerReview: 0,
    });

    const parsed = JSON.parse(written[0] ?? "") as HistoryStats;
    expect(parsed.reviewCount).toBe(0);
    expect(parsed.topSources).toEqual([]);
    expect(parsed.byCategory).toEqual({});
  });

  it("output ends with a newline", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printHistoryStatsJson(makeStats());
    expect(written[0] ?? "").toMatch(/\n$/);
  });
});
