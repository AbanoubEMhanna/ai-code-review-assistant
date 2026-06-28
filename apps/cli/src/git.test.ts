import { describe, it, expect, vi, afterEach } from "vitest";
import { getCommitDiff } from "./git.js";

vi.mock("simple-git", () => {
  const mockGit = {
    revparse: vi.fn(),
    diff: vi.fn(),
  };
  return { simpleGit: () => mockGit };
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function getMockGit() {
  const { simpleGit } = await import("simple-git");
  return simpleGit() as ReturnType<typeof simpleGit> & {
    revparse: ReturnType<typeof vi.fn>;
    diff: ReturnType<typeof vi.fn>;
  };
}

describe("getCommitDiff()", () => {
  it("returns the diff for a valid commit hash", async () => {
    const mockGit = await getMockGit();
    mockGit.revparse.mockResolvedValue("abc1234abc1234abc1234abc1234abc1234abc1234\n");
    mockGit.diff.mockResolvedValue("diff --git a/foo.ts b/foo.ts\n+added line\n");

    const result = await getCommitDiff("abc1234");

    expect(mockGit.revparse).toHaveBeenCalledWith(["abc1234"]);
    expect(mockGit.diff).toHaveBeenCalledWith([
      "abc1234abc1234abc1234abc1234abc1234abc1234^",
      "abc1234abc1234abc1234abc1234abc1234abc1234",
    ]);
    expect(result).toContain("+added line");
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
    mockGit.revparse.mockResolvedValue("abc1234abc1234abc1234abc1234abc1234abc1234\n");
    mockGit.diff.mockResolvedValue("   ");

    await expect(getCommitDiff("abc1234")).rejects.toThrow(
      'Commit "abc1234" introduced no file changes'
    );
  });
});
