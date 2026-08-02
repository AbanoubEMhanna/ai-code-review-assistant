import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCommitDiff } from "./git.js";

let dir: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "ai-review-git-test-"));
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig("user.email", "test@example.com");
  await git.addConfig("user.name", "Test User");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("getCommitDiff()", () => {
  it("returns the diff for a normal commit with a parent", async () => {
    const git = simpleGit(dir);
    writeFileSync(join(dir, "a.txt"), "one\n");
    await git.add(".");
    await git.commit("first");

    writeFileSync(join(dir, "a.txt"), "one\ntwo\n");
    await git.add(".");
    const second = await git.commit("second");

    const diff = await getCommitDiff(second.commit, dir);
    expect(diff).toContain("+two");
  });

  it("returns the full diff for a root commit with no parent", async () => {
    const git = simpleGit(dir);
    writeFileSync(join(dir, "a.txt"), "hello\n");
    await git.add(".");
    const root = await git.commit("root");

    const diff = await getCommitDiff(root.commit, dir);
    expect(diff).toContain("+hello");
  });

  it("resolves short SHAs and branch/tag refs", async () => {
    const git = simpleGit(dir);
    writeFileSync(join(dir, "a.txt"), "hello\n");
    await git.add(".");
    await git.commit("root");
    await git.addTag("v1");

    const diff = await getCommitDiff("v1", dir);
    expect(diff).toContain("+hello");
  });

  it("throws for a ref that does not exist", async () => {
    await expect(getCommitDiff("not-a-real-ref", dir)).rejects.toThrow(/not found/);
  });

  it("throws when the commit introduces no changes", async () => {
    const git = simpleGit(dir);
    writeFileSync(join(dir, "a.txt"), "hello\n");
    await git.add(".");
    await git.commit("root");
    const empty = await git.commit("empty", undefined, { "--allow-empty": null });

    await expect(getCommitDiff(empty.commit, dir)).rejects.toThrow(/No changes found/);
  });
});
