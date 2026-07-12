import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDiff, mockRevparse } = vi.hoisted(() => ({
  mockDiff: vi.fn<(args: string[]) => Promise<string>>(),
  mockRevparse: vi.fn<(args: string[]) => Promise<string>>(),
}));

vi.mock("simple-git", () => ({
  simpleGit: () => ({ diff: mockDiff, revparse: mockRevparse }),
}));

import { getStagedDiff, getBranchDiff, getFileDiff } from "./git.js";

beforeEach(() => {
  mockDiff.mockReset();
  mockRevparse.mockReset();
  mockRevparse.mockResolvedValue("abc123");
});

describe("getStagedDiff exclude patterns", () => {
  it("passes no extra args when exclude is omitted", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getStagedDiff();
    expect(mockDiff).toHaveBeenCalledWith(["--cached"]);
  });

  it("passes no extra args when exclude is empty array", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getStagedDiff([]);
    expect(mockDiff).toHaveBeenCalledWith(["--cached"]);
  });

  it("appends pathspec exclusions for each pattern", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getStagedDiff(["*.lock", "dist/**"]);
    expect(mockDiff).toHaveBeenCalledWith([
      "--cached",
      "--",
      ":(exclude)*.lock",
      ":(exclude)dist/**",
    ]);
  });

  it("throws when diff is empty after exclusions", async () => {
    mockDiff.mockResolvedValue("   ");
    await expect(getStagedDiff(["*.ts"])).rejects.toThrow("No staged changes found");
  });
});

describe("getBranchDiff exclude patterns", () => {
  it("passes no extra args when exclude is omitted", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getBranchDiff("main");
    expect(mockDiff).toHaveBeenCalledWith(["main...HEAD"]);
  });

  it("passes no extra args when exclude is empty array", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getBranchDiff("main", []);
    expect(mockDiff).toHaveBeenCalledWith(["main...HEAD"]);
  });

  it("appends pathspec exclusions for each pattern", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getBranchDiff("main", ["pnpm-lock.yaml", "*.snap"]);
    expect(mockDiff).toHaveBeenCalledWith([
      "main...HEAD",
      "--",
      ":(exclude)pnpm-lock.yaml",
      ":(exclude)*.snap",
    ]);
  });
});

describe("getFileDiff exclude patterns", () => {
  it("passes no extra args when exclude is omitted", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getFileDiff("src/index.ts");
    expect(mockDiff).toHaveBeenCalledWith(["HEAD", "--", "src/index.ts"]);
  });

  it("passes no extra args when exclude is empty array", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getFileDiff("src/index.ts", []);
    expect(mockDiff).toHaveBeenCalledWith(["HEAD", "--", "src/index.ts"]);
  });

  it("appends pathspec exclusions on HEAD diff", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getFileDiff("src/index.ts", ["*.snap"]);
    expect(mockDiff).toHaveBeenCalledWith(["HEAD", "--", "src/index.ts", ":(exclude)*.snap"]);
  });

  it("appends pathspec exclusions on staged fallback diff", async () => {
    mockDiff.mockResolvedValueOnce("   ").mockResolvedValueOnce("staged content");
    await getFileDiff("src/index.ts", ["*.snap"]);
    expect(mockDiff).toHaveBeenNthCalledWith(2, [
      "--cached",
      "--",
      "src/index.ts",
      ":(exclude)*.snap",
    ]);
  });

  it("handles conflicting pathspec when file matches exclude pattern", async () => {
    // Documents current behavior: both filePath and exclude pathspec are passed
    // even when filePath matches the exclude glob; git resolves the conflict
    mockDiff.mockResolvedValue("diff content");
    await getFileDiff("package-lock.json", ["*.lock"]);
    expect(mockDiff).toHaveBeenCalledWith(["HEAD", "--", "package-lock.json", ":(exclude)*.lock"]);
  });
});
