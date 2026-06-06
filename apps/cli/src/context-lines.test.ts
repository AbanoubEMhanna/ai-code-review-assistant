import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock simple-git before importing the module under test
const mockDiff = vi.fn();
const mockRevparse = vi.fn();

vi.mock("simple-git", () => ({
  simpleGit: () => ({
    diff: mockDiff,
    revparse: mockRevparse,
  }),
}));

// Dynamic import so the mock is in place first
const { getStagedDiff, getBranchDiff, getFileDiff } = await import("./git.js");

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getStagedDiff context lines", () => {
  it("omits -U flag when contextLines is undefined", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getStagedDiff();
    expect(mockDiff).toHaveBeenCalledWith(["--cached"]);
  });

  it("passes -U0 when contextLines is 0", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getStagedDiff(0);
    expect(mockDiff).toHaveBeenCalledWith(["--cached", "-U0"]);
  });

  it("passes -U10 when contextLines is 10", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getStagedDiff(10);
    expect(mockDiff).toHaveBeenCalledWith(["--cached", "-U10"]);
  });
});

describe("getBranchDiff context lines", () => {
  it("omits -U flag when contextLines is undefined", async () => {
    mockRevparse.mockResolvedValue("abc123");
    mockDiff.mockResolvedValue("diff content");
    await getBranchDiff("main");
    expect(mockDiff).toHaveBeenCalledWith(["main...HEAD"]);
  });

  it("passes -U5 before the range when contextLines is 5", async () => {
    mockRevparse.mockResolvedValue("abc123");
    mockDiff.mockResolvedValue("diff content");
    await getBranchDiff("main", 5);
    expect(mockDiff).toHaveBeenCalledWith(["-U5", "main...HEAD"]);
  });
});

describe("getFileDiff context lines", () => {
  it("omits -U flag when contextLines is undefined", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getFileDiff("src/foo.ts");
    expect(mockDiff).toHaveBeenCalledWith(["HEAD", "--", "src/foo.ts"]);
  });

  it("passes -U15 when contextLines is 15", async () => {
    mockDiff.mockResolvedValue("diff content");
    await getFileDiff("src/foo.ts", 15);
    expect(mockDiff).toHaveBeenCalledWith(["-U15", "HEAD", "--", "src/foo.ts"]);
  });

  it("uses -U flag for staged fallback when HEAD diff is empty", async () => {
    mockDiff
      .mockResolvedValueOnce("") // HEAD diff empty
      .mockResolvedValueOnce("staged diff content"); // staged diff has content
    await getFileDiff("src/foo.ts", 8);
    expect(mockDiff).toHaveBeenNthCalledWith(1, ["-U8", "HEAD", "--", "src/foo.ts"]);
    expect(mockDiff).toHaveBeenNthCalledWith(2, ["-U8", "--cached", "--", "src/foo.ts"]);
  });
});
