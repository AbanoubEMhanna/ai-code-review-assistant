import { describe, it, expect } from "vitest";
import { estimateCostUsd } from "./pricing.js";

describe("estimateCostUsd", () => {
  it("returns undefined for local providers regardless of model", () => {
    expect(estimateCostUsd("ollama", "qwen3:latest", 1000, 500)).toBeUndefined();
    expect(estimateCostUsd("lmstudio", "claude-sonnet-4-6", 1000, 500)).toBeUndefined();
  });

  it("returns undefined for an unrecognized anthropic model", () => {
    expect(estimateCostUsd("anthropic", "some-future-model", 1000, 500)).toBeUndefined();
  });

  it("prices a known sonnet model using input/output rates per million tokens", () => {
    const cost = estimateCostUsd("anthropic", "claude-sonnet-4-6", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(3 + 15, 5);
  });

  it("prices a known haiku model cheaper than sonnet for the same usage", () => {
    const sonnet = estimateCostUsd("anthropic", "claude-sonnet-4-6", 100_000, 100_000);
    const haiku = estimateCostUsd("anthropic", "claude-haiku-4-5", 100_000, 100_000);
    expect(haiku).toBeLessThan(sonnet as number);
  });

  it("prices a known opus model more expensive than sonnet for the same usage", () => {
    const sonnet = estimateCostUsd("anthropic", "claude-sonnet-4-6", 100_000, 100_000);
    const opus = estimateCostUsd("anthropic", "claude-opus-4-1", 100_000, 100_000);
    expect(opus).toBeGreaterThan(sonnet as number);
  });

  it("returns 0 for zero usage on a known model", () => {
    expect(estimateCostUsd("anthropic", "claude-sonnet-4-6", 0, 0)).toBe(0);
  });
});
