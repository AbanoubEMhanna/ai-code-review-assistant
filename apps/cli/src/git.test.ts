import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import type { getFileDiff as GetFileDiff } from "./git.js";

// git.ts binds its git client to process.cwd() at import time, so each test
// chdirs into a fresh repo and re-imports the module to pick up the new cwd.
async function importGitModule(): Promise<{ getFileDiff: typeof GetFileDiff }> {
  vi.resetModules();
  return import("./git.js");
}

describe("getFileDiff()", () => {
  const originalCwd = process.cwd();
  let repoDir: string;

  beforeEach(async () => {
    repoDir = mkdtempSync(join(tmpdir(), "ai-review-git-test-"));
    process.chdir(repoDir);
    const git = simpleGit();
    await git.init();
    await git.addConfig("user.email", "test@example.com");
    await git.addConfig("user.name", "Test");
    writeFileSync(join(repoDir, "tracked.txt"), "line one\n");
    await git.add("tracked.txt");
    await git.commit("initial commit");
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(repoDir, { recursive: true, force: true });
  });

  it("returns the working-tree diff for a modified tracked file", async () => {
    writeFileSync(join(repoDir, "tracked.txt"), "line one\nline two\n");
    const { getFileDiff } = await importGitModule();
    const diff = await getFileDiff("tracked.txt");
    expect(diff).toContain("+line two");
  });

  it("returns the staged diff when a tracked file is staged but not committed", async () => {
    const git = simpleGit();
    writeFileSync(join(repoDir, "tracked.txt"), "line one\nline two\n");
    await git.add("tracked.txt");
    const { getFileDiff } = await importGitModule();
    const diff = await getFileDiff("tracked.txt");
    expect(diff).toContain("+line two");
  });

  it("returns an addition diff for a brand-new untracked file instead of throwing", async () => {
    writeFileSync(join(repoDir, "untracked.txt"), "hello world\n");
    const { getFileDiff } = await importGitModule();
    const diff = await getFileDiff("untracked.txt");
    expect(diff).toContain("new file mode");
    expect(diff).toContain("+hello world");
  });

  it("throws a clear error when the path has no changes at all", async () => {
    const { getFileDiff } = await importGitModule();
    await expect(getFileDiff("tracked.txt")).rejects.toThrow(/No diff found/);
  });
});

describe("getFileDiff() in a repository with no commits yet (unborn HEAD)", () => {
  const originalCwd = process.cwd();
  let repoDir: string;

  beforeEach(async () => {
    repoDir = mkdtempSync(join(tmpdir(), "ai-review-git-test-unborn-"));
    process.chdir(repoDir);
    const git = simpleGit();
    await git.init();
    await git.addConfig("user.email", "test@example.com");
    await git.addConfig("user.name", "Test");
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(repoDir, { recursive: true, force: true });
  });

  it("returns an addition diff for an untracked file instead of throwing on missing HEAD", async () => {
    writeFileSync(join(repoDir, "untracked.txt"), "hello world\n");
    const { getFileDiff } = await importGitModule();
    const diff = await getFileDiff("untracked.txt");
    expect(diff).toContain("new file mode");
    expect(diff).toContain("+hello world");
  });
});
