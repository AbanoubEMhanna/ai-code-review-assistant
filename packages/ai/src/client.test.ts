import { describe, it, expect, vi, afterEach } from "vitest";
import { reviewDiff } from "./client.js";

const VALID_RESPONSE = JSON.stringify({
  summary: "Looks good.",
  comments: [],
});

function abortError(): DOMException {
  return new DOMException("This operation was aborted", "AbortError");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reviewDiff — request timeouts", () => {
  it("surfaces a friendly timeout message for ollama instead of the raw AbortError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError()));

    await expect(
      reviewDiff("diff --git a/x b/x", "staged changes", {
        model: "qwen3:latest",
        host: "http://localhost:11434",
        provider: "ollama",
      })
    ).rejects.toThrow(/timed out after \d+ms/);
  });

  it("surfaces a friendly timeout message for lmstudio", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError()));

    await expect(
      reviewDiff("diff --git a/x b/x", "staged changes", {
        model: "mistral-7b",
        host: "http://localhost:1234",
        provider: "lmstudio",
      })
    ).rejects.toThrow(/timed out after \d+ms/);
  });

  it("surfaces a friendly timeout message for anthropic", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError()));

    await expect(
      reviewDiff("diff --git a/x b/x", "staged changes", {
        model: "claude-sonnet-4-6",
        host: "http://localhost:11434",
        provider: "anthropic",
        apiKey: "sk-test",
      })
    ).rejects.toThrow(/timed out after \d+ms/);
  });

  it("includes the target host in the timeout message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError()));

    await expect(
      reviewDiff("diff --git a/x b/x", "staged changes", {
        model: "qwen3:latest",
        host: "http://localhost:11434",
        provider: "ollama",
      })
    ).rejects.toThrow(/localhost:11434/);
  });

  it("does not rewrite non-abort fetch errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(
      reviewDiff("diff --git a/x b/x", "staged changes", {
        model: "qwen3:latest",
        host: "http://localhost:11434",
        provider: "ollama",
      })
    ).rejects.toThrow("ECONNREFUSED");
  });

  it("still succeeds normally when the request resolves before the timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: { content: VALID_RESPONSE } }),
      })
    );

    const result = await reviewDiff("diff --git a/x b/x", "staged changes", {
      model: "qwen3:latest",
      host: "http://localhost:11434",
      provider: "ollama",
    });

    expect(result.summary).toBe("Looks good.");
  });
});
