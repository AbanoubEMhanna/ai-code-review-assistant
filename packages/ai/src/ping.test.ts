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
