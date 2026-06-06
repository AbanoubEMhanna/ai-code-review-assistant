import { simpleGit } from "simple-git";

const git = simpleGit();

export async function getStagedDiff(contextLines?: number): Promise<string> {
  const args = contextLines !== undefined ? ["--cached", `-U${contextLines}`] : ["--cached"];
  const diff = await git.diff(args);
  if (!diff.trim()) {
    throw new Error("No staged changes found. Stage some files with `git add` first.");
  }
  return diff;
}

export async function getBranchDiff(base: string, contextLines?: number): Promise<string> {
  try {
    await git.revparse([base]);
  } catch {
    throw new Error(`Branch or ref "${base}" not found.`);
  }
  const args =
    contextLines !== undefined ? [`-U${contextLines}`, `${base}...HEAD`] : [`${base}...HEAD`];
  const diff = await git.diff(args);
  if (!diff.trim()) {
    throw new Error(`No differences found between "${base}" and HEAD.`);
  }
  return diff;
}

export async function getFileDiff(filePath: string, contextLines?: number): Promise<string> {
  const baseArgs = contextLines !== undefined ? [`-U${contextLines}`] : [];
  const diff = await git.diff([...baseArgs, "HEAD", "--", filePath]);
  if (!diff.trim()) {
    const staged = await git.diff([...baseArgs, "--cached", "--", filePath]);
    if (!staged.trim()) {
      throw new Error(`No diff found for "${filePath}". Make sure the file has changes.`);
    }
    return staged;
  }
  return diff;
}
