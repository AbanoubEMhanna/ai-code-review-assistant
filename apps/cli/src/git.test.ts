import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getBranchDiff, getFileDiff, getStagedDiff, getUnstagedDiff } from "./git.js";

let dir: string;
let originalCwd: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  dir = mkdtempSync(join(tmpdir(), "ai-review-git-test-"));
  const setup = simpleGit(dir);
  await setup.init();
  await setup.addConfig("user.email", "test@example.com");
  await setup.addConfig("user.name", "Test");
  writeFileSync(join(dir, "file.txt"), "line one\n");
  await setup.add(".");
  await setup.commit("initial commit");
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(dir, { recursive: true, force: true });
});

describe("getStagedDiff", () => {
  it("throws when there are no staged changes", async () => {
    await expect(getStagedDiff()).rejects.toThrow(/No staged changes/);
  });

  it("returns the diff for staged changes", async () => {
    writeFileSync(join(dir, "file.txt"), "line one\nline two\n");
    await simpleGit(dir).add(".");
    const diff = await getStagedDiff();
    expect(diff).toContain("line two");
  });
});

describe("getUnstagedDiff", () => {
  it("throws when there are no unstaged changes", async () => {
    await expect(getUnstagedDiff()).rejects.toThrow(/No unstaged changes/);
  });

  it("throws when the only changes are staged", async () => {
    writeFileSync(join(dir, "file.txt"), "line one\nline two\n");
    await simpleGit(dir).add(".");
    await expect(getUnstagedDiff()).rejects.toThrow(/No unstaged changes/);
  });

  it("returns the diff for unstaged changes to a tracked file", async () => {
    writeFileSync(join(dir, "file.txt"), "line one\nline two\n");
    const diff = await getUnstagedDiff();
    expect(diff).toContain("line two");
  });

  it("does not include staged changes once further unstaged edits are made", async () => {
    writeFileSync(join(dir, "file.txt"), "line one\nline two\n");
    await simpleGit(dir).add(".");
    writeFileSync(join(dir, "file.txt"), "line one\nline two\nline three\n");
    const diff = await getUnstagedDiff();
    expect(diff).toContain("line three");
    expect(diff).not.toContain("-line one");
  });
});

describe("getBranchDiff", () => {
  it("throws for an unknown base ref", async () => {
    await expect(getBranchDiff("no-such-branch")).rejects.toThrow(/not found/);
  });

  it("throws when there are no differences from the base", async () => {
    await expect(getBranchDiff("HEAD")).rejects.toThrow(/No differences found/);
  });

  it("returns the diff between the base ref and HEAD", async () => {
    const git = simpleGit(dir);
    await git.branch(["base-branch"]);
    writeFileSync(join(dir, "file.txt"), "line one\nline two\n");
    await git.add(".");
    await git.commit("second commit");
    const diff = await getBranchDiff("base-branch");
    expect(diff).toContain("line two");
  });
});

describe("getFileDiff", () => {
  it("throws when the file has no changes", async () => {
    await expect(getFileDiff("file.txt")).rejects.toThrow(/No diff found/);
  });

  it("returns the unstaged diff for a modified file", async () => {
    writeFileSync(join(dir, "file.txt"), "line one\nline two\n");
    const diff = await getFileDiff("file.txt");
    expect(diff).toContain("line two");
  });

  it("falls back to the staged diff when there is no unstaged change", async () => {
    writeFileSync(join(dir, "file.txt"), "line one\nline two\n");
    await simpleGit(dir).add(".");
    const diff = await getFileDiff("file.txt");
    expect(diff).toContain("line two");
  });
});
