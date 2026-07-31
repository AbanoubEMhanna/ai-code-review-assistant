import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: vi.fn(actual.homedir) };
});

const { loadConfig, getConfigFilePath } = await import("./config.js");

const homedirMock = vi.mocked(homedir);

let projectDir: string;
let fakeHome: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  projectDir = mkdtempSync(join(tmpdir(), "ai-review-config-project-"));
  fakeHome = mkdtempSync(join(tmpdir(), "ai-review-config-home-"));
  homedirMock.mockReturnValue(fakeHome);
  process.chdir(projectDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(fakeHome, { recursive: true, force: true });
  homedirMock.mockReset();
});

describe("loadConfig()", () => {
  it("returns empty config when no file exists anywhere", () => {
    expect(loadConfig()).toEqual({});
  });

  it("reads model/host/provider/maxTokens from a project config file", () => {
    writeFileSync(
      join(projectDir, ".ai-reviewrc.json"),
      JSON.stringify({
        model: "qwen3:latest",
        host: "http://localhost:11434",
        provider: "ollama",
        maxTokens: 2048,
      })
    );
    expect(loadConfig()).toEqual({
      model: "qwen3:latest",
      host: "http://localhost:11434",
      provider: "ollama",
      maxTokens: 2048,
    });
  });

  it("walks up parent directories to find a project config file", () => {
    writeFileSync(join(projectDir, ".ai-reviewrc.json"), JSON.stringify({ model: "from-root" }));
    const nested = join(projectDir, "a", "b", "c");
    mkdirSync(nested, { recursive: true });
    process.chdir(nested);
    expect(loadConfig()).toEqual({ model: "from-root" });
  });

  it("falls back to a global config file in the home directory", () => {
    writeFileSync(join(fakeHome, ".ai-reviewrc.json"), JSON.stringify({ model: "from-home" }));
    expect(loadConfig()).toEqual({ model: "from-home" });
  });

  it("prefers a project config file over the global one", () => {
    writeFileSync(join(projectDir, ".ai-reviewrc.json"), JSON.stringify({ model: "from-project" }));
    writeFileSync(join(fakeHome, ".ai-reviewrc.json"), JSON.stringify({ model: "from-home" }));
    expect(loadConfig()).toEqual({ model: "from-project" });
  });

  it("returns empty config for malformed JSON", () => {
    writeFileSync(join(projectDir, ".ai-reviewrc.json"), "{ not valid json");
    expect(loadConfig()).toEqual({});
  });

  it("returns empty config when the file is a JSON array", () => {
    writeFileSync(join(projectDir, ".ai-reviewrc.json"), "[1, 2, 3]");
    expect(loadConfig()).toEqual({});
  });

  it("returns empty config when the file is a JSON primitive", () => {
    writeFileSync(join(projectDir, ".ai-reviewrc.json"), '"just a string"');
    expect(loadConfig()).toEqual({});
  });

  it("ignores fields with the wrong type", () => {
    writeFileSync(
      join(projectDir, ".ai-reviewrc.json"),
      JSON.stringify({ model: 123, host: true, provider: null, maxTokens: "not-a-number" })
    );
    expect(loadConfig()).toEqual({});
  });

  it("ignores unknown fields", () => {
    writeFileSync(
      join(projectDir, ".ai-reviewrc.json"),
      JSON.stringify({ model: "qwen3:latest", unknownField: "ignored" })
    );
    expect(loadConfig()).toEqual({ model: "qwen3:latest" });
  });
});

describe("getConfigFilePath()", () => {
  it("returns null when no config file exists", () => {
    expect(getConfigFilePath()).toBeNull();
  });

  it("returns the project config file path when present", () => {
    const path = join(projectDir, ".ai-reviewrc.json");
    writeFileSync(path, JSON.stringify({ model: "qwen3:latest" }));
    expect(getConfigFilePath()).toBe(path);
  });

  it("returns the global config file path when only the home file exists", () => {
    const path = join(fakeHome, ".ai-reviewrc.json");
    writeFileSync(path, JSON.stringify({ model: "qwen3:latest" }));
    expect(getConfigFilePath()).toBe(path);
  });
});
