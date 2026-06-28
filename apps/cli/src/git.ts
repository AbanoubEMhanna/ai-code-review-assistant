import { simpleGit } from "simple-git";

const git = simpleGit();

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

export async function getCommitDiff(hash: string): Promise<string> {
  // Validate the hash resolves to a real commit
  let resolvedHash: string;
  try {
    resolvedHash = (await git.revparse([hash])).trim();
  } catch {
    throw new Error(`Commit "${hash}" not found. Provide a valid commit SHA or ref.`);
  }
  // show <hash>^..<hash> gives the diff introduced by that single commit
  const diff = await git.diff([`${resolvedHash}^`, resolvedHash]);
  if (!diff.trim()) {
    throw new Error(`Commit "${hash}" introduced no file changes (merge commit or empty commit).`);
  }
  return diff;
}
