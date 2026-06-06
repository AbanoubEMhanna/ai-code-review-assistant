import { simpleGit } from "simple-git";

const git = simpleGit();

export async function getCommitDiff(hash: string): Promise<string> {
  const trimmed = hash.trim();
  if (!trimmed) {
    throw new Error("Commit reference cannot be empty.");
  }
  let resolved: string;
  try {
    resolved = (await git.revparse([trimmed])).trim();
  } catch {
    throw new Error(`Commit "${trimmed}" not found in this repository.`);
  }
  // --root handles the initial commit (no parent) transparently
  const diff = await git.raw(["diff-tree", "--root", "--no-commit-id", "-p", "-r", resolved]);
  if (!diff.trim()) {
    throw new Error(`No file changes found in commit "${trimmed}". It may be an empty commit.`);
  }
  return diff;
}

export async function getStagedDiff(): Promise<string> {
  const diff = await git.diff(["--cached"]);
  if (!diff.trim()) {
    throw new Error("No staged changes found. Stage some files with `git add` first.");
  }
  return diff;
}

export async function getBranchDiff(base: string): Promise<string> {
  // Verify the base branch/commit exists
  try {
    await git.revparse([base]);
  } catch {
    throw new Error(`Branch or ref "${base}" not found.`);
  }
  const diff = await git.diff([`${base}...HEAD`]);
  if (!diff.trim()) {
    throw new Error(`No differences found between "${base}" and HEAD.`);
  }
  return diff;
}

export async function getFileDiff(filePath: string): Promise<string> {
  const diff = await git.diff(["HEAD", "--", filePath]);
  if (!diff.trim()) {
    // Try staged diff for the file
    const staged = await git.diff(["--cached", "--", filePath]);
    if (!staged.trim()) {
      throw new Error(`No diff found for "${filePath}". Make sure the file has changes.`);
    }
    return staged;
  }
  return diff;
}
