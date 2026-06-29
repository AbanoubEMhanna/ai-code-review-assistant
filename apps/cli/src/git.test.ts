import { describe, it, expect, vi, afterEach } from "vitest";
import { getCommitDiff } from "./git.js";

vi.mock("simple-git", () => {
  const mockGit = {
    revparse: vi.fn(),
    show: vi.fn(),
    diff: vi.fn(),
  };
  return { simpleGit: () => mockGit };
});

afterEach(() => {
  vi.clearAllMocks();
});

const HASH = "abc1234abc1234abc1234abc1234abc1234abc1234";
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const PARENT = "parent0parent0parent0parent0parent0parent0";
const DIFF_OUTPUT = "diff --git a/foo.ts b/foo.ts\n+added line\n";

async function getMockGit() {
  const { simpleGit } = await import("simple-git");
  return simpleGit() as ReturnType<typeof simpleGit> & {
    revparse: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    diff: ReturnType<typeof vi.fn>;
  };
}

describe("getCommitDiff()", () => {
  it("returns the diff for a valid single-parent commit", async () => {
    const mockGit = await getMockGit();
    mockGit.revparse.mockResolvedValue(`${HASH}\n`);
    mockGit.show.mockResolvedValue(`${PARENT}\n`);
    mockGit.diff.mockResolvedValue(DIFF_OUTPUT);

    const result = await getCommitDiff("abc1234");

    expect(mockGit.revparse).toHaveBeenCalledWith(["abc1234"]);
    expect(mockGit.show).toHaveBeenCalledWith(["--format=%P", "--no-patch", HASH]);
    expect(mockGit.diff).toHaveBeenCalledWith([`${HASH}^`, HASH]);
    expect(result).toContain("+added line");
  });

  it("diffs against the empty tree for a root commit (no parents)", async () => {
    const mockGit = await getMockGit();
    mockGit.revparse.mockResolvedValue(`${HASH}\n`);
    mockGit.show.mockResolvedValue(""); // no parents
    mockGit.diff.mockResolvedValue(DIFF_OUTPUT);

    const result = await getCommitDiff("abc1234");

    expect(mockGit.diff).toHaveBeenCalledWith([EMPTY_TREE, HASH]);
    expect(result).toContain("+added line");
  });

  it("throws a friendly error for merge commits (two parents)", async () => {
    const mockGit = await getMockGit();
    mockGit.revparse.mockResolvedValue(`${HASH}\n`);
    mockGit.show.mockResolvedValue(`${PARENT} anotherparentanotherparentanotherparentaaa\n`);

    await expect(getCommitDiff("abc1234")).rejects.toThrow(
      'Commit "abc1234" is a merge commit. Only single-parent commits are supported.'
    );
    expect(mockGit.diff).not.toHaveBeenCalled();
  });

  it("throws a friendly error when the hash does not exist", async () => {
    const mockGit = await getMockGit();
    mockGit.revparse.mockRejectedValue(new Error("unknown revision"));

    await expect(getCommitDiff("deadbeef")).rejects.toThrow(
      'Commit "deadbeef" not found. Provide a valid commit SHA or ref.'
    );
  });

  it("throws when the commit introduced no file changes", async () => {
    const mockGit = await getMockGit();
    mockGit.revparse.mockResolvedValue(`${HASH}\n`);
    mockGit.show.mockResolvedValue(`${PARENT}\n`);
    mockGit.diff.mockResolvedValue("   ");

    await expect(getCommitDiff("abc1234")).rejects.toThrow(
      'Commit "abc1234" introduced no file changes.'
    );
  });
});
