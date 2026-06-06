import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRaw, mockRevparse } = vi.hoisted(() => ({
  mockRaw: vi.fn(),
  mockRevparse: vi.fn(),
}));

vi.mock("simple-git", () => ({
  simpleGit: () => ({
    diff: vi.fn(),
    revparse: mockRevparse,
    raw: mockRaw,
  }),
}));

import { getCommitDiff } from "./git.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCommitDiff()", () => {
  it("throws on an empty string", async () => {
    await expect(getCommitDiff("")).rejects.toThrow("cannot be empty");
  });

  it("throws on a whitespace-only string", async () => {
    await expect(getCommitDiff("   ")).rejects.toThrow("cannot be empty");
  });

  it("throws when revparse cannot resolve the ref", async () => {
    mockRevparse.mockRejectedValue(new Error("unknown revision"));
    await expect(getCommitDiff("deadbeef")).rejects.toThrow("not found in this repository");
  });

  it("accepts symbolic refs like HEAD", async () => {
    const resolvedSha = "abc123deadbeef0000000000000000000000000000";
    const fakeDiff = "diff --git a/foo.ts b/foo.ts\n+added line\n";
    mockRevparse.mockResolvedValue(resolvedSha);
    mockRaw.mockResolvedValue(fakeDiff);

    const result = await getCommitDiff("HEAD");
    expect(result).toBe(fakeDiff);
    expect(mockRevparse).toHaveBeenCalledWith(["HEAD"]);
    expect(mockRaw).toHaveBeenCalledWith([
      "diff-tree",
      "--root",
      "--no-commit-id",
      "-p",
      "-r",
      resolvedSha,
    ]);
  });

  it("throws when the commit has no file changes", async () => {
    mockRevparse.mockResolvedValue("deadbeef");
    mockRaw.mockResolvedValue("   ");
    await expect(getCommitDiff("deadbeef")).rejects.toThrow("No file changes found");
  });

  it("returns the diff string on success", async () => {
    const fakeDiff = "diff --git a/foo.ts b/foo.ts\n+added line\n";
    mockRevparse.mockResolvedValue("deadbeef");
    mockRaw.mockResolvedValue(fakeDiff);

    const result = await getCommitDiff("deadbeef");
    expect(result).toBe(fakeDiff);
  });

  it("passes the resolved SHA (not the original ref) to git raw", async () => {
    const fakeDiff = "diff --git a/bar.ts b/bar.ts\n-removed\n";
    const resolvedSha = "abc123ef00000000000000000000000000000000";
    mockRevparse.mockResolvedValue(resolvedSha);
    mockRaw.mockResolvedValue(fakeDiff);

    await getCommitDiff("abc123ef");
    expect(mockRaw).toHaveBeenCalledWith([
      "diff-tree",
      "--root",
      "--no-commit-id",
      "-p",
      "-r",
      resolvedSha,
    ]);
  });

  it("trims whitespace from the ref before passing to revparse", async () => {
    const fakeDiff = "diff --git a/x.ts b/x.ts\n";
    mockRevparse.mockResolvedValue("abc123ef");
    mockRaw.mockResolvedValue(fakeDiff);

    await getCommitDiff("  abc123ef  ");
    expect(mockRevparse).toHaveBeenCalledWith(["abc123ef"]);
  });
});
