import { describe, it, expect } from "vitest";
import { resolveMaxTokensOption, isPositiveInteger } from "./config.js";

describe("resolveMaxTokensOption", () => {
  it("stringifies maxTokens from the config file so it can seed the --max-tokens CLI default", () => {
    expect(resolveMaxTokensOption({ maxTokens: 8000 })).toBe("8000");
  });

  it("returns undefined when the config file has no maxTokens set", () => {
    expect(resolveMaxTokensOption({})).toBeUndefined();
  });

  it("stringifies an explicitly configured zero rather than treating it as unset", () => {
    // 0 is falsy but still a defined value — must not be coerced to undefined
    // by a `||`-based implementation. In practice this value never reaches here,
    // since readConfigFile() rejects non-positive maxTokens (see isPositiveInteger below).
    expect(resolveMaxTokensOption({ maxTokens: 0 })).toBe("0");
  });
});

describe("isPositiveInteger", () => {
  it("accepts positive integers", () => {
    expect(isPositiveInteger(8000)).toBe(true);
    expect(isPositiveInteger(1)).toBe(true);
  });

  it("rejects zero and negative numbers", () => {
    // maxTokens: 0 would otherwise become the --max-tokens CLI default while
    // makeOpts() rejects any value < 1, breaking every review invocation.
    expect(isPositiveInteger(0)).toBe(false);
    expect(isPositiveInteger(-1)).toBe(false);
  });

  it("rejects non-integers and non-numbers", () => {
    expect(isPositiveInteger(4.5)).toBe(false);
    expect(isPositiveInteger("8000")).toBe(false);
    expect(isPositiveInteger(undefined)).toBe(false);
  });
});
