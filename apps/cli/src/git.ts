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
    if (staged.trim()) {
      return staged;
    }
    // Neither HEAD nor the index has this path tracked yet — it may be a
    // brand-new, untracked file. `git diff` silently ignores untracked
    // paths, so fall back to a `--no-index` diff against /dev/null to show
    // the whole file as an addition.
    const status = await git.raw(["status", "--porcelain", "--", filePath]);
    if (status.startsWith("??")) {
      return git.diff(["--no-index", "--", "/dev/null", filePath]);
    }
    throw new Error(`No diff found for "${filePath}". Make sure the file has changes.`);
  }
  return diff;
}
