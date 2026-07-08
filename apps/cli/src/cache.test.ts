import { describe, expect, it } from "vitest";
import { computeDiffHash } from "./cache.js";

describe("computeDiffHash", () => {
  it("is deterministic for the same inputs", () => {
    const a = computeDiffHash("diff --git a/x.ts", "ollama", "qwen3:latest");
    const b = computeDiffHash("diff --git a/x.ts", "ollama", "qwen3:latest");
    expect(a).toBe(b);
  });

  it("changes when the diff content changes", () => {
    const a = computeDiffHash("diff A", "ollama", "qwen3:latest");
    const b = computeDiffHash("diff B", "ollama", "qwen3:latest");
    expect(a).not.toBe(b);
  });

  it("changes when the provider changes", () => {
    const a = computeDiffHash("diff A", "ollama", "qwen3:latest");
    const b = computeDiffHash("diff A", "anthropic", "qwen3:latest");
    expect(a).not.toBe(b);
  });

  it("changes when the model changes", () => {
    const a = computeDiffHash("diff A", "ollama", "qwen3:latest");
    const b = computeDiffHash("diff A", "ollama", "llama3:latest");
    expect(a).not.toBe(b);
  });

  it("returns a 64-character hex sha256 digest", () => {
    const hash = computeDiffHash("diff A", "ollama", "qwen3:latest");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
