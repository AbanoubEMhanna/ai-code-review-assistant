import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeConfigValue } from "./config.js";

let dir: string;
let configPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ai-review-config-test-"));
  configPath = join(dir, ".ai-reviewrc.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true });
});

describe("writeConfigValue()", () => {
  it("creates a new config file with the given key/value", () => {
    writeConfigValue(configPath, "model", "qwen3:latest");
    const written = JSON.parse(readFileSync(configPath, "utf8"));
    expect(written).toEqual({ model: "qwen3:latest" });
  });

  it("merges into an existing config file without dropping other keys", () => {
    writeFileSync(configPath, JSON.stringify({ model: "qwen3:latest", host: "http://x" }));
    writeConfigValue(configPath, "provider", "anthropic");
    const written = JSON.parse(readFileSync(configPath, "utf8"));
    expect(written).toEqual({
      model: "qwen3:latest",
      host: "http://x",
      provider: "anthropic",
    });
  });

  it("overwrites an existing value for the same key", () => {
    writeFileSync(configPath, JSON.stringify({ model: "old-model" }));
    writeConfigValue(configPath, "model", "new-model");
    const written = JSON.parse(readFileSync(configPath, "utf8"));
    expect(written).toEqual({ model: "new-model" });
  });

  it("stores numeric values for maxTokens", () => {
    writeConfigValue(configPath, "maxTokens", 8192);
    const written = JSON.parse(readFileSync(configPath, "utf8"));
    expect(written).toEqual({ maxTokens: 8192 });
  });

  it("starts fresh when the existing file is corrupt JSON", () => {
    writeFileSync(configPath, "{ not valid json");
    writeConfigValue(configPath, "model", "qwen3:latest");
    const written = JSON.parse(readFileSync(configPath, "utf8"));
    expect(written).toEqual({ model: "qwen3:latest" });
  });

  it("ends the file with a trailing newline", () => {
    writeConfigValue(configPath, "model", "qwen3:latest");
    expect(readFileSync(configPath, "utf8")).toMatch(/\n$/);
  });
});
