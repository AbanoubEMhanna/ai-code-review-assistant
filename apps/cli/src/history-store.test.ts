import { rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
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
  dir = mkdtempSync(join(tmpdir(), "ai-review-cli-test-"));
  store = new ReviewHistoryStore(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true });
});

describe("ReviewHistoryStore.search()", () => {
  it("returns empty array for blank query", () => {
    store.save(makeReport({ summary: "looks good" }));
    expect(store.search("")).toHaveLength(0);
    expect(store.search("   ")).toHaveLength(0);
  });

  it("matches on diffSource", () => {
    store.save(makeReport({ diffSource: "staged changes" }));
    store.save(makeReport({ diffSource: "diff vs main" }));
    const results = store.search("staged");
    expect(results).toHaveLength(1);
    expect(results[0]?.diffSource).toBe("staged changes");
  });

  it("matches on summary text", () => {
    store.save(makeReport({ summary: "Found SQL injection vulnerability" }));
    store.save(makeReport({ summary: "No issues found." }));
    const results = store.search("sql injection");
    expect(results).toHaveLength(1);
    expect(results[0]?.summary).toContain("SQL injection");
  });

  it("matches on model name", () => {
    store.save(makeReport({ model: "llama3:latest" }));
    store.save(makeReport({ model: "qwen3:latest" }));
    const results = store.search("llama");
    expect(results).toHaveLength(1);
    expect(results[0]?.model).toBe("llama3:latest");
  });

  it("matches on comment messages", () => {
    store.save(
      makeReport({
        comments: [
          {
            file: "src/auth.ts",
            severity: "high",
            category: "security",
            message: "Missing input sanitization allows XSS",
          },
        ],
        stats: { high: 1, medium: 0, low: 0, info: 0, total: 1 },
      })
    );
    store.save(makeReport({ summary: "Clean code, no issues." }));
    const results = store.search("sanitization");
    expect(results).toHaveLength(1);
  });

  it("is case-insensitive", () => {
    store.save(makeReport({ summary: "Found a Security Issue" }));
    expect(store.search("security issue")).toHaveLength(1);
    expect(store.search("SECURITY ISSUE")).toHaveLength(1);
    expect(store.search("Security")).toHaveLength(1);
  });

  it("requires all terms to match (AND semantics)", () => {
    store.save(makeReport({ summary: "Bug in authentication module" }));
    store.save(makeReport({ summary: "Performance issue in authentication" }));
    const results = store.search("bug authentication");
    expect(results).toHaveLength(1);
    expect(results[0]?.summary).toContain("Bug");
  });

  it("respects limit option", () => {
    for (let i = 0; i < 5; i++) {
      store.save(makeReport({ summary: "repeated keyword issue" }));
    }
    expect(store.search("repeated", { limit: 3 })).toHaveLength(3);
  });

  it("returns all matches when no limit is set", () => {
    for (let i = 0; i < 4; i++) {
      store.save(makeReport({ summary: "findme" }));
    }
    expect(store.search("findme")).toHaveLength(4);
  });

  it("returns empty when query does not match anything", () => {
    store.save(makeReport({ summary: "No issues found" }));
    expect(store.search("xyznotfound123")).toHaveLength(0);
  });

  it("returns empty when store is empty", () => {
    expect(store.search("anything")).toHaveLength(0);
  });
});
