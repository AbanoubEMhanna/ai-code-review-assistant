import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { PingResult } from "@ai-review/ai";
import type { ReviewReport } from "@ai-review/shared";
import { printPingJson, printPingResult, buildSarif, saveSarif } from "./output.js";

function makeReport(overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    model: "qwen3:latest",
    diffSource: "staged changes",
    summary: "Looks mostly fine.",
    comments: [
      {
        file: "src/index.ts",
        line: 42,
        severity: "high",
        category: "security",
        message: "Possible SQL injection.",
        suggestion: "Use a parameterized query.",
      },
      {
        file: "src/index.ts",
        severity: "low",
        category: "style",
        message: "Inconsistent quotes.",
      },
    ],
    stats: { high: 1, medium: 0, low: 1, info: 0, total: 2 },
    ...overrides,
  };
}

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

describe("buildSarif", () => {
  it("produces a SARIF 2.1.0 log with one result per comment", () => {
    const sarif = buildSarif(makeReport()) as {
      version: string;
      runs: Array<{
        tool: { driver: { name: string; rules: Array<{ id: string }> } };
        results: Array<{ ruleId: string; level: string; locations: unknown[] }>;
      }>;
    };

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0]?.tool.driver.name).toBe("ai-code-review-assistant");
    expect(sarif.runs[0]?.results).toHaveLength(2);
  });

  it("maps severities to SARIF levels", () => {
    const sarif = buildSarif(makeReport()) as {
      runs: Array<{ results: Array<{ level: string }> }>;
    };
    const levels = sarif.runs[0]?.results.map((r) => r.level);
    expect(levels).toEqual(["error", "note"]);
  });

  it("includes the line number when present and omits it when absent", () => {
    const sarif = buildSarif(makeReport()) as {
      runs: Array<{
        results: Array<{
          locations: Array<{ physicalLocation: { region?: { startLine: number } } }>;
        }>;
      }>;
    };
    const [withLine, withoutLine] = sarif.runs[0]?.results ?? [];
    expect(withLine?.locations[0]?.physicalLocation.region?.startLine).toBe(42);
    expect(withoutLine?.locations[0]?.physicalLocation.region).toBeUndefined();
  });

  it("deduplicates rules by category", () => {
    const sarif = buildSarif(
      makeReport({
        comments: [
          { file: "a.ts", severity: "high", category: "bug", message: "x" },
          { file: "b.ts", severity: "medium", category: "bug", message: "y" },
        ],
      })
    ) as { runs: Array<{ tool: { driver: { rules: Array<{ id: string }> } } }> };
    expect(sarif.runs[0]?.tool.driver.rules).toHaveLength(1);
    expect(sarif.runs[0]?.tool.driver.rules[0]?.id).toBe("bug");
  });

  it("folds the suggestion into the result message when present", () => {
    const sarif = buildSarif(makeReport()) as {
      runs: Array<{ results: Array<{ message: { text: string } }> }>;
    };
    expect(sarif.runs[0]?.results[0]?.message.text).toContain("Use a parameterized query.");
  });
});

describe("saveSarif", () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes a parseable SARIF file to disk", () => {
    dir = mkdtempSync(join(tmpdir(), "ai-review-cli-test-"));
    const outputPath = join(dir, "report.sarif");

    saveSarif(makeReport(), outputPath);

    const parsed = JSON.parse(readFileSync(outputPath, "utf8")) as { version: string };
    expect(parsed.version).toBe("2.1.0");
  });
});
