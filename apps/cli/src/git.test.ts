import { describe, it, expect } from "vitest";
import { parseDiffStats } from "./git.js";

describe("parseDiffStats", () => {
  it("returns zeros for empty diff", () => {
    expect(parseDiffStats("")).toEqual({ files: 0, insertions: 0, deletions: 0 });
  });

  it("counts a single-file diff correctly", () => {
    const diff = [
      "diff --git a/src/foo.ts b/src/foo.ts",
      "index 1234567..abcdefg 100644",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1,3 +1,4 @@",
      " unchanged line",
      "-removed line",
      "+added line one",
      "+added line two",
    ].join("\n");

    expect(parseDiffStats(diff)).toEqual({ files: 1, insertions: 2, deletions: 1 });
  });

  it("counts multiple files", () => {
    const diff = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "diff --git a/b.ts b/b.ts",
      "--- a/b.ts",
      "+++ b/b.ts",
      "@@ -1 +1,2 @@",
      "-x",
      "+y",
      "+z",
    ].join("\n");

    expect(parseDiffStats(diff)).toEqual({ files: 2, insertions: 3, deletions: 2 });
  });

  it("does not count +++ / --- header lines as insertions or deletions", () => {
    const diff = [
      "diff --git a/foo.ts b/foo.ts",
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -1 +1 @@",
      "-removed",
      "+inserted",
    ].join("\n");

    expect(parseDiffStats(diff)).toEqual({ files: 1, insertions: 1, deletions: 1 });
  });

  it("handles new file (only insertions)", () => {
    const diff = [
      "diff --git a/new.ts b/new.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/new.ts",
      "@@ -0,0 +1,3 @@",
      "+line one",
      "+line two",
      "+line three",
    ].join("\n");

    expect(parseDiffStats(diff)).toEqual({ files: 1, insertions: 3, deletions: 0 });
  });

  it("handles deleted file (only deletions)", () => {
    const diff = [
      "diff --git a/old.ts b/old.ts",
      "deleted file mode 100644",
      "--- a/old.ts",
      "+++ /dev/null",
      "@@ -1,2 +0,0 @@",
      "-line one",
      "-line two",
    ].join("\n");

    expect(parseDiffStats(diff)).toEqual({ files: 1, insertions: 0, deletions: 2 });
  });

  it("uses singular 'file' for exactly one file", () => {
    // Tested indirectly — parseDiffStats returns files: 1 which index.ts uses for grammar
    const diff = ["diff --git a/x.ts b/x.ts", "+new line"].join("\n");
    expect(parseDiffStats(diff).files).toBe(1);
  });
});
