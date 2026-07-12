import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReviewReport } from "@ai-review/shared";
import { ReviewHistoryStore } from "./history-store.js";
import { buildMarkdown, saveMarkdown } from "./output.js";

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

function sanitizeName(diffSource: string): string {
  return diffSource.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
}

let storeDir: string;
let exportDir: string;
let store: ReviewHistoryStore;

beforeEach(() => {
  storeDir = mkdtempSync(join(tmpdir(), "ai-review-store-"));
  exportDir = mkdtempSync(join(tmpdir(), "ai-review-export-"));
  store = new ReviewHistoryStore(storeDir);
});

afterEach(() => {
  rmSync(storeDir, { recursive: true });
  rmSync(exportDir, { recursive: true });
});

describe("history export-all: filename sanitization", () => {
  it("preserves alphanumeric characters", () => {
    expect(sanitizeName("staged changes")).toBe("staged_changes");
  });

  it("replaces slashes and colons with underscores", () => {
    expect(sanitizeName("diff vs main/feature")).toBe("diff_vs_main_feature");
    expect(sanitizeName("file: src/foo.ts")).toBe("file__src_foo.ts");
  });

  it("preserves dots and hyphens", () => {
    expect(sanitizeName("branch-diff.ts")).toBe("branch-diff.ts");
  });

  it("truncates long names to 60 characters", () => {
    const long = "a".repeat(80);
    expect(sanitizeName(long)).toHaveLength(60);
  });
});

describe("history export-all: file output", () => {
  it("writes a valid Markdown file for a review", () => {
    const report = makeReport({ summary: "All clear", diffSource: "staged changes" });
    const stored = store.save(report);
    const safeName = sanitizeName(stored.diffSource);
    const filename = `${stored.id}_${safeName}.md`;
    saveMarkdown(stored, join(exportDir, filename));

    expect(existsSync(join(exportDir, filename))).toBe(true);
    const content = readFileSync(join(exportDir, filename), "utf8");
    expect(content).toContain("# AI Code Review Report");
    expect(content).toContain("All clear");
  });

  it("buildMarkdown includes stats table and source", () => {
    const report = makeReport({
      diffSource: "diff vs main",
      summary: "Minor issues",
      comments: [
        {
          file: "src/foo.ts",
          severity: "low",
          category: "style",
          message: "Consider renaming",
        },
      ],
      stats: { high: 0, medium: 0, low: 1, info: 0, total: 1 },
    });
    const md = buildMarkdown(report);
    expect(md).toContain("diff vs main");
    expect(md).toContain("Consider renaming");
    expect(md).toContain("| 🔵 Low | 1 |");
  });

  it("exports multiple reviews to separate files", () => {
    const r1 = store.save(makeReport({ diffSource: "staged changes" }));
    const r2 = store.save(makeReport({ diffSource: "diff vs main" }));

    for (const r of [r1, r2]) {
      const safeName = sanitizeName(r.diffSource);
      const filename = `${r.id}_${safeName}.md`;
      saveMarkdown(r, join(exportDir, filename));
    }

    const exported = readdirSync(exportDir).filter((f) => f.endsWith(".md"));
    expect(exported).toHaveLength(2);
    expect(exported.some((f) => f.includes("staged_changes"))).toBe(true);
    expect(exported.some((f) => f.includes("diff_vs_main"))).toBe(true);
  });

  it("each exported file contains the correct review content", () => {
    const report = makeReport({
      model: "claude-sonnet-4-6",
      diffSource: "branch: feature-x",
      summary: "Security concern found",
      comments: [
        {
          file: "auth.ts",
          severity: "high",
          category: "security",
          message: "Missing authentication",
        },
      ],
      stats: { high: 1, medium: 0, low: 0, info: 0, total: 1 },
    });
    const stored = store.save(report);
    const safeName = sanitizeName(stored.diffSource);
    const filename = `${stored.id}_${safeName}.md`;
    saveMarkdown(stored, join(exportDir, filename));

    const content = readFileSync(join(exportDir, filename), "utf8");
    expect(content).toContain("Security concern found");
    expect(content).toContain("Missing authentication");
    expect(content).toContain("| 🔴 High | 1 |");
    expect(content).toContain("claude-sonnet-4-6");
  });

  it("empty store produces no files", () => {
    const files = store.list();
    expect(files).toHaveLength(0);
    const exported = readdirSync(exportDir).filter((f) => f.endsWith(".md"));
    expect(exported).toHaveLength(0);
  });
});
