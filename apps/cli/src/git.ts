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

export async function getRefDiff(ref1: string, ref2: string): Promise<string> {
  const t1 = ref1.trim();
  const t2 = ref2.trim();
  if (!t1) throw new Error("First ref cannot be empty.");
  if (!t2) throw new Error("Second ref cannot be empty.");
  for (const [label, ref] of [
    ["ref1", t1],
    ["ref2", t2],
  ] as const) {
    try {
      await git.revparse([ref]);
    } catch {
      throw new Error(`${label} "${ref}" not found in this repository.`);
    }
  }
  const diff = await git.diff([`${t1}..${t2}`]);
  if (!diff.trim()) {
    throw new Error(`No differences found between "${t1}" and "${t2}".`);
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
