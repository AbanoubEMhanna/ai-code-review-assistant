export interface DiffStats {
  fileCount: number;
  linesAdded: number;
  linesRemoved: number;
  charCount: number;
  estimatedTokens: number;
  files: string[];
}

export const LARGE_DIFF_TOKEN_THRESHOLD = 25_000;

export function getDiffStats(diff: string): DiffStats {
  const files: string[] = [];
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const quoted = line.match(/^diff --git "a\/(.+)" "b\/(.+)"$/);
      const unquoted = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      const file = quoted?.[2] ?? unquoted?.[2];
      if (file) files.push(file);
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      linesAdded++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      linesRemoved++;
    }
  }

  const charCount = diff.length;
  return {
    fileCount: files.length,
    linesAdded,
    linesRemoved,
    charCount,
    estimatedTokens: Math.ceil(charCount / 4),
    files,
  };
}

export function isLargeDiff(stats: DiffStats): boolean {
  return stats.estimatedTokens > LARGE_DIFF_TOKEN_THRESHOLD;
}
