import { describe, expect, it } from "vitest";
import { getDiffStats, isLargeDiff, LARGE_DIFF_TOKEN_THRESHOLD } from "./diff-stats.js";

const MINIMAL_DIFF = `diff --git a/src/index.ts b/src/index.ts
index abc1234..def5678 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
+import foo from 'foo';
 import bar from 'bar';
-import baz from 'baz';
 export default {};
`;

describe("getDiffStats", () => {
  it("returns zero counts for an empty string", () => {
    const stats = getDiffStats("");
    expect(stats.fileCount).toBe(0);
    expect(stats.linesAdded).toBe(0);
    expect(stats.linesRemoved).toBe(0);
    expect(stats.charCount).toBe(0);
    expect(stats.estimatedTokens).toBe(0);
    expect(stats.files).toEqual([]);
  });

  it("counts a single file", () => {
    const stats = getDiffStats(MINIMAL_DIFF);
    expect(stats.fileCount).toBe(1);
    expect(stats.files).toEqual(["src/index.ts"]);
  });

  it("counts multiple files", () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1 +1 @@
+x
diff --git a/src/utils.ts b/src/utils.ts
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1 +1 @@
+y
`;
    const stats = getDiffStats(diff);
    expect(stats.fileCount).toBe(2);
    expect(stats.files).toEqual(["src/index.ts", "src/utils.ts"]);
  });

  it("counts added lines (+ prefix, excluding +++)", () => {
    const diff = `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1,2 +1,4 @@
+added one
+added two
 context
`;
    const stats = getDiffStats(diff);
    expect(stats.linesAdded).toBe(2);
    expect(stats.linesRemoved).toBe(0);
  });

  it("counts removed lines (- prefix, excluding ---)", () => {
    const diff = `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1,3 +1,1 @@
-removed one
-removed two
 context
`;
    const stats = getDiffStats(diff);
    expect(stats.linesAdded).toBe(0);
    expect(stats.linesRemoved).toBe(2);
  });

  it("does not count +++ or --- header lines as changes", () => {
    const stats = getDiffStats(MINIMAL_DIFF);
    expect(stats.linesAdded).toBe(1);
    expect(stats.linesRemoved).toBe(1);
  });

  it("reports correct charCount and estimatedTokens", () => {
    const diff = "x".repeat(400);
    const stats = getDiffStats(diff);
    expect(stats.charCount).toBe(400);
    expect(stats.estimatedTokens).toBe(100); // ceil(400 / 4)
  });

  it("rounds up estimatedTokens for non-multiples of 4", () => {
    const diff = "x".repeat(5);
    const stats = getDiffStats(diff);
    expect(stats.estimatedTokens).toBe(2); // ceil(5 / 4)
  });

  it("handles files with spaces in path", () => {
    const diff = `diff --git a/src/my file.ts b/src/my file.ts
--- a/src/my file.ts
+++ b/src/my file.ts
@@ -1 +1 @@
+x
`;
    const stats = getDiffStats(diff);
    expect(stats.fileCount).toBe(1);
    expect(stats.files).toEqual(["src/my file.ts"]);
  });

  it("handles quoted diff --git headers for paths with special characters", () => {
    const diff = `diff --git "a/src/weird\\"file.ts" "b/src/weird\\"file.ts"
--- "a/src/weird\\"file.ts"
+++ "b/src/weird\\"file.ts"
@@ -1 +1 @@
+x
`;
    const stats = getDiffStats(diff);
    expect(stats.fileCount).toBe(1);
    expect(stats.files).toEqual(['src/weird\\"file.ts']);
  });
});

describe("isLargeDiff", () => {
  it("returns false for a diff well under the threshold", () => {
    const stats = getDiffStats("small diff");
    expect(isLargeDiff(stats)).toBe(false);
  });

  it("returns false for a diff exactly at the threshold", () => {
    const diff = "x".repeat(LARGE_DIFF_TOKEN_THRESHOLD * 4);
    const stats = getDiffStats(diff);
    expect(isLargeDiff(stats)).toBe(false);
  });

  it("returns true for a diff exceeding the threshold by one token", () => {
    const diff = "x".repeat(LARGE_DIFF_TOKEN_THRESHOLD * 4 + 1);
    const stats = getDiffStats(diff);
    expect(isLargeDiff(stats)).toBe(true);
  });
});
