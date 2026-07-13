import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFilesDiff } from "./multi-file-diff.js";
import { getFileDiff } from "./git.js";

vi.mock("./git.js", () => ({
  getFileDiff: vi.fn(),
}));

const mockGetFileDiff = vi.mocked(getFileDiff);

describe("getFilesDiff", () => {
  beforeEach(() => {
    mockGetFileDiff.mockReset();
  });

  it("combines diffs from multiple files, preserving input order", async () => {
    mockGetFileDiff.mockImplementation(async (p) => `diff-for-${p}`);

    const result = await getFilesDiff(["z.ts", "a.ts"]);

    expect(result.diff).toBe("diff-for-z.ts\ndiff-for-a.ts");
    expect(result.skipped).toEqual([]);
  });

  it("skips files with no diff and reports them separately", async () => {
    mockGetFileDiff.mockImplementation(async (p) => {
      if (p === "clean.ts") throw new Error('No diff found for "clean.ts".');
      return `diff-for-${p}`;
    });

    const result = await getFilesDiff(["a.ts", "clean.ts", "b.ts"]);

    expect(result.diff).toBe("diff-for-a.ts\ndiff-for-b.ts");
    expect(result.skipped).toEqual(["clean.ts"]);
  });

  it("throws a clear error when none of the files have a diff", async () => {
    mockGetFileDiff.mockRejectedValue(new Error("No diff found."));

    await expect(getFilesDiff(["a.ts", "b.ts"])).rejects.toThrow(
      /No diff found for any of: a\.ts, b\.ts/
    );
  });

  it("works for a single file (backward-compatible with the old single-path command)", async () => {
    mockGetFileDiff.mockResolvedValue("diff-for-a.ts");

    const result = await getFilesDiff(["a.ts"]);

    expect(result.diff).toBe("diff-for-a.ts");
    expect(result.skipped).toEqual([]);
  });
});
