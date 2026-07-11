import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./config.js";

describe("loadConfig error handling", () => {
  let dir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ai-review-config-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    errorSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  it("warns and falls back to defaults on malformed JSON", () => {
    writeFileSync(join(dir, ".ai-reviewrc.json"), "{ not valid json", "utf8");

    const cfg = loadConfig();

    expect(cfg).toEqual({});
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toMatch(/not valid JSON/);
  });

  it("warns and drops fields with the wrong type instead of crashing", () => {
    writeFileSync(
      join(dir, ".ai-reviewrc.json"),
      JSON.stringify({ model: "qwen3:latest", maxTokens: "not-a-number" }),
      "utf8"
    );

    const cfg = loadConfig();

    expect(cfg).toEqual({ model: "qwen3:latest" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toMatch(/"maxTokens" must be a number/);
  });

  it("warns when the config file is a JSON array instead of an object", () => {
    writeFileSync(join(dir, ".ai-reviewrc.json"), "[1, 2, 3]", "utf8");

    const cfg = loadConfig();

    expect(cfg).toEqual({});
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toMatch(/must contain a JSON object/);
  });

  it("loads valid config without printing any warning", () => {
    writeFileSync(
      join(dir, ".ai-reviewrc.json"),
      JSON.stringify({ model: "qwen3:latest", host: "http://localhost:11434", maxTokens: 2048 }),
      "utf8"
    );

    const cfg = loadConfig();

    expect(cfg).toEqual({ model: "qwen3:latest", host: "http://localhost:11434", maxTokens: 2048 });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("returns defaults quietly when no config file exists", () => {
    const cfg = loadConfig();

    expect(cfg).toEqual({});
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
