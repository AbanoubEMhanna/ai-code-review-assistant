import { describe, expect, it } from "vitest";
import { filterDiff, getDefaultIgnorePatterns, matchesIgnorePattern } from "./diff-filter.js";

function diffFor(path: string, content = "@@ -1 +1 @@\n-old\n+new\n"): string {
  return (
    `diff --git a/${path} b/${path}\n` +
    `index 111..222 100644\n` +
    `--- a/${path}\n` +
    `+++ b/${path}\n` +
    content
  );
}

describe("matchesIgnorePattern()", () => {
  it("matches an exact filename anywhere in the path", () => {
    expect(matchesIgnorePattern("pnpm-lock.yaml", "pnpm-lock.yaml")).toBe(true);
    expect(matchesIgnorePattern("nested/dir/pnpm-lock.yaml", "pnpm-lock.yaml")).toBe(true);
  });

  it("does not match a different filename", () => {
    expect(matchesIgnorePattern("src/index.ts", "pnpm-lock.yaml")).toBe(false);
  });

  it("supports * within a segment", () => {
    expect(matchesIgnorePattern("app.min.js", "*.min.js")).toBe(true);
    expect(matchesIgnorePattern("dir/app.min.js", "*.min.js")).toBe(true);
    expect(matchesIgnorePattern("app.js", "*.min.js")).toBe(false);
  });

  it("supports ** for matching across directories when pattern has a slash", () => {
    expect(matchesIgnorePattern("dist/index.js", "dist/**")).toBe(true);
    expect(matchesIgnorePattern("dist/nested/index.js", "dist/**")).toBe(true);
    expect(matchesIgnorePattern("src/dist.ts", "dist/**")).toBe(false);
  });

  it("treats a leading slash as project-root anchored", () => {
    expect(matchesIgnorePattern("pnpm-lock.yaml", "/pnpm-lock.yaml")).toBe(true);
  });

  it("ignores an empty pattern", () => {
    expect(matchesIgnorePattern("anything.ts", "")).toBe(false);
  });
});

describe("getDefaultIgnorePatterns()", () => {
  it("returns a non-empty list including common lockfiles", () => {
    const patterns = getDefaultIgnorePatterns();
    expect(patterns).toContain("pnpm-lock.yaml");
    expect(patterns.length).toBeGreaterThan(0);
  });

  it("returns a fresh array each call (not a shared mutable reference)", () => {
    const a = getDefaultIgnorePatterns();
    a.push("mutated");
    const b = getDefaultIgnorePatterns();
    expect(b).not.toContain("mutated");
  });
});

describe("filterDiff()", () => {
  it("returns the diff unchanged when no patterns are given", () => {
    const diff = diffFor("src/index.ts");
    expect(filterDiff(diff, [])).toEqual({ filtered: diff, ignoredFiles: [] });
  });

  it("drops a file block matching an ignore pattern", () => {
    const diff = diffFor("src/index.ts") + diffFor("pnpm-lock.yaml");
    const result = filterDiff(diff, ["pnpm-lock.yaml"]);
    expect(result.ignoredFiles).toEqual(["pnpm-lock.yaml"]);
    expect(result.filtered).toContain("src/index.ts");
    expect(result.filtered).not.toContain("pnpm-lock.yaml");
  });

  it("keeps all files when nothing matches", () => {
    const diff = diffFor("src/a.ts") + diffFor("src/b.ts");
    const result = filterDiff(diff, ["*.min.js"]);
    expect(result.ignoredFiles).toEqual([]);
    expect(result.filtered).toBe(diff);
  });

  it("filters multiple matching files across several patterns", () => {
    const diff = diffFor("src/index.ts") + diffFor("dist/bundle.js") + diffFor("app.min.js");
    const result = filterDiff(diff, ["dist/**", "*.min.js"]);
    expect(result.ignoredFiles.sort()).toEqual(["app.min.js", "dist/bundle.js"]);
    expect(result.filtered.trim()).toBe(diffFor("src/index.ts").trim());
  });

  it("can filter every file down to an empty diff", () => {
    const diff = diffFor("pnpm-lock.yaml");
    const result = filterDiff(diff, ["pnpm-lock.yaml"]);
    expect(result.filtered).toBe("");
    expect(result.ignoredFiles).toEqual(["pnpm-lock.yaml"]);
  });

  it("handles a new file (--- /dev/null) by keying off the b/ path", () => {
    const diff =
      "diff --git a/dist/new.js b/dist/new.js\n" +
      "new file mode 100644\n" +
      "index 000..111\n" +
      "--- /dev/null\n" +
      "+++ b/dist/new.js\n" +
      "@@ -0,0 +1 @@\n+content\n";
    const result = filterDiff(diff, ["dist/**"]);
    expect(result.ignoredFiles).toEqual(["dist/new.js"]);
  });

  it("handles a deleted file (+++ /dev/null) by keying off the a/ path", () => {
    const diff =
      "diff --git a/dist/old.js b/dist/old.js\n" +
      "deleted file mode 100644\n" +
      "index 111..000\n" +
      "--- a/dist/old.js\n" +
      "+++ /dev/null\n" +
      "@@ -1 +0,0 @@\n-content\n";
    const result = filterDiff(diff, ["dist/**"]);
    expect(result.ignoredFiles).toEqual(["dist/old.js"]);
  });

  it("returns the diff unchanged for an empty/whitespace-only diff", () => {
    expect(filterDiff("   \n", ["*"])).toEqual({ filtered: "   \n", ignoredFiles: [] });
  });
});
