import { describe, it, expect, vi, afterEach } from "vitest";
import type { PingResult } from "@ai-review/ai";
import { printPingJson, printPingResult } from "./output.js";

function makePingResult(overrides: Partial<PingResult> = {}): PingResult {
  return {
    ok: true,
    provider: "ollama",
    host: "http://localhost:11434",
    model: "qwen3:latest",
    latencyMs: 42,
    modelFound: true,
    availableModels: ["qwen3:latest", "llama3:8b"],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("printPingJson", () => {
  it("writes valid JSON to stdout", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    const result = makePingResult();
    printPingJson(result);

    expect(written).toHaveLength(1);
    const parsed = JSON.parse(written[0] ?? "") as PingResult;
    expect(parsed.ok).toBe(true);
    expect(parsed.provider).toBe("ollama");
    expect(parsed.model).toBe("qwen3:latest");
    expect(parsed.latencyMs).toBe(42);
    expect(parsed.modelFound).toBe(true);
    expect(parsed.availableModels).toEqual(["qwen3:latest", "llama3:8b"]);
  });

  it("serializes error field when present", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printPingJson(makePingResult({ ok: false, error: "ECONNREFUSED", modelFound: false }));

    const parsed = JSON.parse(written[0] ?? "") as PingResult;
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe("ECONNREFUSED");
  });

  it("output ends with a newline", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printPingJson(makePingResult());
    expect(written[0] ?? "").toMatch(/\n$/);
  });
});

describe("printPingResult — human-readable output", () => {
  it("prints success message when ok and model found", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });

    printPingResult(makePingResult());

    const joined = lines.join("\n");
    expect(joined).toContain("Host reachable");
    expect(joined).toContain("qwen3:latest");
    expect(joined).toContain("Ready to review");
  });

  it("prints failure message when ok=false", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });

    printPingResult(makePingResult({ ok: false, error: "ECONNREFUSED", modelFound: false }));

    const joined = lines.join("\n");
    expect(joined).toContain("Connection failed");
    expect(joined).toContain("ECONNREFUSED");
  });

  it("prints model-not-found warning when ok but model absent", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });

    printPingResult(makePingResult({ modelFound: false }));

    const joined = lines.join("\n");
    expect(joined).toContain("not found");
  });

  it("lists available models when model not found", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });

    printPingResult(makePingResult({ modelFound: false, availableModels: ["llama3:8b"] }));

    const joined = lines.join("\n");
    expect(joined).toContain("llama3:8b");
  });

  it("shows ollama pull hint when provider is ollama and model not found", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });

    printPingResult(makePingResult({ provider: "ollama", modelFound: false, availableModels: [] }));

    const joined = lines.join("\n");
    expect(joined).toContain("ollama pull");
  });

  it("shows generic empty-models message for non-ollama provider", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });

    printPingResult(
      makePingResult({ provider: "lmstudio", modelFound: false, availableModels: [] })
    );

    const joined = lines.join("\n");
    expect(joined).not.toContain("ollama pull");
  });
});
