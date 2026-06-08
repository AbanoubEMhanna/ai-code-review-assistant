import { describe, expect, it } from "vitest";
import { buildUserPrompt } from "./prompts.js";

describe("buildUserPrompt", () => {
  it("returns a plain prompt with no focus", () => {
    const prompt = buildUserPrompt("diff content", "staged changes");
    expect(prompt).toBe("Review this git diff (staged changes):\n\ndiff content");
    expect(prompt).not.toContain("Focus");
  });

  it("includes a focus instruction when focus is provided", () => {
    const prompt = buildUserPrompt("diff content", "staged changes", "security");
    expect(prompt).toContain("Review this git diff (staged changes):\n\ndiff content");
    expect(prompt).toContain("security");
    expect(prompt).toContain("Focus");
  });

  it("mentions the focus category twice (instruction uses it twice)", () => {
    const prompt = buildUserPrompt("diff content", "staged changes", "performance");
    const occurrences = (prompt.match(/performance/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("appends focus after the diff, not before", () => {
    const prompt = buildUserPrompt("my diff", "branch review", "bug");
    const diffEnd = prompt.indexOf("my diff") + "my diff".length;
    const focusStart = prompt.indexOf("Focus");
    expect(focusStart).toBeGreaterThan(diffEnd);
  });

  it("handles all valid focus categories without error", () => {
    const categories = ["bug", "security", "performance", "maintainability", "style"] as const;
    for (const cat of categories) {
      expect(() => buildUserPrompt("diff", "source", cat)).not.toThrow();
      expect(buildUserPrompt("diff", "source", cat)).toContain(cat);
    }
  });

  it("preserves diffSource in the output", () => {
    const prompt = buildUserPrompt("diff", "file: src/auth.ts", "security");
    expect(prompt).toContain("file: src/auth.ts");
  });

  it("returns same base when focus is undefined", () => {
    const withUndefined = buildUserPrompt("diff", "staged changes", undefined);
    const withoutFocus = buildUserPrompt("diff", "staged changes");
    expect(withUndefined).toBe(withoutFocus);
  });
});
