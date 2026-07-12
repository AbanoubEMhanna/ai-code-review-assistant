import { describe, it, expect, vi, afterEach } from "vitest";
import { printModelsList, printModelsJson } from "./output.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("printModelsJson", () => {
  it("writes a valid JSON object with provider, host, count, and models fields", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printModelsJson(["llama3:latest", "qwen3:latest"], "ollama", "http://localhost:11434");

    expect(written).toHaveLength(1);
    const parsed = JSON.parse(written[0] ?? "") as {
      provider: string;
      host: string;
      count: number;
      models: string[];
    };
    expect(parsed.provider).toBe("ollama");
    expect(parsed.host).toBe("http://localhost:11434");
    expect(parsed.count).toBe(2);
    expect(parsed.models).toEqual(["llama3:latest", "qwen3:latest"]);
  });

  it("uses api.anthropic.com as host for anthropic provider", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printModelsJson(["claude-sonnet-4-6"], "anthropic", "https://api.anthropic.com");

    const parsed = JSON.parse(written[0] ?? "") as { host: string };
    expect(parsed.host).toBe("api.anthropic.com");
  });

  it("returns count of 0 and empty array when no models", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printModelsJson([], "ollama", "http://localhost:11434");

    const parsed = JSON.parse(written[0] ?? "") as { count: number; models: string[] };
    expect(parsed.count).toBe(0);
    expect(parsed.models).toEqual([]);
  });

  it("output ends with a newline", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printModelsJson(["model1"], "ollama", "http://localhost:11434");
    expect(written[0] ?? "").toMatch(/\n$/);
  });
});

describe("printModelsList", () => {
  it("prints each model name", () => {
    const lines: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(String(args[0]));
    });

    printModelsList(["llama3:latest", "qwen3:latest"], "ollama", "http://localhost:11434");

    const output = lines.join("\n");
    expect(output).toContain("llama3:latest");
    expect(output).toContain("qwen3:latest");
    logSpy.mockRestore();
  });

  it("shows 'No models found' when list is empty", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(String(args[0]));
    });

    printModelsList([], "lmstudio", "http://localhost:1234");

    const output = lines.join("\n");
    expect(output).toContain("No models found");
  });

  it("shows an ollama hint when provider is ollama and list is empty", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(String(args[0]));
    });

    printModelsList([], "ollama", "http://localhost:11434");

    const output = lines.join("\n");
    expect(output).toContain("ollama pull");
  });

  it("shows total count in output", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(String(args[0]));
    });

    printModelsList(["a", "b", "c"], "ollama", "http://localhost:11434");

    const output = lines.join("\n");
    expect(output).toContain("3 model(s) total");
  });

  it("does not show ollama pull hint for non-ollama providers with no models", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(String(args[0]));
    });

    printModelsList([], "anthropic", "https://api.anthropic.com");

    const output = lines.join("\n");
    expect(output).not.toContain("ollama pull");
  });
});
