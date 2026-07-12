import { rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReviewReport } from "@ai-review/shared";
import { ReviewHistoryStore } from "./history-store.js";

function makeReport(overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    generatedAt: new Date().toISOString(),
    model: "test-model",
    diffSource: "staged changes",
    summary: "No issues found.",
    comments: [],
    stats: { high: 0, medium: 0, low: 0, info: 0, total: 0 },
    ...overrides,
  };
}

let store: ReviewHistoryStore;
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ai-review-filter-test-"));
  store = new ReviewHistoryStore(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true });
});

describe("ReviewHistoryStore date filtering", () => {
  it("list({ since }) returns only reviews on or after the cutoff", () => {
    const old = makeReport({ generatedAt: "2024-01-01T00:00:00.000Z", diffSource: "old" });
    const recent = makeReport({ generatedAt: "2024-06-01T00:00:00.000Z", diffSource: "recent" });
    store.save(old);
    store.save(recent);

    const results = store.list({ since: new Date("2024-03-01T00:00:00.000Z") });
    expect(results).toHaveLength(1);
    expect(results[0]?.diffSource).toBe("recent");
  });

  it("list({ until }) returns only reviews on or before the cutoff", () => {
    const old = makeReport({ generatedAt: "2024-01-01T00:00:00.000Z", diffSource: "old" });
    const recent = makeReport({ generatedAt: "2024-06-01T00:00:00.000Z", diffSource: "recent" });
    store.save(old);
    store.save(recent);

    const results = store.list({ until: new Date("2024-03-01T00:00:00.000Z") });
    expect(results).toHaveLength(1);
    expect(results[0]?.diffSource).toBe("old");
  });

  it("list({ since, until }) returns reviews within the date range", () => {
    store.save(makeReport({ generatedAt: "2024-01-01T00:00:00.000Z", diffSource: "jan" }));
    store.save(makeReport({ generatedAt: "2024-04-15T00:00:00.000Z", diffSource: "apr" }));
    store.save(makeReport({ generatedAt: "2024-08-01T00:00:00.000Z", diffSource: "aug" }));

    const results = store.list({
      since: new Date("2024-03-01T00:00:00.000Z"),
      until: new Date("2024-06-01T00:00:00.000Z"),
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.diffSource).toBe("apr");
  });

  it("list({ since }) includes reviews exactly on the boundary", () => {
    const boundary = "2024-06-01T00:00:00.000Z";
    store.save(makeReport({ generatedAt: boundary, diffSource: "boundary" }));

    const results = store.list({ since: new Date(boundary) });
    expect(results).toHaveLength(1);
  });

  it("list({ until }) includes reviews exactly on the boundary", () => {
    const boundary = "2024-06-01T00:00:00.000Z";
    store.save(makeReport({ generatedAt: boundary, diffSource: "boundary" }));

    const results = store.list({ until: new Date(boundary) });
    expect(results).toHaveLength(1);
  });

  it("list({ since }) returns empty when all reviews are before the cutoff", () => {
    store.save(makeReport({ generatedAt: "2024-01-01T00:00:00.000Z" }));
    const results = store.list({ since: new Date("2025-01-01T00:00:00.000Z") });
    expect(results).toHaveLength(0);
  });

  it("list({ since, until }) combined with diffSource filter", () => {
    store.save(makeReport({ generatedAt: "2024-04-01T00:00:00.000Z", diffSource: "staged" }));
    store.save(makeReport({ generatedAt: "2024-04-01T00:00:00.000Z", diffSource: "branch" }));
    store.save(makeReport({ generatedAt: "2024-01-01T00:00:00.000Z", diffSource: "staged" }));

    const results = store.list({
      diffSource: "staged",
      since: new Date("2024-03-01T00:00:00.000Z"),
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.generatedAt).toBe("2024-04-01T00:00:00.000Z");
  });

  it("list({ since, until }) still respects limit", () => {
    for (let i = 1; i <= 5; i++) {
      store.save(makeReport({ generatedAt: `2024-06-0${i}T00:00:00.000Z` }));
    }
    const results = store.list({
      since: new Date("2024-06-01T00:00:00.000Z"),
      limit: 3,
    });
    expect(results).toHaveLength(3);
  });

  it("search with since filter only searches reviews in range", () => {
    store.save(
      makeReport({ generatedAt: "2024-01-01T00:00:00.000Z", summary: "security bug found" })
    );
    store.save(
      makeReport({ generatedAt: "2024-06-01T00:00:00.000Z", summary: "security bug found" })
    );

    const results = store.search("security", { since: new Date("2024-03-01T00:00:00.000Z") });
    expect(results).toHaveLength(1);
    expect(results[0]?.generatedAt).toBe("2024-06-01T00:00:00.000Z");
  });

  it("search with until filter only searches reviews in range", () => {
    store.save(
      makeReport({ generatedAt: "2024-01-01T00:00:00.000Z", summary: "security bug found" })
    );
    store.save(
      makeReport({ generatedAt: "2024-06-01T00:00:00.000Z", summary: "security bug found" })
    );

    const results = store.search("security", { until: new Date("2024-03-01T00:00:00.000Z") });
    expect(results).toHaveLength(1);
    expect(results[0]?.generatedAt).toBe("2024-01-01T00:00:00.000Z");
  });
});
