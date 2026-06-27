import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReviewReport } from "@ai-review/shared";
import { ReviewHistoryStore } from "./history-store.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeReport(daysAgo = 0, overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    generatedAt: new Date(Date.now() - daysAgo * DAY_MS).toISOString(),
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
  dir = mkdtempSync(join(tmpdir(), "ai-review-prune-test-"));
  store = new ReviewHistoryStore(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true });
});

describe("ReviewHistoryStore.prune() — keepLast", () => {
  it("returns empty result when store is empty", () => {
    const result = store.prune({ keepLast: 5 });
    expect(result.deleted).toHaveLength(0);
    expect(result.kept).toBe(0);
  });

  it("keeps newest N reviews, deletes the rest", () => {
    for (let i = 0; i < 10; i++) store.save(makeReport());
    const result = store.prune({ keepLast: 3 });
    expect(result.deleted).toHaveLength(7);
    expect(result.kept).toBe(3);
    expect(store.list()).toHaveLength(3);
  });

  it("keepLast larger than total keeps everything", () => {
    for (let i = 0; i < 5; i++) store.save(makeReport());
    const result = store.prune({ keepLast: 10 });
    expect(result.deleted).toHaveLength(0);
    expect(result.kept).toBe(5);
    expect(store.list()).toHaveLength(5);
  });

  it("keepLast equal to total keeps everything", () => {
    for (let i = 0; i < 4; i++) store.save(makeReport());
    const result = store.prune({ keepLast: 4 });
    expect(result.deleted).toHaveLength(0);
    expect(result.kept).toBe(4);
  });

  it("keepLast 0 deletes everything", () => {
    for (let i = 0; i < 4; i++) store.save(makeReport());
    const result = store.prune({ keepLast: 0 });
    expect(result.deleted).toHaveLength(4);
    expect(result.kept).toBe(0);
    expect(store.list()).toHaveLength(0);
  });

  it("keepLast 1 keeps exactly one review", () => {
    for (let i = 0; i < 6; i++) store.save(makeReport());
    const result = store.prune({ keepLast: 1 });
    expect(result.deleted).toHaveLength(5);
    expect(result.kept).toBe(1);
    expect(store.list()).toHaveLength(1);
  });
});

describe("ReviewHistoryStore.prune() — olderThan", () => {
  it("deletes reviews older than the cutoff", () => {
    store.save(makeReport(1)); // 1 day old → keep
    store.save(makeReport(5)); // 5 days old → keep
    store.save(makeReport(10)); // 10 days old → delete
    store.save(makeReport(20)); // 20 days old → delete

    const result = store.prune({ olderThanMs: 7 * DAY_MS });
    expect(result.deleted).toHaveLength(2);
    expect(result.kept).toBe(2);
    expect(store.list()).toHaveLength(2);
  });

  it("keeps all when none are old enough", () => {
    for (let i = 0; i < 4; i++) store.save(makeReport(1));
    const result = store.prune({ olderThanMs: 30 * DAY_MS });
    expect(result.deleted).toHaveLength(0);
    expect(result.kept).toBe(4);
  });

  it("deletes all when all exceed the cutoff", () => {
    for (let i = 0; i < 3; i++) store.save(makeReport(60));
    const result = store.prune({ olderThanMs: 7 * DAY_MS });
    expect(result.deleted).toHaveLength(3);
    expect(result.kept).toBe(0);
    expect(store.list()).toHaveLength(0);
  });

  it("returns IDs of the deleted reviews", () => {
    const recent = store.save(makeReport(1));
    const old = store.save(makeReport(30));
    const result = store.prune({ olderThanMs: 7 * DAY_MS });
    expect(result.deleted).toContain(old.id);
    expect(result.deleted).not.toContain(recent.id);
  });
});

describe("ReviewHistoryStore.prune() — combined", () => {
  it("deletes union of keepLast and olderThan conditions", () => {
    // 4 reviews; keepLast=3 would delete the 4th (oldest by save time),
    // olderThan=7d would delete the 15d-old one.
    store.save(makeReport(1));
    store.save(makeReport(2));
    store.save(makeReport(5));
    store.save(makeReport(15));

    const result = store.prune({ keepLast: 3, olderThanMs: 7 * DAY_MS });
    // The 15d review matches both conditions → 1 unique entry deleted
    expect(result.deleted).toHaveLength(1);
    expect(result.kept).toBe(3);
  });

  it("both conditions can independently contribute deletions", () => {
    // 5 reviews; keepLast=3 deletes 2 oldest-by-save-order,
    // olderThan=7d deletes the 10d and 15d ones.
    store.save(makeReport(1));
    store.save(makeReport(2));
    store.save(makeReport(5));
    store.save(makeReport(10));
    store.save(makeReport(15));

    const result = store.prune({ keepLast: 3, olderThanMs: 7 * DAY_MS });
    // keepLast=3 → delete 10d and 15d (4th and 5th by save time)
    // olderThan=7d → delete 10d and 15d
    // Union = {10d, 15d} → 2 deleted, 3 kept
    expect(result.deleted).toHaveLength(2);
    expect(result.kept).toBe(3);
  });
});

describe("ReviewHistoryStore.prune() — dry-run", () => {
  it("does not delete anything when dryRun=true", () => {
    for (let i = 0; i < 5; i++) store.save(makeReport(i * 10));
    const result = store.prune({ keepLast: 2 }, true);
    expect(result.deleted).toHaveLength(3);
    // Store still has all 5 reviews
    expect(store.list()).toHaveLength(5);
  });

  it("returns the same count as a real prune would", () => {
    for (let i = 0; i < 8; i++) store.save(makeReport());
    const dryResult = store.prune({ keepLast: 3 }, true);
    const realResult = store.prune({ keepLast: 3 }, false);
    expect(dryResult.deleted).toHaveLength(realResult.deleted.length);
    expect(dryResult.kept).toBe(realResult.kept);
  });
});
