import { describe, it, expect } from "vitest";
import { resolveMaxTokensOption } from "./config.js";

describe("resolveMaxTokensOption", () => {
  it("stringifies maxTokens from the config file so it can seed the --max-tokens CLI default", () => {
    expect(resolveMaxTokensOption({ maxTokens: 8000 })).toBe("8000");
  });

  it("returns undefined when the config file has no maxTokens set", () => {
    expect(resolveMaxTokensOption({})).toBeUndefined();
  });

  it("returns undefined when maxTokens is explicitly 0", () => {
    // 0 is falsy but still a defined value — must not be treated as "unset".
    expect(resolveMaxTokensOption({ maxTokens: 0 })).toBe("0");
  });
});
