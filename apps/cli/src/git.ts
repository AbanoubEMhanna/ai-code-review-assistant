import { simpleGit } from "simple-git";

const git = simpleGit();

const DIFF_HEADER_RE = /^diff --git a\/(.+) b\/(.+)$/m;
const BINARY_MARKER_RE = /^(?:Binary files .* differ|GIT binary patch)$/m;

/**
 * Replaces each binary file's diff section (e.g. "Binary files a/x and b/x differ")
 * with a short summary line. Binary sections carry no reviewable content, so sending
 * them to the AI as-is only wastes tokens and invites hallucinated comments about
 * code the model never actually saw.
 */
export function summarizeBinaryChanges(diff: string): string {
  if (!diff) return diff;
  const sections = diff.split(/(?=^diff --git )/m);
  return sections
    .map((section) => {
      const header = DIFF_HEADER_RE.exec(section);
      const filePath = header?.[2];
      if (!header || filePath === undefined || !BINARY_MARKER_RE.test(section)) {
        return section;
      }
      const headerLine = header[0] ?? "";
      const trailingNewline = section.endsWith("\n") ? "\n" : "";
      return `${headerLine}\nBinary file changed: ${filePath} (contents omitted — binary files are not reviewed)${trailingNewline}`;
    })
    .join("");
}

export async function getStagedDiff(): Promise<string> {
  const diff = await git.diff(["--cached"]);
  if (!diff.trim()) {
    throw new Error("No staged changes found. Stage some files with `git add` first.");
  }
  return summarizeBinaryChanges(diff);
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
  return summarizeBinaryChanges(diff);
}

export async function getFileDiff(filePath: string): Promise<string> {
  const diff = await git.diff(["HEAD", "--", filePath]);
  if (!diff.trim()) {
    // Try staged diff for the file
    const staged = await git.diff(["--cached", "--", filePath]);
    if (!staged.trim()) {
      throw new Error(`No diff found for "${filePath}". Make sure the file has changes.`);
    }
    return summarizeBinaryChanges(staged);
  }
  return summarizeBinaryChanges(diff);
}
