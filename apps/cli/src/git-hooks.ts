import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { simpleGit } from "simple-git";

export const HOOK_MARKER = "# managed-by: ai-review (installed via `ai-review install-hook`)";

export function buildHookScript(failOn: string): string {
  return `#!/bin/sh
${HOOK_MARKER}
# Skip once with: AI_REVIEW_SKIP_HOOK=1 git commit ...
if [ -n "$AI_REVIEW_SKIP_HOOK" ]; then
  exit 0
fi

ai-review staged --fail-on ${failOn} --no-save
status=$?
if [ $status -ne 0 ]; then
  echo ""
  echo "ai-review found blocking issues (severity >= ${failOn})."
  echo "Fix them, or bypass this check with: AI_REVIEW_SKIP_HOOK=1 git commit ..."
  exit $status
fi
`;
}

export async function resolveHooksDir(): Promise<string> {
  const git = simpleGit();
  const dir = (await git.raw(["rev-parse", "--git-path", "hooks"])).trim();
  return dir;
}

export interface InstallResult {
  hookPath: string;
  backedUpTo?: string;
}

export function installPreCommitHook(
  hooksDir: string,
  failOn: string,
  force: boolean
): InstallResult {
  mkdirSync(hooksDir, { recursive: true });
  const hookPath = join(hooksDir, "pre-commit");
  const script = buildHookScript(failOn);
  let backedUpTo: string | undefined;

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, "utf8");
    if (!existing.includes(HOOK_MARKER) && !force) {
      throw new Error(
        `An existing pre-commit hook was found at ${hookPath} that wasn't installed by ai-review. ` +
          `Re-run with --force to back it up and replace it.`
      );
    }
    if (!existing.includes(HOOK_MARKER)) {
      backedUpTo = `${hookPath}.backup`;
      renameSync(hookPath, backedUpTo);
    }
  }

  writeFileSync(hookPath, script, "utf8");
  chmodSync(hookPath, 0o755);

  return backedUpTo ? { hookPath, backedUpTo } : { hookPath };
}

export interface UninstallResult {
  removed: boolean;
  restoredFrom?: string;
  reason?: string;
}

export function uninstallPreCommitHook(hooksDir: string): UninstallResult {
  const hookPath = join(hooksDir, "pre-commit");
  const backupPath = `${hookPath}.backup`;

  if (!existsSync(hookPath)) {
    return { removed: false, reason: "No pre-commit hook is installed." };
  }

  const existing = readFileSync(hookPath, "utf8");
  if (!existing.includes(HOOK_MARKER)) {
    return {
      removed: false,
      reason: "The existing pre-commit hook wasn't installed by ai-review; leaving it in place.",
    };
  }

  rmSync(hookPath);

  if (existsSync(backupPath)) {
    renameSync(backupPath, hookPath);
    chmodSync(hookPath, 0o755);
    return { removed: true, restoredFrom: backupPath };
  }

  return { removed: true };
}
