import { describe, it, expect, vi, afterEach } from "vitest";
import { printHistorySearchJson, printConfigJson } from "./output.js";
import type { StoredReview } from "./history-store.js";

function makeStoredReview(overrides: Partial<StoredReview> = {}): StoredReview {
  return {
    id: "1748000000000-abc123",
    generatedAt: "2026-05-23T00:00:00.000Z",
    model: "qwen3:latest",
    diffSource: "staged changes",
    summary: "No issues found.",
    comments: [],
    stats: { high: 0, medium: 0, low: 0, info: 0, total: 0 },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("printHistorySearchJson", () => {
  it("writes a valid JSON array to stdout", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    const results = [makeStoredReview(), makeStoredReview({ id: "1748000000001-def456" })];
    printHistorySearchJson(results);

    expect(written).toHaveLength(1);
    const parsed = JSON.parse(written[0] ?? "") as StoredReview[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.id).toBe("1748000000000-abc123");
    expect(parsed[1]?.id).toBe("1748000000001-def456");
  });

  it("writes an empty array when no results", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printHistorySearchJson([]);

    const parsed = JSON.parse(written[0] ?? "") as unknown[];
    expect(parsed).toEqual([]);
  });

  it("includes all StoredReview fields", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printHistorySearchJson([makeStoredReview({ summary: "Found 1 issue." })]);

    const parsed = JSON.parse(written[0] ?? "") as StoredReview[];
    expect(parsed[0]?.summary).toBe("Found 1 issue.");
    expect(parsed[0]?.stats).toEqual({ high: 0, medium: 0, low: 0, info: 0, total: 0 });
  });

  it("output ends with a newline", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printHistorySearchJson([makeStoredReview()]);
    expect(written[0] ?? "").toMatch(/\n$/);
  });
});

describe("printConfigJson", () => {
  it("writes a valid JSON object with config and configFile fields", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    const config = { model: "qwen3:latest", host: "http://localhost:11434", provider: "ollama" };
    printConfigJson(config, "/home/user/.ai-reviewrc.json");

    expect(written).toHaveLength(1);
    const parsed = JSON.parse(written[0] ?? "") as { config: typeof config; configFile: string };
    expect(parsed.config.model).toBe("qwen3:latest");
    expect(parsed.config.provider).toBe("ollama");
    expect(parsed.configFile).toBe("/home/user/.ai-reviewrc.json");
  });

  it("sets configFile to null when no config file exists", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printConfigJson(
      { model: "qwen3:latest", host: "http://localhost:11434", provider: "ollama" },
      null
    );

    const parsed = JSON.parse(written[0] ?? "") as { config: unknown; configFile: null };
    expect(parsed.configFile).toBeNull();
  });

  it("includes optional fields like maxTokens when present", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printConfigJson(
      {
        model: "qwen3:latest",
        host: "http://localhost:11434",
        provider: "ollama",
        maxTokens: 2048,
      },
      null
    );

    const parsed = JSON.parse(written[0] ?? "") as { config: { maxTokens: number } };
    expect(parsed.config.maxTokens).toBe(2048);
  });

  it("output ends with a newline", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    printConfigJson({ model: "qwen3:latest" }, null);
    expect(written[0] ?? "").toMatch(/\n$/);
  });
});
