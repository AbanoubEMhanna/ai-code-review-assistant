const DEFAULT_IGNORE_PATTERNS = [
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "*.min.js",
  "*.min.css",
  "*.map",
  "dist/**",
  "build/**",
];

export function getDefaultIgnorePatterns(): string[] {
  return [...DEFAULT_IGNORE_PATTERNS];
}

function globToRegExp(pattern: string): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        re += ".*";
        i++;
        if (pattern[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c ?? "")) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * Matches a file path against a single ignore pattern using simplified
 * .gitignore-style semantics: patterns without a "/" match the basename
 * at any depth; patterns with a "/" match against the full path.
 */
export function matchesIgnorePattern(filePath: string, pattern: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  const hasLeadingSlash = p.startsWith("/");
  const normalized = hasLeadingSlash ? p.slice(1) : p;
  if (hasLeadingSlash || normalized.includes("/")) {
    return globToRegExp(normalized).test(filePath);
  }
  const basename = filePath.split("/").pop() ?? filePath;
  return globToRegExp(normalized).test(basename);
}

function extractFilePath(fileBlock: string): string | null {
  const headerMatch = fileBlock.match(/^diff --git a\/(.+) b\/(.+)$/m);
  if (!headerMatch) return null;
  const [, aPath, bPath] = headerMatch;
  return bPath && bPath !== "/dev/null" ? bPath : (aPath ?? null);
}

export interface FilterDiffResult {
  filtered: string;
  ignoredFiles: string[];
}

/**
 * Splits a unified git diff into per-file blocks and drops any block whose
 * path matches one of the given ignore patterns, so noisy/generated files
 * (lockfiles, minified bundles, build output) never reach the AI provider.
 */
export function filterDiff(diff: string, patterns: string[]): FilterDiffResult {
  if (patterns.length === 0 || !diff.trim()) {
    return { filtered: diff, ignoredFiles: [] };
  }

  const blocks = diff.split(/(?=^diff --git )/m).filter((b) => b.length > 0);
  const kept: string[] = [];
  const ignoredFiles: string[] = [];

  for (const block of blocks) {
    const filePath = extractFilePath(block);
    if (filePath && patterns.some((p) => matchesIgnorePattern(filePath, p))) {
      ignoredFiles.push(filePath);
      continue;
    }
    kept.push(block);
  }

  return { filtered: kept.join(""), ignoredFiles };
}
