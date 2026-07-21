import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => emptyHomedir };
});

let emptyHomedir: string;
let dir: string;

beforeEach(async () => {
  emptyHomedir = mkdtempSync(join(tmpdir(), "ai-review-home-"));
  dir = mkdtempSync(join(tmpdir(), "ai-review-cwd-"));
});

afterEach(() => {
  rmSync(emptyHomedir, { recursive: true });
  rmSync(dir, { recursive: true });
});

const defaults = { model: "qwen3:latest", host: "http://localhost:11434", provider: "ollama" };

describe("initConfigFile()", () => {
  it("creates a new config file when none exists", async () => {
    const { initConfigFile } = await import("./config.js");
    const { path, overwrote } = initConfigFile(defaults, { cwd: dir });
    expect(path).toBe(join(dir, ".ai-reviewrc.json"));
    expect(overwrote).toBe(false);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(defaults);
  });

  it("throws ConfigFileExistsError when a local config already exists and force is not set", async () => {
    const { initConfigFile, ConfigFileExistsError } = await import("./config.js");
    initConfigFile(defaults, { cwd: dir });
    expect(() => initConfigFile(defaults, { cwd: dir })).toThrow(ConfigFileExistsError);
  });

  it("overwrites the local config when force is set", async () => {
    const { initConfigFile } = await import("./config.js");
    initConfigFile({ ...defaults, model: "old-model" }, { cwd: dir });
    const { path, overwrote } = initConfigFile(
      { ...defaults, model: "new-model" },
      { cwd: dir, force: true }
    );
    expect(overwrote).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8")).model).toBe("new-model");
  });

  it("throws referencing the parent directory's config when one is found up the tree", async () => {
    const { initConfigFile, ConfigFileExistsError } = await import("./config.js");
    initConfigFile(defaults, { cwd: dir });
    const subDir = join(dir, "nested");
    mkdirSync(subDir);
    try {
      initConfigFile(defaults, { cwd: subDir });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigFileExistsError);
      expect((err as InstanceType<typeof ConfigFileExistsError>).path).toBe(
        join(dir, ".ai-reviewrc.json")
      );
    }
  });

  it("with force, creates a local override without touching the parent config", async () => {
    const { initConfigFile } = await import("./config.js");
    initConfigFile({ ...defaults, model: "parent-model" }, { cwd: dir });
    const subDir = join(dir, "nested");
    mkdirSync(subDir);
    const { path, overwrote } = initConfigFile(
      { ...defaults, model: "child-model" },
      { cwd: subDir, force: true }
    );
    expect(path).toBe(join(subDir, ".ai-reviewrc.json"));
    expect(overwrote).toBe(false);
    expect(JSON.parse(readFileSync(join(dir, ".ai-reviewrc.json"), "utf8")).model).toBe(
      "parent-model"
    );
  });
});
