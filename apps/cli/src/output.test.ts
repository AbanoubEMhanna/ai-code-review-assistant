import { describe, it, expect, vi, afterEach } from "vitest";
import type { PingResult } from "@ai-review/ai";
import type { ReviewReport } from "@ai-review/shared";
import { printPingJson, printPingResult, buildMarkdown } from "./output.js";

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

function makeReport(overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    model: "claude-sonnet-4-6",
    diffSource: "staged changes",
    summary: "Looks good.",
    comments: [],
    stats: { high: 0, medium: 0, low: 0, info: 0, total: 0 },
    ...overrides,
  };
}

describe("buildMarkdown — token usage", () => {
  it("omits the usage line when no usage data is present", () => {
    const md = buildMarkdown(makeReport());
    expect(md).not.toContain("Usage:");
  });

  it("includes token counts and estimated cost when usage is present", () => {
    const md = buildMarkdown(
      makeReport({ usage: { inputTokens: 1200, outputTokens: 300, estimatedCostUsd: 0.0081 } })
    );
    expect(md).toContain("Usage:");
    expect(md).toContain("1,200 in / 300 out tokens");
    expect(md).toContain("$0.0081");
  });

  it("omits the cost figure when the model has no known price", () => {
    const md = buildMarkdown(makeReport({ usage: { inputTokens: 1200, outputTokens: 300 } }));
    expect(md).toContain("1,200 in / 300 out tokens");
    expect(md).not.toContain("$");
  });
});
