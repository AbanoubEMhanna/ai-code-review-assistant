import { describe, it, expect, vi, afterEach } from "vitest";
import type { PingResult } from "@ai-review/ai";
import type { ReviewReport } from "@ai-review/shared";
import { printPingJson, printPingResult, printGitHubAnnotations } from "./output.js";

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

describe("printGitHubAnnotations", () => {
  function makeReport(overrides: Partial<ReviewReport> = {}): ReviewReport {
    return {
      generatedAt: "2026-06-16T00:00:00.000Z",
      model: "qwen3:latest",
      diffSource: "staged changes",
      summary: "Some issues found.",
      stats: { high: 1, medium: 1, low: 1, info: 1, total: 4 },
      comments: [],
      ...overrides,
    };
  }

  it("emits ::error:: for high-severity comments", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printGitHubAnnotations(
      makeReport({
        comments: [
          {
            file: "src/auth.ts",
            line: 42,
            severity: "high",
            category: "security",
            message: "SQL injection risk",
          },
        ],
      })
    );

    expect(written).toHaveLength(1);
    expect(written[0]).toMatch(/^::error /);
    expect(written[0]).toContain("file=src/auth.ts");
    expect(written[0]).toContain("line=42");
    expect(written[0]).toContain("SQL injection risk");
  });

  it("emits ::warning:: for medium-severity comments", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printGitHubAnnotations(
      makeReport({
        comments: [
          {
            file: "src/api.ts",
            severity: "medium",
            category: "performance",
            message: "N+1 query detected",
          },
        ],
      })
    );

    expect(written[0]).toMatch(/^::warning /);
    expect(written[0]).toContain("N+1 query detected");
  });

  it("emits ::notice:: for low and info severity", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printGitHubAnnotations(
      makeReport({
        comments: [
          { file: "src/a.ts", severity: "low", category: "style", message: "Nit" },
          { file: "src/b.ts", severity: "info", category: "maintainability", message: "FYI" },
        ],
      })
    );

    expect(written[0]).toMatch(/^::notice /);
    expect(written[1]).toMatch(/^::notice /);
  });

  it("omits file= when file is 'unknown'", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printGitHubAnnotations(
      makeReport({
        comments: [{ file: "unknown", severity: "high", category: "bug", message: "Bad code" }],
      })
    );

    expect(written[0]).not.toContain("file=");
  });

  it("omits line= when line is undefined", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printGitHubAnnotations(
      makeReport({
        comments: [
          { file: "src/foo.ts", severity: "medium", category: "bug", message: "Issue here" },
        ],
      })
    );

    expect(written[0]).not.toContain("line=");
    expect(written[0]).toContain("file=src/foo.ts");
  });

  it("appends suggestion to annotation body", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printGitHubAnnotations(
      makeReport({
        comments: [
          {
            file: "src/foo.ts",
            severity: "high",
            category: "bug",
            message: "Null check missing",
            suggestion: "Add an early return guard",
          },
        ],
      })
    );

    expect(written[0]).toContain("Null check missing");
    expect(written[0]).toContain("Add an early return guard");
  });

  it("emits nothing when there are no comments", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printGitHubAnnotations(makeReport({ comments: [] }));

    expect(written).toHaveLength(0);
  });

  it("each annotation ends with a newline", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printGitHubAnnotations(
      makeReport({
        comments: [{ file: "src/x.ts", severity: "low", category: "style", message: "Minor" }],
      })
    );

    expect(written[0]).toMatch(/\n$/);
  });
});
