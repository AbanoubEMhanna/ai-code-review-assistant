import { describe, it, expect, vi, afterEach } from "vitest";
import { reviewDiff } from "./client.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockOllamaChat(diffSeenByMock: { value: string }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as {
        messages: Array<{ content: string }>;
      };
      diffSeenByMock.value = body.messages[1]?.content ?? "";
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            message: { content: JSON.stringify({ summary: "ok", comments: [] }) },
          }),
      });
    })
  );
}

describe("reviewDiff — secret redaction", () => {
  it("redacts a secret from the diff before it reaches the provider, and reports it", async () => {
    const seen = { value: "" };
    mockOllamaChat(seen);

    const key = "AKIAABCDEFGHIJKLMNOP";
    const result = await reviewDiff(`+const key = '${key}';`, "staged changes", {
      model: "qwen3:latest",
      host: "http://localhost:11434",
      provider: "ollama",
    });

    expect(seen.value).not.toContain(key);
    expect(seen.value).toContain("[REDACTED:aws-access-key-id]");
    expect(result.redactedSecretTypes).toEqual(["aws-access-key-id"]);
  });

  it("skips redaction when redactSecrets is explicitly false", async () => {
    const seen = { value: "" };
    mockOllamaChat(seen);

    const key = "AKIAABCDEFGHIJKLMNOP";
    const result = await reviewDiff(`+const key = '${key}';`, "staged changes", {
      model: "qwen3:latest",
      host: "http://localhost:11434",
      provider: "ollama",
      redactSecrets: false,
    });

    expect(seen.value).toContain(key);
    expect(result.redactedSecretTypes).toEqual([]);
  });

  it("returns an empty redactedSecretTypes array for an empty diff", async () => {
    const result = await reviewDiff("   ", "staged changes", {
      model: "qwen3:latest",
      host: "http://localhost:11434",
      provider: "ollama",
    });
    expect(result.redactedSecretTypes).toEqual([]);
    expect(result.summary).toBe("No changes to review.");
  });
});
