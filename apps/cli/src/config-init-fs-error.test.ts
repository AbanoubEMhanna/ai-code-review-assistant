import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ai-review/ai", () => ({
  reviewDiff: vi.fn(),
  pingProvider: vi.fn(),
}));

const { writeFileSyncMock } = vi.hoisted(() => ({ writeFileSyncMock: vi.fn() }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, writeFileSync: writeFileSyncMock };
});

describe("config init — fs write failure", () => {
  const originalArgv = process.argv;
  const originalCwd = process.cwd();
  let workDir: string;

  beforeEach(() => {
    vi.resetModules();
    workDir = mkdtempSync(join(tmpdir(), "ai-review-config-init-"));
    process.chdir(workDir);
    writeFileSyncMock.mockReset();
    writeFileSyncMock.mockImplementation(() => {
      throw new Error("EACCES: permission denied, open '.ai-reviewrc.json'");
    });
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__EXIT_${code}__`);
    }) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(workDir, { recursive: true, force: true });
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it("reports the error via die() and exits 1 instead of crashing with a raw stack trace", async () => {
    process.argv = ["node", "index.js", "config", "init"];
    await expect(import("./index.js")).rejects.toThrow("__EXIT_1__");
    expect(console.error).toHaveBeenCalledWith("Error:", expect.stringContaining("EACCES"));
  });
});
