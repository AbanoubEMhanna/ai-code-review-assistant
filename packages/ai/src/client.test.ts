import { describe, it, expect, vi, afterEach } from "vitest";
import { reviewDiff } from "./client.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const VALID_RESPONSE = JSON.stringify({ summary: "Looks good.", comments: [] });

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("reviewDiff — empty diff", () => {
  it("short-circuits without calling the provider", async () => {
    const fetchMock = mockFetch(200, {});
    const result = await reviewDiff("   ", "staged changes", {
      model: "gpt-4o-mini",
      host: "http://localhost:11434",
      provider: "openai",
      apiKey: "sk-test",
    });
    expect(result.summary).toBe("No changes to review.");
    expect(result.comments).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("reviewDiff — openai provider", () => {
  it("throws a clear error when no API key is configured", async () => {
    await expect(
      reviewDiff("diff --git a/a.ts b/a.ts", "staged changes", {
        model: "gpt-4o-mini",
        host: "http://localhost:11434",
        provider: "openai",
      })
    ).rejects.toThrow("OpenAI provider requires an API key");
  });

  it("posts to the OpenAI chat completions endpoint with a bearer token", async () => {
    const fetchMock = mockFetch(200, {
      choices: [{ message: { content: VALID_RESPONSE } }],
    });

    const result = await reviewDiff("diff --git a/a.ts b/a.ts", "staged changes", {
      model: "gpt-4o-mini",
      host: "http://localhost:11434",
      provider: "openai",
      apiKey: "sk-test",
    });

    expect(result.summary).toBe("Looks good.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer sk-test");
    const body = JSON.parse(init.body as string) as { model: string; max_tokens: number };
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.max_tokens).toBe(4096);
  });

  it("surfaces the OpenAI error body on a non-2xx response", async () => {
    mockFetch(401, "invalid api key");
    await expect(
      reviewDiff("diff --git a/a.ts b/a.ts", "staged changes", {
        model: "gpt-4o-mini",
        host: "http://localhost:11434",
        provider: "openai",
        apiKey: "sk-bad",
      })
    ).rejects.toThrow("OpenAI API request failed (401): invalid api key");
  });

  it("throws when the response has no message content", async () => {
    mockFetch(200, { choices: [{ message: { content: "" } }] });
    await expect(
      reviewDiff("diff --git a/a.ts b/a.ts", "staged changes", {
        model: "gpt-4o-mini",
        host: "http://localhost:11434",
        provider: "openai",
        apiKey: "sk-test",
      })
    ).rejects.toThrow("Empty response from OpenAI");
  });
});
