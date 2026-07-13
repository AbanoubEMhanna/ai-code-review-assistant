import { getFileDiff } from "./git.js";

export interface MultiFileDiffResult {
  diff: string;
  skipped: string[];
}

export async function getFilesDiff(filePaths: string[]): Promise<MultiFileDiffResult> {
  const results = await Promise.all(
    filePaths.map(async (path) => {
      try {
        return { path, diff: await getFileDiff(path) };
      } catch {
        return { path, diff: null as string | null };
      }
    })
  );

  const skipped = results.filter((r) => r.diff === null).map((r) => r.path);
  const diffs = results.filter((r): r is { path: string; diff: string } => r.diff !== null);

  if (diffs.length === 0) {
    throw new Error(
      `No diff found for any of: ${filePaths.join(", ")}. Make sure the files have changes.`
    );
  }

  return { diff: diffs.map((d) => d.diff).join("\n"), skipped };
}
