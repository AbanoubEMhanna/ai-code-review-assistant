import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type HookType = "pre-commit" | "pre-push";

const MARKER = "# managed by: ai-review hook install";

function hookPath(gitDir: string, hookType: HookType): string {
  return join(gitDir, "hooks", hookType);
}

function buildScript(hookType: HookType, opts: { failOn?: string; base?: string }): string {
  const failFlag = opts.failOn ? ` --fail-on ${opts.failOn}` : "";

  if (hookType === "pre-commit") {
    return (
      `#!/bin/sh\n` +
      `${MARKER}\n` +
      `# To remove: ai-review hook uninstall\n` +
      `ai-review staged${failFlag}\n`
    );
  }

  const base = opts.base ?? "main";
  return (
    `#!/bin/sh\n` +
    `${MARKER}\n` +
    `# To remove: ai-review hook uninstall --hook pre-push\n` +
    `ai-review branch ${base}${failFlag}\n`
  );
}

export function installHook(
  hookType: HookType,
  opts: { failOn?: string; base?: string; force?: boolean; gitDir?: string }
): void {
  const gitDir = opts.gitDir ?? ".git";

  if (!existsSync(gitDir)) {
    throw new Error(
      "Not a git repository root — .git directory not found. Run this command from your project root."
    );
  }

  const path = hookPath(gitDir, hookType);

  if (existsSync(path) && !opts.force) {
    const existing = readFileSync(path, "utf8");
    if (!existing.includes(MARKER)) {
      throw new Error(
        `${path} already exists and was not created by ai-review.\n` +
          `Use --force to overwrite it.`
      );
    }
  }

  writeFileSync(path, buildScript(hookType, opts), "utf8");
  chmodSync(path, 0o755);
}

export type UninstallResult = "removed" | "not-found" | "not-ours";

export function uninstallHook(hookType: HookType, opts: { gitDir?: string } = {}): UninstallResult {
  const gitDir = opts.gitDir ?? ".git";
  const path = hookPath(gitDir, hookType);

  if (!existsSync(path)) return "not-found";

  const content = readFileSync(path, "utf8");
  if (!content.includes(MARKER)) return "not-ours";

  rmSync(path);
  return "removed";
}

export function showHookStatus(
  gitDir: string
): Array<{ hook: HookType; installed: boolean; managed: boolean }> {
  const hooks: HookType[] = ["pre-commit", "pre-push"];
  return hooks.map((hook) => {
    const path = hookPath(gitDir, hook);
    if (!existsSync(path)) return { hook, installed: false, managed: false };
    const content = readFileSync(path, "utf8");
    return { hook, installed: true, managed: content.includes(MARKER) };
  });
}
