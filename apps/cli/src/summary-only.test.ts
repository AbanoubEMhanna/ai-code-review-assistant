import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printSummaryOnly } from "./output.js";
import type { ReviewReport } from "@ai-review/shared";

function makeReport(overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    generatedAt: "2024-01-15T12:00:00.000Z",
    model: "qwen3:latest",
    diffSource: "staged changes",
    summary: "The code looks good overall with a few minor issues.",
    comments: [],
    stats: { high: 0, medium: 0, low: 0, info: 0, total: 0 },
    ...overrides,
  };
}

describe("printSummaryOnly", () => {
  let output: string;

  beforeEach(() => {
    output = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });
    vi.spyOn(console, "log").mockImplementation((...args) => {
      output += args.join(" ") + "\n";
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes the summary text", () => {
    printSummaryOnly(makeReport({ summary: "All looks fine." }));
    expect(output).toContain("All looks fine.");
  });

  it("includes model and diff source metadata", () => {
    printSummaryOnly(makeReport({ model: "claude-sonnet-4-6", diffSource: "diff vs main" }));
    expect(output).toContain("claude-sonnet-4-6");
    expect(output).toContain("diff vs main");
  });

  it("shows 'none' when there are no issues", () => {
    printSummaryOnly(makeReport({ stats: { high: 0, medium: 0, low: 0, info: 0, total: 0 } }));
    expect(output).toContain("none");
  });

  it("shows issue counts when issues are present", () => {
    printSummaryOnly(
      makeReport({
        stats: { high: 2, medium: 3, low: 1, info: 0, total: 6 },
        comments: [],
      })
    );
    expect(output).toContain("2 high");
    expect(output).toContain("3 medium");
    expect(output).toContain("1 low");
  });

  it("hints to run without --summary-only when issues exist", () => {
    printSummaryOnly(
      makeReport({
        stats: { high: 1, medium: 0, low: 0, info: 0, total: 1 },
        comments: [],
      })
    );
    expect(output).toContain("--summary-only");
  });

  it("does not include hint when there are no issues", () => {
    printSummaryOnly(makeReport({ stats: { high: 0, medium: 0, low: 0, info: 0, total: 0 } }));
    expect(output).not.toContain("--summary-only");
  });

  it("does not list individual issue messages or file paths", () => {
    const report = makeReport({
      stats: { high: 1, medium: 0, low: 0, info: 0, total: 1 },
      comments: [
        {
          file: "src/auth.ts",
          line: 42,
          severity: "high",
          category: "security",
          message: "Password stored in plaintext",
          suggestion: "Use bcrypt",
        },
      ],
    });
    printSummaryOnly(report);
    expect(output).not.toContain("Password stored in plaintext");
    expect(output).not.toContain("src/auth.ts");
  });

  it("shows 'AI Code Review — Summary' as header", () => {
    printSummaryOnly(makeReport());
    expect(output).toContain("AI Code Review — Summary");
  });
});
