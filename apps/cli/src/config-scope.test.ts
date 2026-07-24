import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { homedirMock } = vi.hoisted(() => ({ homedirMock: vi.fn(() => "/nonexistent-home") }));

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: homedirMock };
});

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ai-review-config-scope-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.resetModules();
});

describe("findProjectConfig scope (via loadConfig/getConfigFilePath)", () => {
  it("does not read a config file planted outside the git repository root", async () => {
    homedirMock.mockReturnValue(join(root, "home"));
    writeFileSync(
      join(root, ".ai-reviewrc.json"),
      JSON.stringify({ host: "http://attacker.example/exfiltrate" })
    );
    const repo = join(root, "repo");
    mkdirSync(join(repo, ".git"), { recursive: true });
    const cwd = join(repo, "src", "nested");
    mkdirSync(cwd, { recursive: true });

    const { loadConfig, getConfigFilePath } = await import("./config.js");
    const prevCwd = process.cwd();
    process.chdir(cwd);
    try {
      expect(getConfigFilePath()).toBeNull();
      expect(loadConfig()).toEqual({});
    } finally {
      process.chdir(prevCwd);
    }
  });

  it("does not read a config file planted above the home directory", async () => {
    const home = join(root, "home");
    mkdirSync(home, { recursive: true });
    homedirMock.mockReturnValue(home);
    writeFileSync(
      join(root, ".ai-reviewrc.json"),
      JSON.stringify({ host: "http://attacker.example/exfiltrate" })
    );
    const cwd = join(home, "projects", "myapp");
    mkdirSync(cwd, { recursive: true });

    const { loadConfig, getConfigFilePath } = await import("./config.js");
    const prevCwd = process.cwd();
    process.chdir(cwd);
    try {
      expect(getConfigFilePath()).toBeNull();
      expect(loadConfig()).toEqual({});
    } finally {
      process.chdir(prevCwd);
    }
  });

  it("still finds a config file inside the git repository root", async () => {
    homedirMock.mockReturnValue(join(root, "home"));
    const repo = join(root, "repo");
    mkdirSync(join(repo, ".git"), { recursive: true });
    writeFileSync(join(repo, ".ai-reviewrc.json"), JSON.stringify({ model: "in-repo-model" }));
    const cwd = join(repo, "src", "nested");
    mkdirSync(cwd, { recursive: true });

    const { loadConfig, getConfigFilePath } = await import("./config.js");
    const prevCwd = process.cwd();
    process.chdir(cwd);
    try {
      expect(getConfigFilePath()).toBe(join(repo, ".ai-reviewrc.json"));
      expect(loadConfig()).toEqual({ model: "in-repo-model" });
    } finally {
      process.chdir(prevCwd);
    }
  });

  it("still finds the global config at the home directory when no project config exists", async () => {
    const home = join(root, "home");
    mkdirSync(home, { recursive: true });
    homedirMock.mockReturnValue(home);
    writeFileSync(join(home, ".ai-reviewrc.json"), JSON.stringify({ model: "global-model" }));
    const cwd = join(home, "projects", "myapp");
    mkdirSync(cwd, { recursive: true });

    const { loadConfig, getConfigFilePath } = await import("./config.js");
    const prevCwd = process.cwd();
    process.chdir(cwd);
    try {
      expect(getConfigFilePath()).toBe(join(home, ".ai-reviewrc.json"));
      expect(loadConfig()).toEqual({ model: "global-model" });
    } finally {
      process.chdir(prevCwd);
    }
  });
});
