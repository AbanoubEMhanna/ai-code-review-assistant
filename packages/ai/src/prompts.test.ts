import { describe, expect, it } from "vitest";
import { buildUserPrompt, truncateDiff, DEFAULT_MAX_DIFF_CHARS } from "./prompts.js";

describe("truncateDiff", () => {
  it("returns the diff unchanged when under the limit", () => {
    const diff = "diff --git a/foo.ts b/foo.ts\n+console.log('hi');\n";
    const result = truncateDiff(diff, 1000);
    expect(result).toEqual({ diff, truncated: false, originalLength: diff.length });
  });

  it("returns the diff unchanged when exactly at the limit", () => {
    const diff = "a".repeat(50);
    const result = truncateDiff(diff, 50);
    expect(result).toEqual({ diff, truncated: false, originalLength: 50 });
  });

  it("truncates and flags diffs over the limit", () => {
    const diff = "a".repeat(100);
    const result = truncateDiff(diff, 40);
    expect(result.truncated).toBe(true);
    expect(result.diff).toBe("a".repeat(40));
    expect(result.originalLength).toBe(100);
  });

  it("uses DEFAULT_MAX_DIFF_CHARS when no limit is passed", () => {
    const diff = "a".repeat(DEFAULT_MAX_DIFF_CHARS + 1);
    const result = truncateDiff(diff);
    expect(result.truncated).toBe(true);
    expect(result.diff.length).toBe(DEFAULT_MAX_DIFF_CHARS);
  });

  it.each([-1, 0, 2.5, NaN, Infinity, -Infinity])(
    "falls back to DEFAULT_MAX_DIFF_CHARS for an invalid maxChars (%s)",
    (invalidLimit) => {
      const diff = "a".repeat(10);
      const result = truncateDiff(diff, invalidLimit);
      expect(result).toEqual({ diff, truncated: false, originalLength: diff.length });
    }
  );

  it("falls back to DEFAULT_MAX_DIFF_CHARS and still truncates oversized diffs given an invalid maxChars", () => {
    const diff = "a".repeat(DEFAULT_MAX_DIFF_CHARS + 1);
    const result = truncateDiff(diff, NaN);
    expect(result.truncated).toBe(true);
    expect(result.diff.length).toBe(DEFAULT_MAX_DIFF_CHARS);
  });
});

describe("buildUserPrompt", () => {
  it("includes the full diff and source with no truncation note when under the limit", () => {
    const diff = "diff --git a/foo.ts b/foo.ts\n+const x = 1;\n";
    const prompt = buildUserPrompt(diff, "staged changes", 1000);
    expect(prompt).toContain("Review this git diff (staged changes):");
    expect(prompt).toContain(diff);
    expect(prompt).not.toContain("[NOTE:");
  });

  it("truncates oversized diffs and appends a truncation note", () => {
    const diff = "x".repeat(200);
    const prompt = buildUserPrompt(diff, "diff vs main", 50);
    expect(prompt).toContain("x".repeat(50));
    expect(prompt).not.toContain("x".repeat(51));
    expect(prompt).toContain("[NOTE: This diff was truncated to 50 of 200 total characters");
    expect(prompt).toContain("mention this limitation in your summary");
  });
});
