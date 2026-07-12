import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDiff, mockRevparse } = vi.hoisted(() => ({
  mockDiff: vi.fn(),
  mockRevparse: vi.fn(),
}));

vi.mock("simple-git", () => ({
  simpleGit: () => ({
    diff: mockDiff,
    revparse: mockRevparse,
    raw: vi.fn(),
  }),
}));

import { getRefDiff } from "./git.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getRefDiff()", () => {
  it("throws when ref1 is empty", async () => {
    await expect(getRefDiff("", "main")).rejects.toThrow("First ref cannot be empty");
  });

  it("throws when ref1 is whitespace-only", async () => {
    await expect(getRefDiff("   ", "main")).rejects.toThrow("First ref cannot be empty");
  });

  it("throws when ref2 is empty", async () => {
    await expect(getRefDiff("main", "")).rejects.toThrow("Second ref cannot be empty");
  });

  it("throws when ref1 cannot be resolved", async () => {
    mockRevparse.mockRejectedValueOnce(new Error("unknown revision"));
    await expect(getRefDiff("nonexistent", "main")).rejects.toThrow(
      'ref1 "nonexistent" not found in this repository'
    );
  });

  it("throws when ref2 cannot be resolved", async () => {
    mockRevparse.mockResolvedValueOnce("abc123"); // ref1 resolves
    mockRevparse.mockRejectedValueOnce(new Error("unknown revision")); // ref2 fails
    await expect(getRefDiff("main", "nonexistent")).rejects.toThrow(
      'ref2 "nonexistent" not found in this repository'
    );
  });

  it("throws when there is no diff between the two refs", async () => {
    mockRevparse.mockResolvedValue("abc123");
    mockDiff.mockResolvedValue("   ");
    await expect(getRefDiff("main", "feature")).rejects.toThrow(
      'No differences found between "main" and "feature"'
    );
  });

  it("returns the diff string on success", async () => {
    const fakeDiff = "diff --git a/foo.ts b/foo.ts\n+new line\n";
    mockRevparse.mockResolvedValue("abc123");
    mockDiff.mockResolvedValue(fakeDiff);

    const result = await getRefDiff("main", "feature");
    expect(result).toBe(fakeDiff);
  });

  it("passes the two-dot range to git diff", async () => {
    mockRevparse.mockResolvedValue("abc123");
    mockDiff.mockResolvedValue("diff --git a/x.ts b/x.ts\n+line\n");

    await getRefDiff("v1.0.0", "HEAD");
    expect(mockDiff).toHaveBeenCalledWith(["v1.0.0..HEAD"]);
  });

  it("trims whitespace from both refs", async () => {
    const fakeDiff = "diff --git a/y.ts b/y.ts\n-old\n";
    mockRevparse.mockResolvedValue("abc123");
    mockDiff.mockResolvedValue(fakeDiff);

    await getRefDiff("  main  ", "  HEAD  ");
    expect(mockRevparse).toHaveBeenNthCalledWith(1, ["main"]);
    expect(mockRevparse).toHaveBeenNthCalledWith(2, ["HEAD"]);
    expect(mockDiff).toHaveBeenCalledWith(["main..HEAD"]);
  });
});
