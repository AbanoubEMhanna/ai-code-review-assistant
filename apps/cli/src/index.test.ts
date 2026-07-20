import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * These are black-box smoke tests for the CLI's command dispatch (apps/cli/src/index.ts)
 * itself — the one file every command funnels through, and the only one with zero test
 * coverage. index.ts calls `program.parse()` as a side effect of being imported, using
 * `process.argv` and exiting the process on completion/error, so each case sets argv and
 * dynamically (re-)imports the module fresh rather than calling an exported function.
 *
 * `@ai-review/ai` is mocked rather than hit over a stubbed `fetch`: its package.json
 * resolves to a built `dist/`, which isn't guaranteed to exist when `pnpm test` runs on
 * its own (the CI `test` job doesn't depend on `build`), and mocking the workspace
 * package boundary keeps this suite from depending on build output either way.
 */

const { pingProviderMock } = vi.hoisted(() => ({ pingProviderMock: vi.fn() }));

vi.mock("@ai-review/ai", () => ({
  pingProvider: pingProviderMock,
  reviewDiff: vi.fn(),
}));

class ProcessExitError extends Error {
  constructor(public readonly code: number) {
    super(`process.exit(${code})`);
  }
}

let tmpHome: string;
let stdoutChunks: string[];
let stderrChunks: string[];
let capturedExitCode: number | undefined;
let unexpectedRejections: unknown[];

function stdout(): string {
  return stdoutChunks.join("");
}

function stderr(): string {
  return stderrChunks.join("");
}

function onUnhandledRejection(reason: unknown): void {
  if (reason instanceof ProcessExitError) {
    capturedExitCode = reason.code;
  } else {
    unexpectedRejections.push(reason);
  }
}

/**
 * Command actions in index.ts are async but dispatched via the sync `program.parse()`,
 * so a call to `process.exit()` inside one surfaces as a Node `unhandledRejection` on a
 * later tick rather than as a throw we can catch around `import()`. We give the mocked
 * fetch/fs calls a beat to settle, then read whichever exit code (if any) turned up.
 */
async function runCli(args: string[]): Promise<number> {
  process.argv = ["node", "ai-review", ...args];
  capturedExitCode = undefined;
  vi.resetModules();
  try {
    await import("./index.js");
  } catch (err) {
    if (!(err instanceof ProcessExitError)) throw err;
    capturedExitCode = err.code;
  }
  await new Promise((resolve) => setTimeout(resolve, 20));
  return capturedExitCode ?? 0;
}

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), "ai-review-cli-test-"));
  vi.stubEnv("HOME", tmpHome);
  vi.stubEnv("USERPROFILE", tmpHome);
  vi.stubEnv("AI_HOST", "");
  vi.stubEnv("AI_PROVIDER", "");
  vi.stubEnv("AI_MODEL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");

  stdoutChunks = [];
  stderrChunks = [];
  unexpectedRejections = [];
  process.on("unhandledRejection", onUnhandledRejection);

  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    stdoutChunks.push(args.join(" ") + "\n");
  });
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    stderrChunks.push(args.join(" ") + "\n");
  });
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    stdoutChunks.push(String(chunk));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderrChunks.push(String(chunk));
    return true;
  });
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new ProcessExitError(code ?? 0);
  }) as never);
});

afterEach(() => {
  process.off("unhandledRejection", onUnhandledRejection);
  expect(unexpectedRejections).toEqual([]);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  pingProviderMock.mockReset();
  vi.resetModules();
  rmSync(tmpHome, { recursive: true, force: true });
});

function okPing(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    provider: "ollama",
    host: "http://localhost:11434",
    model: "qwen3:latest",
    latencyMs: 5,
    modelFound: true,
    availableModels: ["qwen3:latest"],
    ...overrides,
  };
}

function unreachablePing(overrides: Record<string, unknown> = {}) {
  return {
    ok: false,
    provider: "ollama",
    host: "http://localhost:11434",
    model: "qwen3:latest",
    latencyMs: 0,
    modelFound: false,
    availableModels: [],
    error: "connect ECONNREFUSED",
    ...overrides,
  };
}

describe("ai-review --version", () => {
  it("prints the CLI version and exits 0", async () => {
    const code = await runCli(["--version"]);
    expect(code).toBe(0);
    expect(stdout().trim()).toBe("0.1.0");
  });
});

describe("ai-review ping", () => {
  it("rejects an unknown --provider before making any network call", async () => {
    const code = await runCli(["ping", "--provider", "nope"]);
    expect(code).toBe(1);
    expect(stderr()).toContain('Invalid provider "nope"');
    expect(pingProviderMock).not.toHaveBeenCalled();
  });

  it("reports success when the provider host is reachable and the model is found", async () => {
    pingProviderMock.mockResolvedValueOnce(okPing());
    const code = await runCli(["ping", "--provider", "ollama", "--model", "qwen3:latest"]);
    expect(code).toBe(0);
    expect(stdout()).toContain("Ready to review");
  });

  it("exits 1 when the provider host is unreachable", async () => {
    pingProviderMock.mockResolvedValueOnce(unreachablePing());
    const code = await runCli(["ping", "--provider", "ollama"]);
    expect(code).toBe(1);
    expect(stdout()).toContain("Connection failed");
  });
});

describe("ai-review doctor", () => {
  it("exits 0 and reports connectivity ok when the provider host is reachable", async () => {
    pingProviderMock.mockResolvedValueOnce(okPing());
    const code = await runCli(["doctor", "--provider", "ollama", "--model", "qwen3:latest"]);
    expect(code).toBe(0);
    expect(stdout()).toContain('model "qwen3:latest" found');
  });

  it("exits 1 when the provider host is unreachable", async () => {
    pingProviderMock.mockResolvedValueOnce(unreachablePing());
    const code = await runCli(["doctor", "--provider", "ollama"]);
    expect(code).toBe(1);
    expect(stdout()).toContain("Cannot reach");
  });
});

describe("ai-review history", () => {
  it("lists no reviews for a fresh history store", async () => {
    const code = await runCli(["history", "list", "--json"]);
    expect(code).toBe(0);
    expect(JSON.parse(stdout())).toEqual([]);
  });

  it("reports 'not found' and exits 1 for an unknown review id", async () => {
    const code = await runCli(["history", "show", "999-doesnotexist"]);
    expect(code).toBe(1);
    expect(stderr()).toContain('Review "999-doesnotexist" not found.');
  });

  it("clearing an empty history store removes zero reviews", async () => {
    const code = await runCli(["history", "clear"]);
    expect(code).toBe(0);
    expect(stdout()).toContain("Cleared 0 review(s)");
  });
});
