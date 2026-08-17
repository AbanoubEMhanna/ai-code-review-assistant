import { describe, it, expect, vi, afterEach } from "vitest";
import { pingProvider } from "./ping.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    })
  );
}

function mockFetchError(message: string) {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(message)));
}

describe("pingProvider — ollama", () => {
  it("returns ok=true and modelFound=true when model is listed", async () => {
    mockFetch(200, { models: [{ name: "qwen3:latest" }, { name: "llama3:8b" }] });
    const result = await pingProvider({
      provider: "ollama",
      host: "http://localhost:11434",
      model: "qwen3:latest",
    });
    expect(result.ok).toBe(true);
    expect(result.modelFound).toBe(true);
    expect(result.availableModels).toContain("qwen3:latest");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns ok=true and modelFound=false when model is absent", async () => {
    mockFetch(200, { models: [{ name: "llama3:8b" }] });
    const result = await pingProvider({
      provider: "ollama",
      host: "http://localhost:11434",
      model: "qwen3:latest",
    });
    expect(result.ok).toBe(true);
    expect(result.modelFound).toBe(false);
    expect(result.availableModels).toEqual(["llama3:8b"]);
  });

  it("matches a model by name prefix (e.g. qwen3 matches qwen3:latest)", async () => {
    mockFetch(200, { models: [{ name: "qwen3:latest" }] });
    const result = await pingProvider({
      provider: "ollama",
      host: "http://localhost:11434",
      model: "qwen3",
    });
    expect(result.modelFound).toBe(true);
  });

  it("returns ok=false on network error", async () => {
    mockFetchError("ECONNREFUSED");
    const result = await pingProvider({
      provider: "ollama",
      host: "http://localhost:11434",
      model: "qwen3:latest",
    });
    expect(result.ok).toBe(false);
    expect(result.modelFound).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
    expect(result.availableModels).toEqual([]);
  });

  it("handles empty models list gracefully", async () => {
    mockFetch(200, { models: [] });
    const result = await pingProvider({
      provider: "ollama",
      host: "http://localhost:11434",
      model: "qwen3:latest",
    });
    expect(result.ok).toBe(true);
    expect(result.modelFound).toBe(false);
    expect(result.availableModels).toEqual([]);
  });

  it("handles missing models key gracefully", async () => {
    mockFetch(200, {});
    const result = await pingProvider({
      provider: "ollama",
      host: "http://localhost:11434",
      model: "qwen3:latest",
    });
    expect(result.ok).toBe(true);
    expect(result.availableModels).toEqual([]);
  });

  it("returns ok=false on non-200 HTTP response", async () => {
    mockFetch(503, {});
    const result = await pingProvider({
      provider: "ollama",
      host: "http://localhost:11434",
      model: "qwen3:latest",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/HTTP 503/);
  });
});

describe("pingProvider — anthropic", () => {
  it("returns ok=false with a clear error when no API key is provided", async () => {
    const result = await pingProvider({
      provider: "anthropic",
      host: "https://api.anthropic.com",
      model: "claude-sonnet-4",
    });
    expect(result.ok).toBe(false);
    expect(result.modelFound).toBe(false);
    expect(result.error).toMatch(/API key required/);
  });

  it("requests the full model page (limit=1000) instead of the API's default 20", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [{ id: "claude-sonnet-4" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await pingProvider({
      provider: "anthropic",
      host: "https://api.anthropic.com",
      model: "claude-sonnet-4",
      apiKey: "sk-test",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/models?limit=1000",
      expect.anything()
    );
  });

  it("finds a model beyond the API's default 20-item page (regression for missing pagination)", async () => {
    // Anthropic's catalog has 20+ model IDs; without requesting the full page,
    // a model beyond the default page size would be missed.
    const models = Array.from({ length: 25 }, (_, i) => ({ id: `claude-model-${i}` }));
    mockFetch(200, { data: models });
    const result = await pingProvider({
      provider: "anthropic",
      host: "https://api.anthropic.com",
      model: "claude-model-24",
      apiKey: "sk-test",
    });
    expect(result.ok).toBe(true);
    expect(result.modelFound).toBe(true);
    expect(result.availableModels).toHaveLength(25);
  });

  it("matches a model by name prefix (e.g. claude-sonnet-4 matches claude-sonnet-4-20250514)", async () => {
    mockFetch(200, { data: [{ id: "claude-sonnet-4-20250514" }] });
    const result = await pingProvider({
      provider: "anthropic",
      host: "https://api.anthropic.com",
      model: "claude-sonnet-4",
      apiKey: "sk-test",
    });
    expect(result.modelFound).toBe(true);
  });

  it("returns ok=false with the API error body on a non-200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("invalid x-api-key"),
      })
    );
    const result = await pingProvider({
      provider: "anthropic",
      host: "https://api.anthropic.com",
      model: "claude-sonnet-4",
      apiKey: "bad-key",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Anthropic API error \(401\)/);
    expect(result.error).toContain("invalid x-api-key");
    expect(result.availableModels).toEqual([]);
  });

  it("returns ok=false on network error", async () => {
    mockFetchError("ECONNREFUSED");
    const result = await pingProvider({
      provider: "anthropic",
      host: "https://api.anthropic.com",
      model: "claude-sonnet-4",
      apiKey: "sk-test",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });
});

describe("pingProvider — lmstudio", () => {
  it("returns ok=true and modelFound=true when model is listed", async () => {
    mockFetch(200, { data: [{ id: "mistral-7b" }, { id: "llama3-8b" }] });
    const result = await pingProvider({
      provider: "lmstudio",
      host: "http://localhost:1234",
      model: "mistral-7b",
    });
    expect(result.ok).toBe(true);
    expect(result.modelFound).toBe(true);
  });

  it("returns ok=true and modelFound=false when model is absent", async () => {
    mockFetch(200, { data: [{ id: "llama3-8b" }] });
    const result = await pingProvider({
      provider: "lmstudio",
      host: "http://localhost:1234",
      model: "mistral-7b",
    });
    expect(result.ok).toBe(true);
    expect(result.modelFound).toBe(false);
  });

  it("handles missing data key gracefully", async () => {
    mockFetch(200, {});
    const result = await pingProvider({
      provider: "lmstudio",
      host: "http://localhost:1234",
      model: "mistral-7b",
    });
    expect(result.ok).toBe(true);
    expect(result.availableModels).toEqual([]);
  });

  it("returns ok=false on network error", async () => {
    mockFetchError("ECONNREFUSED");
    const result = await pingProvider({
      provider: "lmstudio",
      host: "http://localhost:1234",
      model: "mistral-7b",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });
});
