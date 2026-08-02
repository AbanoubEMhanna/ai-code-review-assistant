import { simpleGit } from "simple-git";

const git = simpleGit();

// Git's well-known hash for an empty tree — diffing against it yields the
// full contents of a commit that has no parent (e.g. a repo's root commit).
const EMPTY_TREE_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

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

export async function getCommitDiff(sha: string, cwd?: string): Promise<string> {
  const scopedGit = cwd ? simpleGit(cwd) : git;

  let resolvedSha: string;
  try {
    resolvedSha = (await scopedGit.revparse([sha])).trim();
  } catch {
    throw new Error(`Commit "${sha}" not found.`);
  }

  let diff: string;
  try {
    diff = await scopedGit.diff([`${resolvedSha}~1`, resolvedSha]);
  } catch {
    // No parent commit (root commit) — diff against the empty tree instead.
    diff = await scopedGit.diff([EMPTY_TREE_SHA, resolvedSha]);
  }

  if (!diff.trim()) {
    throw new Error(`No changes found in commit "${sha}".`);
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
