import { describe, expect, it } from "vitest";
import { resolveProvider } from "./config.js";

describe("resolveProvider()", () => {
  it("defaults to ollama when nothing is configured", () => {
    expect(resolveProvider({})).toEqual({ provider: "ollama", autoDetected: false });
  });

  it("uses envProvider over everything else", () => {
    expect(
      resolveProvider({
        envProvider: "lmstudio",
        fileProvider: "ollama",
        anthropicApiKey: "sk-ant-xxx",
      })
    ).toEqual({ provider: "lmstudio", autoDetected: false });
  });

  it("uses fileProvider when envProvider is absent", () => {
    expect(resolveProvider({ fileProvider: "lmstudio" })).toEqual({
      provider: "lmstudio",
      autoDetected: false,
    });
  });

  it("envProvider takes precedence over fileProvider", () => {
    expect(resolveProvider({ envProvider: "anthropic", fileProvider: "ollama" })).toEqual({
      provider: "anthropic",
      autoDetected: false,
    });
  });

  it("auto-detects anthropic when ANTHROPIC_API_KEY is set and no explicit provider", () => {
    expect(resolveProvider({ anthropicApiKey: "sk-ant-xxx" })).toEqual({
      provider: "anthropic",
      autoDetected: true,
    });
  });

  it("explicit envProvider wins over ANTHROPIC_API_KEY auto-detect", () => {
    expect(resolveProvider({ envProvider: "ollama", anthropicApiKey: "sk-ant-xxx" })).toEqual({
      provider: "ollama",
      autoDetected: false,
    });
  });

  it("explicit fileProvider wins over ANTHROPIC_API_KEY auto-detect", () => {
    expect(resolveProvider({ fileProvider: "lmstudio", anthropicApiKey: "sk-ant-xxx" })).toEqual({
      provider: "lmstudio",
      autoDetected: false,
    });
  });

  it("accepts all valid provider strings", () => {
    expect(resolveProvider({ envProvider: "ollama" }).provider).toBe("ollama");
    expect(resolveProvider({ envProvider: "lmstudio" }).provider).toBe("lmstudio");
    expect(resolveProvider({ envProvider: "anthropic" }).provider).toBe("anthropic");
  });

  it("trims and lowercases provider strings", () => {
    expect(resolveProvider({ envProvider: "  Anthropic  " })).toEqual({
      provider: "anthropic",
      autoDetected: false,
    });
  });

  it("treats unknown provider string as not-explicit, falls through to auto-detect", () => {
    expect(
      resolveProvider({ envProvider: "unknown-provider", anthropicApiKey: "sk-ant-xxx" })
    ).toEqual({
      provider: "anthropic",
      autoDetected: true,
    });
  });

  it("invalid envProvider falls back to valid fileProvider instead of ignoring it", () => {
    expect(resolveProvider({ envProvider: "garbage", fileProvider: "anthropic" })).toEqual({
      provider: "anthropic",
      autoDetected: false,
    });
  });

  it("invalid envProvider falls back to fileProvider before auto-detect", () => {
    expect(
      resolveProvider({
        envProvider: "bad-value",
        fileProvider: "lmstudio",
        anthropicApiKey: "sk-ant-xxx",
      })
    ).toEqual({
      provider: "lmstudio",
      autoDetected: false,
    });
  });
});
