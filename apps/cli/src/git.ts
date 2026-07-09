import { simpleGit } from "simple-git";

const git = simpleGit();

export interface DiffStats {
  files: number;
  insertions: number;
  deletions: number;
}

export function parseDiffStats(diff: string): DiffStats {
  let files = 0;
  let insertions = 0;
  let deletions = 0;
  let inFileSection = false;

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      files++;
      inFileSection = true;
    } else if (inFileSection && line.startsWith("+++")) {
      // skip — this is the file header line, not a real insertion
    } else if (inFileSection && line.startsWith("---")) {
      // skip — this is the file header line, not a real deletion
    } else if (line.startsWith("+")) {
      insertions++;
    } else if (line.startsWith("-")) {
      deletions++;
    }
  }

  return { files, insertions, deletions };
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
