import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONFIG_KEYS, isConfigKey, setConfigValue, unsetConfigValue } from "./config.js";

let dir: string;
let configPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ai-review-config-test-"));
  configPath = join(dir, ".ai-reviewrc.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true });
});

describe("isConfigKey()", () => {
  it("returns true for all valid keys", () => {
    for (const key of CONFIG_KEYS) {
      expect(isConfigKey(key)).toBe(true);
    }
  });

  it("returns false for unknown keys", () => {
    expect(isConfigKey("unknown")).toBe(false);
    expect(isConfigKey("apiKey")).toBe(false);
    expect(isConfigKey("")).toBe(false);
  });
});

describe("setConfigValue()", () => {
  it("creates config file if it does not exist", () => {
    expect(existsSync(configPath)).toBe(false);
    setConfigValue("model", "gpt-4", configPath);
    expect(existsSync(configPath)).toBe(true);
  });

  it("writes the correct key-value pair", () => {
    setConfigValue("model", "llama3:latest", configPath);
    const contents = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    expect(contents["model"]).toBe("llama3:latest");
  });

  it("writes provider and host as strings", () => {
    setConfigValue("provider", "anthropic", configPath);
    setConfigValue("host", "http://localhost:1234", configPath);
    const contents = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    expect(contents["provider"]).toBe("anthropic");
    expect(contents["host"]).toBe("http://localhost:1234");
  });

  it("parses maxTokens as a number", () => {
    setConfigValue("maxTokens", "8192", configPath);
    const contents = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    expect(contents["maxTokens"]).toBe(8192);
  });

  it("throws for invalid maxTokens", () => {
    expect(() => setConfigValue("maxTokens", "abc", configPath)).toThrow(
      '"maxTokens" must be a positive integer'
    );
    expect(() => setConfigValue("maxTokens", "0", configPath)).toThrow(
      '"maxTokens" must be a positive integer'
    );
    expect(() => setConfigValue("maxTokens", "-1", configPath)).toThrow(
      '"maxTokens" must be a positive integer'
    );
  });

  it("preserves existing keys when setting a new one", () => {
    writeFileSync(configPath, JSON.stringify({ model: "old-model", host: "http://old" }) + "\n");
    setConfigValue("provider", "anthropic", configPath);
    const contents = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    expect(contents["model"]).toBe("old-model");
    expect(contents["host"]).toBe("http://old");
    expect(contents["provider"]).toBe("anthropic");
  });

  it("overwrites an existing key", () => {
    writeFileSync(configPath, JSON.stringify({ model: "old-model" }) + "\n");
    setConfigValue("model", "new-model", configPath);
    const contents = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    expect(contents["model"]).toBe("new-model");
  });

  it("produces valid JSON with a trailing newline", () => {
    setConfigValue("model", "test", configPath);
    const raw = readFileSync(configPath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(raw.endsWith("\n")).toBe(true);
  });
});

describe("unsetConfigValue()", () => {
  it("returns false when no config file exists", () => {
    expect(unsetConfigValue("model", configPath)).toBe(false);
  });

  it("returns false when key is not present", () => {
    writeFileSync(configPath, JSON.stringify({ host: "http://localhost" }) + "\n");
    expect(unsetConfigValue("model", configPath)).toBe(false);
  });

  it("removes the key and returns true", () => {
    writeFileSync(configPath, JSON.stringify({ model: "to-remove", host: "keep-me" }) + "\n");
    const removed = unsetConfigValue("model", configPath);
    expect(removed).toBe(true);
    const contents = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    expect("model" in contents).toBe(false);
    expect(contents["host"]).toBe("keep-me");
  });

  it("keeps remaining keys intact after unset", () => {
    writeFileSync(
      configPath,
      JSON.stringify({ model: "m", host: "h", provider: "p", maxTokens: 512 }) + "\n"
    );
    unsetConfigValue("provider", configPath);
    const contents = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    expect("provider" in contents).toBe(false);
    expect(contents["model"]).toBe("m");
    expect(contents["host"]).toBe("h");
    expect(contents["maxTokens"]).toBe(512);
  });

  it("produces valid JSON after unset", () => {
    writeFileSync(configPath, JSON.stringify({ model: "m", provider: "p" }) + "\n");
    unsetConfigValue("model", configPath);
    const raw = readFileSync(configPath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(raw.endsWith("\n")).toBe(true);
  });
});
