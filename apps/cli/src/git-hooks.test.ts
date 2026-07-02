import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  HOOK_MARKER,
  buildHookScript,
  installPreCommitHook,
  uninstallPreCommitHook,
} from "./git-hooks.js";

let hooksDir: string;

beforeEach(() => {
  hooksDir = mkdtempSync(join(tmpdir(), "ai-review-hooks-test-"));
});

afterEach(() => {
  rmSync(hooksDir, { recursive: true });
});

describe("buildHookScript()", () => {
  it("embeds the marker so installed hooks can be identified", () => {
    expect(buildHookScript("high")).toContain(HOOK_MARKER);
  });

  it("embeds the requested severity in the fail-on flag", () => {
    expect(buildHookScript("medium")).toContain("--fail-on medium");
  });

  it("supports skipping via an env var escape hatch", () => {
    expect(buildHookScript("high")).toContain("AI_REVIEW_SKIP_HOOK");
  });
});

describe("installPreCommitHook()", () => {
  it("writes an executable pre-commit script", () => {
    const result = installPreCommitHook(hooksDir, "high", false);
    const content = readFileSync(result.hookPath, "utf8");
    expect(content).toContain(HOOK_MARKER);
    expect(statSync(result.hookPath).mode & 0o111).not.toBe(0);
  });

  it("does not report a backup when no prior hook exists", () => {
    const result = installPreCommitHook(hooksDir, "high", false);
    expect(result.backedUpTo).toBeUndefined();
  });

  it("overwrites a hook it previously installed without requiring --force", () => {
    installPreCommitHook(hooksDir, "high", false);
    const result = installPreCommitHook(hooksDir, "medium", false);
    expect(readFileSync(result.hookPath, "utf8")).toContain("--fail-on medium");
    expect(result.backedUpTo).toBeUndefined();
  });

  it("refuses to clobber a foreign hook without --force", () => {
    writeFileSync(join(hooksDir, "pre-commit"), "#!/bin/sh\necho custom\n", "utf8");
    expect(() => installPreCommitHook(hooksDir, "high", false)).toThrow(/--force/);
  });

  it("backs up a foreign hook when --force is passed", () => {
    writeFileSync(join(hooksDir, "pre-commit"), "#!/bin/sh\necho custom\n", "utf8");
    const result = installPreCommitHook(hooksDir, "high", true);
    expect(result.backedUpTo).toBe(join(hooksDir, "pre-commit.backup"));
    expect(readFileSync(result.backedUpTo as string, "utf8")).toContain("echo custom");
    expect(readFileSync(result.hookPath, "utf8")).toContain(HOOK_MARKER);
  });
});

describe("uninstallPreCommitHook()", () => {
  it("reports nothing to remove when no hook is installed", () => {
    const result = uninstallPreCommitHook(hooksDir);
    expect(result.removed).toBe(false);
    expect(result.reason).toContain("No pre-commit hook");
  });

  it("removes a hook it manages", () => {
    installPreCommitHook(hooksDir, "high", false);
    const result = uninstallPreCommitHook(hooksDir);
    expect(result.removed).toBe(true);
  });

  it("refuses to remove a hook it did not install", () => {
    writeFileSync(join(hooksDir, "pre-commit"), "#!/bin/sh\necho custom\n", "utf8");
    const result = uninstallPreCommitHook(hooksDir);
    expect(result.removed).toBe(false);
    expect(result.reason).toContain("wasn't installed by ai-review");
  });

  it("restores a backed-up foreign hook after removal", () => {
    writeFileSync(join(hooksDir, "pre-commit"), "#!/bin/sh\necho custom\n", "utf8");
    installPreCommitHook(hooksDir, "high", true);
    const result = uninstallPreCommitHook(hooksDir);
    expect(result.removed).toBe(true);
    expect(result.restoredFrom).toBe(join(hooksDir, "pre-commit.backup"));
    expect(readFileSync(join(hooksDir, "pre-commit"), "utf8")).toContain("echo custom");
  });
});
