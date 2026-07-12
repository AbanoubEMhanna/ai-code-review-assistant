import { simpleGit } from "simple-git";

const git = simpleGit();

function excludeArgs(patterns: string[]): string[] {
  return patterns.map((p) => `:(exclude)${p}`);
}

export async function getStagedDiff(exclude: string[] = []): Promise<string> {
  const args = exclude.length ? ["--cached", "--", ...excludeArgs(exclude)] : ["--cached"];
  const diff = await git.diff(args);
  if (!diff.trim()) {
    throw new Error("No staged changes found. Stage some files with `git add` first.");
  }
  return diff;
}

export async function getBranchDiff(base: string, exclude: string[] = []): Promise<string> {
  try {
    await git.revparse([base]);
  } catch {
    throw new Error(`Branch or ref "${base}" not found.`);
  }
  const args = exclude.length
    ? [`${base}...HEAD`, "--", ...excludeArgs(exclude)]
    : [`${base}...HEAD`];
  const diff = await git.diff(args);
  if (!diff.trim()) {
    throw new Error(`No differences found between "${base}" and HEAD.`);
  }
  return diff;
}

export async function getFileDiff(filePath: string, exclude: string[] = []): Promise<string> {
  const baseArgs = exclude.length
    ? ["HEAD", "--", filePath, ...excludeArgs(exclude)]
    : ["HEAD", "--", filePath];
  const diff = await git.diff(baseArgs);
  if (!diff.trim()) {
    const stagedArgs = exclude.length
      ? ["--cached", "--", filePath, ...excludeArgs(exclude)]
      : ["--cached", "--", filePath];
    const staged = await git.diff(stagedArgs);
    if (!staged.trim()) {
      throw new Error(`No diff found for "${filePath}". Make sure the file has changes.`);
    }
    return staged;
  }
  return diff;
}
