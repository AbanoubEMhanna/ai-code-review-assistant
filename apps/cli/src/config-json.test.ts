import { describe, it, expect, vi, afterEach } from "vitest";
import { printConfigJson } from "./output.js";
import type { ConfigJsonOutput } from "./output.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("printConfigJson", () => {
  it("writes valid JSON to stdout", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    const output: ConfigJsonOutput = {
      config: { model: "qwen3:latest", host: "http://localhost:11434", provider: "ollama" },
      configFile: null,
    };
    printConfigJson(output);

    expect(written).toHaveLength(1);
    const parsed = JSON.parse(written[0] ?? "") as ConfigJsonOutput;
    expect(parsed.config.model).toBe("qwen3:latest");
    expect(parsed.config.provider).toBe("ollama");
    expect(parsed.configFile).toBeNull();
  });

  it("includes configFile path when set", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printConfigJson({
      config: { model: "claude-sonnet-4-6", host: "http://localhost:11434", provider: "anthropic" },
      configFile: "/home/user/project/.ai-reviewrc.json",
    });

    const parsed = JSON.parse(written[0] ?? "") as ConfigJsonOutput;
    expect(parsed.configFile).toBe("/home/user/project/.ai-reviewrc.json");
    expect(parsed.config.provider).toBe("anthropic");
  });

  it("includes maxTokens when present", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printConfigJson({
      config: {
        model: "qwen3:latest",
        host: "http://localhost:11434",
        provider: "ollama",
        maxTokens: 2048,
      },
      configFile: null,
    });

    const parsed = JSON.parse(written[0] ?? "") as ConfigJsonOutput;
    expect(parsed.config.maxTokens).toBe(2048);
  });

  it("omits maxTokens when not set", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printConfigJson({
      config: { model: "qwen3:latest", host: "http://localhost:11434", provider: "ollama" },
      configFile: null,
    });

    const parsed = JSON.parse(written[0] ?? "") as ConfigJsonOutput;
    expect("maxTokens" in parsed.config).toBe(false);
  });

  it("output ends with a newline", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printConfigJson({
      config: { model: "qwen3:latest", host: "http://localhost:11434", provider: "ollama" },
      configFile: null,
    });

    expect(written[0] ?? "").toMatch(/\n$/);
  });
});
