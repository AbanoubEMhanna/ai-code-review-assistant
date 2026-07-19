import { describe, expect, it } from "vitest";
import { summarizeBinaryChanges } from "./git.js";

describe("summarizeBinaryChanges()", () => {
  it("leaves a text-only diff untouched", () => {
    const diff = [
      "diff --git a/src/app.ts b/src/app.ts",
      "index abc123..def456 100644",
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1,3 +1,3 @@",
      "-const x = 1;",
      "+const x = 2;",
    ].join("\n");
    expect(summarizeBinaryChanges(diff)).toBe(diff);
  });

  it("replaces a single binary file section with a summary line", () => {
    const diff = [
      "diff --git a/logo.png b/logo.png",
      "index 111..222 100644",
      "Binary files a/logo.png and b/logo.png differ",
    ].join("\n");
    const result = summarizeBinaryChanges(diff);
    expect(result).toContain("diff --git a/logo.png b/logo.png");
    expect(result).toContain(
      "Binary file changed: logo.png (contents omitted — binary files are not reviewed)"
    );
    expect(result).not.toContain("Binary files a/logo.png and b/logo.png differ");
  });

  it("summarizes GIT binary patch sections too", () => {
    const diff = [
      "diff --git a/asset.bin b/asset.bin",
      "index 111..222 100644",
      "GIT binary patch",
      "literal 12",
      "some encoded bytes here",
    ].join("\n");
    const result = summarizeBinaryChanges(diff);
    expect(result).toContain(
      "Binary file changed: asset.bin (contents omitted — binary files are not reviewed)"
    );
    expect(result).not.toContain("some encoded bytes here");
  });

  it("preserves text sections and summarizes only the binary ones in a mixed diff", () => {
    const diff = [
      "diff --git a/src/app.ts b/src/app.ts",
      "index abc123..def456 100644",
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1,3 +1,3 @@",
      "-const x = 1;",
      "+const x = 2;",
      "diff --git a/logo.png b/logo.png",
      "index 111..222 100644",
      "Binary files a/logo.png and b/logo.png differ",
      "diff --git a/README.md b/README.md",
      "index 333..444 100644",
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1 +1 @@",
      "-old",
      "+new",
    ].join("\n");
    const result = summarizeBinaryChanges(diff);
    expect(result).toContain("-const x = 1;");
    expect(result).toContain("+const x = 2;");
    expect(result).toContain(
      "Binary file changed: logo.png (contents omitted — binary files are not reviewed)"
    );
    expect(result).not.toContain("Binary files a/logo.png and b/logo.png differ");
    expect(result).toContain("-old");
    expect(result).toContain("+new");
  });

  it("handles multiple binary files in one diff", () => {
    const diff = [
      "diff --git a/a.png b/a.png",
      "index 1..2 100644",
      "Binary files a/a.png and b/a.png differ",
      "diff --git a/b.jpg b/b.jpg",
      "index 3..4 100644",
      "Binary files a/b.jpg and b/b.jpg differ",
    ].join("\n");
    const result = summarizeBinaryChanges(diff);
    expect(result).toContain(
      "Binary file changed: a.png (contents omitted — binary files are not reviewed)"
    );
    expect(result).toContain(
      "Binary file changed: b.jpg (contents omitted — binary files are not reviewed)"
    );
  });

  it("returns an empty string for empty input", () => {
    expect(summarizeBinaryChanges("")).toBe("");
  });
});
