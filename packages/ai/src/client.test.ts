import { describe, it, expect, vi, afterEach } from "vitest";
import { reviewDiff } from "./client.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const VALID_AI_RESPONSE = JSON.stringify({
  summary: "Looks fine.",
  comments: [],
});

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe("reviewDiff — ollama provider fallback", () => {
  it("uses the native /api/chat response when it succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { message: { content: VALID_AI_RESPONSE } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await reviewDiff("diff --git a b", "staged", {
      model: "qwen3:latest",
      host: "http://localhost:11434",
      provider: "ollama",
    });

    expect(result.summary).toBe("Looks fine.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/chat");
  });

  it("falls back to the OpenAI-compatible endpoint when /api/chat fails", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/chat")) {
        return Promise.resolve(jsonResponse(404, { error: "model not found" }));
      }
      return Promise.resolve(
        jsonResponse(200, { choices: [{ message: { content: VALID_AI_RESPONSE } }] })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await reviewDiff("diff --git a b", "staged", {
      model: "qwen3:latest",
      host: "http://localhost:11434",
      provider: "ollama",
    });

    expect(result.summary).toBe("Looks fine.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces the original /api/chat error when the fallback also fails", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/chat")) {
        return Promise.resolve(
          jsonResponse(404, 'model "qwen3:latest" not found, try pulling it first')
        );
      }
      return Promise.resolve(jsonResponse(500, "internal error"));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reviewDiff("diff --git a b", "staged", {
        model: "qwen3:latest",
        host: "http://localhost:11434",
        provider: "ollama",
      })
    ).rejects.toThrow(/Ollama request failed \(404\)/);
  });
});
