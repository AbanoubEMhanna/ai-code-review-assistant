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
  it("throws on a clearly non-hex hash", async () => {
    await expect(getCommitDiff("not-a-hash!")).rejects.toThrow("does not look like");
  });

  it("throws on a hash that is too short (< 4 chars)", async () => {
    await expect(getCommitDiff("abc")).rejects.toThrow("does not look like");
  });

  it("throws when revparse cannot resolve the hash", async () => {
    mockRevparse.mockRejectedValue(new Error("unknown revision"));
    await expect(getCommitDiff("deadbeef")).rejects.toThrow("not found in this repository");
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

  it("passes the correct arguments to git raw", async () => {
    const fakeDiff = "diff --git a/bar.ts b/bar.ts\n-removed\n";
    mockRevparse.mockResolvedValue("abc123ef");
    mockRaw.mockResolvedValue(fakeDiff);

    await getCommitDiff("abc123ef");
    expect(mockRaw).toHaveBeenCalledWith([
      "diff-tree",
      "--root",
      "--no-commit-id",
      "-p",
      "-r",
      "abc123ef",
    ]);
  });

  it("trims whitespace from the hash before using it", async () => {
    const fakeDiff = "diff --git a/x.ts b/x.ts\n";
    mockRevparse.mockResolvedValue("abc123ef");
    mockRaw.mockResolvedValue(fakeDiff);

    await getCommitDiff("  abc123ef  ");
    expect(mockRevparse).toHaveBeenCalledWith(["abc123ef"]);
  });
});
