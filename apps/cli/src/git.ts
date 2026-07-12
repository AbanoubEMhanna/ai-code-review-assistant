import { simpleGit } from "simple-git";

export async function getStagedDiff(): Promise<string> {
  const diff = await simpleGit().diff(["--cached"]);
  if (!diff.trim()) {
    throw new Error("No staged changes found. Stage some files with `git add` first.");
  }
  return diff;
}

export async function getUnstagedDiff(): Promise<string> {
  const diff = await simpleGit().diff([]);
  if (!diff.trim()) {
    throw new Error(
      "No unstaged changes found. Edit some tracked files, or use `staged` to review changes already added with `git add`."
    );
  }
  return diff;
}

export async function getBranchDiff(base: string): Promise<string> {
  const git = simpleGit();
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
  const git = simpleGit();
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
