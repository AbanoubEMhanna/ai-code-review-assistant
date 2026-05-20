import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReviewStore } from "./store.js";
import type { ReviewReport } from "./types.js";

function makeReport(overrides?: Partial<ReviewReport>): ReviewReport {
  return {
    generatedAt: new Date().toISOString(),
    model: "test-model",
    diffSource: "staged changes",
    summary: "Test summary",
    comments: [],
    stats: { high: 0, medium: 0, low: 0, info: 0, total: 0 },
    ...overrides,
  };
}

describe("ReviewStore", () => {
  let dir: string;
  let store: ReviewStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "review-store-test-"));
    store = new ReviewStore(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("saves a review and returns a stored review with an id", () => {
    const stored = store.save(makeReport());
    expect(stored.id).toMatch(/^\d+-[0-9a-f-]+$/);
    expect(stored.summary).toBe("Test summary");
    expect(stored.savedAt).toBeDefined();
  });

  it("retrieves a saved review by id", () => {
    const stored = store.save(makeReport());
    const retrieved = store.get(stored.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(stored.id);
    expect(retrieved?.summary).toBe("Test summary");
  });

  it("returns null for an unknown id", () => {
    const result = store.get("9999999999999-aabbccdd-eeff-0011-2233-445566778899");
    expect(result).toBeNull();
  });

  it("throws for an invalid id format on get", () => {
    expect(() => store.get("../../etc/passwd")).toThrow("Invalid review ID format");
  });

  it("throws for an invalid id format on delete", () => {
    expect(() => store.delete("../bad-id")).toThrow("Invalid review ID format");
  });

  it("lists reviews sorted newest first", async () => {
    const first = store.save(makeReport({ diffSource: "first" }));
    await new Promise<void>((r) => setTimeout(r, 10));
    const second = store.save(makeReport({ diffSource: "second" }));
    const list = store.list();
    expect(list).toHaveLength(2);
    expect(list[0]?.id).toBe(second.id);
    expect(list[1]?.id).toBe(first.id);
  });

  it("respects the limit option", () => {
    store.save(makeReport());
    store.save(makeReport());
    store.save(makeReport());
    const list = store.list({ limit: 2 });
    expect(list).toHaveLength(2);
  });

  it("filters by diffSource", () => {
    store.save(makeReport({ diffSource: "staged changes" }));
    store.save(makeReport({ diffSource: "diff vs main" }));
    const list = store.list({ diffSource: "staged changes" });
    expect(list).toHaveLength(1);
    expect(list[0]?.diffSource).toBe("staged changes");
  });

  it("deletes a review by id and returns true", () => {
    const stored = store.save(makeReport());
    expect(store.delete(stored.id)).toBe(true);
    expect(store.get(stored.id)).toBeNull();
  });

  it("returns false when deleting a non-existent id", () => {
    const result = store.delete("9999999999999-aabbccdd-eeff-0011-2233-445566778899");
    expect(result).toBe(false);
  });

  it("clears all reviews and returns the count", () => {
    store.save(makeReport());
    store.save(makeReport());
    const cleared = store.clear();
    expect(cleared).toBe(2);
    expect(store.list()).toHaveLength(0);
  });

  it("returns empty list when store directory is empty", () => {
    expect(store.list()).toHaveLength(0);
  });
});
