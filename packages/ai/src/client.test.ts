import { describe, it, expect, vi, afterEach } from "vitest";
import { reviewDiff } from "./client.js";
import type { ReviewOptions } from "@ai-review/shared";

afterEach(() => {
  vi.restoreAllMocks();
});

const VALID_RESPONSE = JSON.stringify({
  summary: "Looks good overall.",
  comments: [
    {
      file: "src/index.ts",
      line: 12,
      severity: "medium",
      category: "bug",
      message: "Off-by-one error in loop bound.",
      suggestion: "Use < instead of <=.",
    },
  ],
});

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    })
  );
}

const DIFF = "diff --git a/src/index.ts b/src/index.ts\n+console.log('x');\n";

describe("reviewDiff — empty diff short-circuit", () => {
  it("returns immediately without calling fetch when the diff is blank", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await reviewDiff("   \n", "staged changes", {
      model: "qwen3:latest",
      host: "http://localhost:11434",
      provider: "ollama",
    });
    expect(result).toEqual({ summary: "No changes to review.", comments: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("reviewDiff — ollama provider", () => {
  it("calls the /api/chat endpoint and parses a valid response", async () => {
    mockFetchOnce(200, { message: { content: VALID_RESPONSE } });
    const opts: ReviewOptions = {
      model: "qwen3:latest",
      host: "http://localhost:11434",
      provider: "ollama",
    };
    const result = await reviewDiff(DIFF, "staged changes", opts);
    expect(result.summary).toBe("Looks good overall.");
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]).toMatchObject({
      file: "src/index.ts",
      line: 12,
      severity: "medium",
    });
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("http://localhost:11434/api/chat");
  });

  it("falls back to the OpenAI-compatible endpoint when /api/chat fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ choices: [{ message: { content: VALID_RESPONSE } }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await reviewDiff(DIFF, "staged changes", {
      model: "qwen3:latest",
      host: "http://localhost:11434",
      provider: "ollama",
    });

    expect(result.summary).toBe("Looks good overall.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:11434/api/chat");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:11434/v1/chat/completions");
  });

  it("throws when both the native and fallback endpoints fail", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reviewDiff(DIFF, "staged changes", {
        model: "qwen3:latest",
        host: "http://localhost:11434",
        provider: "ollama",
      })
    ).rejects.toThrow("ECONNREFUSED");
  });
});

describe("reviewDiff — lmstudio provider", () => {
  it("calls the /v1/chat/completions endpoint", async () => {
    mockFetchOnce(200, { choices: [{ message: { content: VALID_RESPONSE } }] });
    const result = await reviewDiff(DIFF, "staged changes", {
      model: "mistral-7b",
      host: "http://localhost:1234",
      provider: "lmstudio",
    });
    expect(result.summary).toBe("Looks good overall.");
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("http://localhost:1234/v1/chat/completions");
  });

  it("throws a descriptive error on a non-ok HTTP response", async () => {
    mockFetchOnce(500, "internal error");
    await expect(
      reviewDiff(DIFF, "staged changes", {
        model: "mistral-7b",
        host: "http://localhost:1234",
        provider: "lmstudio",
      })
    ).rejects.toThrow(/AI request failed \(500\)/);
  });

  it("throws when the response has no message content", async () => {
    mockFetchOnce(200, { choices: [{ message: {} }] });
    await expect(
      reviewDiff(DIFF, "staged changes", {
        model: "mistral-7b",
        host: "http://localhost:1234",
        provider: "lmstudio",
      })
    ).rejects.toThrow("Empty response from AI");
  });
});

describe("reviewDiff — anthropic provider", () => {
  it("throws when no API key is provided", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(
      reviewDiff(DIFF, "staged changes", {
        model: "claude-sonnet-4-6",
        host: "http://localhost:11434",
        provider: "anthropic",
      })
    ).rejects.toThrow(/requires an API key/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the api key header and parses a valid response", async () => {
    mockFetchOnce(200, { content: [{ type: "text", text: VALID_RESPONSE }] });
    const result = await reviewDiff(DIFF, "staged changes", {
      model: "claude-sonnet-4-6",
      host: "http://localhost:11434",
      provider: "anthropic",
      apiKey: "sk-ant-test",
    });
    expect(result.summary).toBe("Looks good overall.");
    const call = vi.mocked(fetch).mock.calls[0];
    expect(call?.[0]).toBe("https://api.anthropic.com/v1/messages");
    expect((call?.[1]?.headers as Record<string, string> | undefined)?.["x-api-key"]).toBe(
      "sk-ant-test"
    );
  });

  it("throws a descriptive error on a non-ok HTTP response", async () => {
    mockFetchOnce(401, "unauthorized");
    await expect(
      reviewDiff(DIFF, "staged changes", {
        model: "claude-sonnet-4-6",
        host: "http://localhost:11434",
        provider: "anthropic",
        apiKey: "sk-ant-test",
      })
    ).rejects.toThrow(/Anthropic API request failed \(401\)/);
  });

  it("throws when the response has no text content block", async () => {
    mockFetchOnce(200, { content: [{ type: "image", text: "" }] });
    await expect(
      reviewDiff(DIFF, "staged changes", {
        model: "claude-sonnet-4-6",
        host: "http://localhost:11434",
        provider: "anthropic",
        apiKey: "sk-ant-test",
      })
    ).rejects.toThrow("Empty response from Anthropic");
  });
});

describe("reviewDiff — malformed AI responses", () => {
  it("throws a parse error when the AI returns non-JSON text", async () => {
    mockFetchOnce(200, { message: { content: "not json at all" } });
    await expect(
      reviewDiff(DIFF, "staged changes", {
        model: "qwen3:latest",
        host: "http://localhost:11434",
        provider: "ollama",
      })
    ).rejects.toThrow(/Could not parse AI response/);
  });
});
