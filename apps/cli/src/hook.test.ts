import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installHook, showHookStatus, uninstallHook } from "./hook.js";

let tmpDir: string;
let gitDir: string;
let hooksDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "ai-review-hook-test-"));
  gitDir = join(tmpDir, ".git");
  hooksDir = join(gitDir, "hooks");
  mkdirSync(hooksDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("installHook()", () => {
  it("creates pre-commit hook with ai-review staged", () => {
    installHook("pre-commit", { gitDir });
    const content = readFileSync(join(hooksDir, "pre-commit"), "utf8");
    expect(content).toContain("#!/bin/sh");
    expect(content).toContain("ai-review staged");
    expect(content).toContain("managed by: ai-review hook install");
  });

  it("creates pre-push hook with ai-review branch main by default", () => {
    installHook("pre-push", { gitDir });
    const content = readFileSync(join(hooksDir, "pre-push"), "utf8");
    expect(content).toContain("ai-review branch main");
    expect(content).toContain("managed by: ai-review hook install");
  });

  it("respects custom --base for pre-push", () => {
    installHook("pre-push", { gitDir, base: "develop" });
    const content = readFileSync(join(hooksDir, "pre-push"), "utf8");
    expect(content).toContain("ai-review branch develop");
  });

  it("appends --fail-on flag when specified", () => {
    installHook("pre-commit", { gitDir, failOn: "high" });
    const content = readFileSync(join(hooksDir, "pre-commit"), "utf8");
    expect(content).toContain("ai-review staged --fail-on 'high'");
  });

  it("throws when .git directory not found", () => {
    expect(() => installHook("pre-commit", { gitDir: join(tmpDir, "nonexistent") })).toThrow(
      "Not a git repository root"
    );
  });

  it("throws when hook exists and was not created by ai-review (without --force)", () => {
    writeFileSync(join(hooksDir, "pre-commit"), "#!/bin/sh\necho custom\n", "utf8");
    expect(() => installHook("pre-commit", { gitDir })).toThrow(
      "already exists and was not created"
    );
  });

  it("overwrites existing third-party hook when --force is set", () => {
    writeFileSync(join(hooksDir, "pre-commit"), "#!/bin/sh\necho custom\n", "utf8");
    installHook("pre-commit", { gitDir, force: true });
    const content = readFileSync(join(hooksDir, "pre-commit"), "utf8");
    expect(content).toContain("ai-review staged");
  });

  it("overwrites its own hook (idempotent reinstall)", () => {
    installHook("pre-commit", { gitDir });
    installHook("pre-commit", { gitDir, failOn: "medium" });
    const content = readFileSync(join(hooksDir, "pre-commit"), "utf8");
    expect(content).toContain("--fail-on 'medium'");
  });

  it("makes the hook file executable", () => {
    installHook("pre-commit", { gitDir });
    const path = join(hooksDir, "pre-commit");
    const stats = statSync(path);
    expect(stats.mode & 0o111).toBeGreaterThan(0);
  });
});

describe("uninstallHook()", () => {
  it("returns 'not-found' when hook file does not exist", () => {
    expect(uninstallHook("pre-commit", { gitDir })).toBe("not-found");
  });

  it("returns 'not-ours' when hook exists but was not managed by ai-review", () => {
    writeFileSync(join(hooksDir, "pre-commit"), "#!/bin/sh\necho custom\n", "utf8");
    expect(uninstallHook("pre-commit", { gitDir })).toBe("not-ours");
  });

  it("removes the hook and returns 'removed'", () => {
    installHook("pre-commit", { gitDir });
    const result = uninstallHook("pre-commit", { gitDir });
    expect(result).toBe("removed");
    expect(existsSync(join(hooksDir, "pre-commit"))).toBe(false);
  });

  it("handles pre-push hook removal independently", () => {
    installHook("pre-push", { gitDir });
    const result = uninstallHook("pre-push", { gitDir });
    expect(result).toBe("removed");
  });
});

describe("showHookStatus()", () => {
  it("returns not-installed for both hooks when none exist", () => {
    const status = showHookStatus(gitDir);
    expect(status).toHaveLength(2);
    expect(status.every((s) => !s.installed)).toBe(true);
  });

  it("reports managed=true for ai-review-installed hooks", () => {
    installHook("pre-commit", { gitDir });
    const status = showHookStatus(gitDir);
    const preCommit = status.find((s) => s.hook === "pre-commit");
    expect(preCommit?.installed).toBe(true);
    expect(preCommit?.managed).toBe(true);
  });

  it("reports managed=false for third-party hooks", () => {
    writeFileSync(join(hooksDir, "pre-commit"), "#!/bin/sh\necho hi\n", "utf8");
    const status = showHookStatus(gitDir);
    const preCommit = status.find((s) => s.hook === "pre-commit");
    expect(preCommit?.installed).toBe(true);
    expect(preCommit?.managed).toBe(false);
  });
});
