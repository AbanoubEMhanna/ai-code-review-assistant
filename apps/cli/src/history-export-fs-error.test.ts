import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewReport } from "@ai-review/shared";

vi.mock("@ai-review/ai", () => ({
  reviewDiff: vi.fn(),
  pingProvider: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, writeFileSync: vi.fn(actual.writeFileSync) };
});

function makeReport(overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    generatedAt: new Date().toISOString(),
    model: "test-model",
    diffSource: "staged changes",
    summary: "No issues found.",
    comments: [],
    stats: { high: 0, medium: 0, low: 0, info: 0, total: 0 },
    ...overrides,
  };
}

describe("history export — fs write failure", () => {
  const originalArgv = process.argv;
  const originalHome = process.env["HOME"];
  let fakeHome: string;
  let reviewId: string;

  beforeEach(async () => {
    vi.resetModules();
    fakeHome = mkdtempSync(join(tmpdir(), "ai-review-history-export-"));
    process.env["HOME"] = fakeHome;

    // Pre-populate a review directly on disk (through the mocked-but-passthrough
    // writeFileSync) so `history export` has something valid to read.
    const { ReviewHistoryStore } = await import("./history-store.js");
    const historyDir = join(homedir(), ".ai-review", "history");
    const store = new ReviewHistoryStore(historyDir);
    reviewId = store.save(makeReport()).id;

    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__EXIT_${code}__`);
    }) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env["HOME"] = originalHome;
    rmSync(fakeHome, { recursive: true, force: true });
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it("reports the error via die() and exits 1 instead of crashing with a raw stack trace", async () => {
    const { writeFileSync } = await import("node:fs");
    vi.mocked(writeFileSync).mockImplementationOnce(() => {
      throw new Error("ENOSPC: no space left on device, write");
    });

    process.argv = [
      "node",
      "index.js",
      "history",
      "export",
      reviewId,
      "-o",
      join(fakeHome, "out.md"),
    ];
    await expect(import("./index.js")).rejects.toThrow("__EXIT_1__");
    expect(console.error).toHaveBeenCalledWith("Error:", expect.stringContaining("ENOSPC"));
  });
});
