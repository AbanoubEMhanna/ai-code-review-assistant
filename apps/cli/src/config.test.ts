import { describe, it, expect } from "vitest";
import { parseMaxTokensEnv } from "./config.js";

describe("parseMaxTokensEnv()", () => {
  it("returns undefined for undefined input", () => {
    expect(parseMaxTokensEnv(undefined)).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(parseMaxTokensEnv("")).toBeUndefined();
  });

  it("returns undefined for a whitespace-only string", () => {
    expect(parseMaxTokensEnv("   ")).toBeUndefined();
  });

  it("parses a valid positive integer string", () => {
    expect(parseMaxTokensEnv("4096")).toBe(4096);
  });

  it("parses '1' as the minimum valid value", () => {
    expect(parseMaxTokensEnv("1")).toBe(1);
  });

  it("parses large values correctly", () => {
    expect(parseMaxTokensEnv("100000")).toBe(100000);
  });

  it("returns undefined for '0' (not a positive integer)", () => {
    expect(parseMaxTokensEnv("0")).toBeUndefined();
  });

  it("returns undefined for non-numeric strings", () => {
    expect(parseMaxTokensEnv("abc")).toBeUndefined();
    expect(parseMaxTokensEnv("four thousand")).toBeUndefined();
  });

  it("returns undefined for strings with numeric prefix and trailing garbage", () => {
    // parseInt would silently accept these, but we require purely numeric input
    expect(parseMaxTokensEnv("100foo")).toBeUndefined();
    expect(parseMaxTokensEnv("4096abc")).toBeUndefined();
  });

  it("returns undefined for negative values", () => {
    expect(parseMaxTokensEnv("-1")).toBeUndefined();
    expect(parseMaxTokensEnv("-100")).toBeUndefined();
  });

  it("returns undefined for float strings", () => {
    expect(parseMaxTokensEnv("4096.5")).toBeUndefined();
  });

  it("handles leading/trailing whitespace around valid integers", () => {
    expect(parseMaxTokensEnv("  4096  ")).toBe(4096);
  });
});
