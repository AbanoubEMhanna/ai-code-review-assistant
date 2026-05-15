import { describe, it, expect } from "vitest";
import { parseReview } from "./parser.js";

describe("parseReview", () => {
  it("parses a valid JSON response", () => {
    const raw = JSON.stringify({
      summary: "Looks good overall.",
      comments: [
        {
          file: "src/index.ts",
          line: 10,
          severity: "high",
          category: "bug",
          message: "Null pointer risk",
          suggestion: "Add a null check",
        },
      ],
    });
    const result = parseReview(raw);
    expect(result.summary).toBe("Looks good overall.");
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]?.severity).toBe("high");
  });

  it("strips ``` json markdown fences", () => {
    const raw = '```json\n{"summary":"ok","comments":[]}\n```';
    const result = parseReview(raw);
    expect(result.summary).toBe("ok");
    expect(result.comments).toHaveLength(0);
  });

  it("strips plain ``` fences", () => {
    const raw = '```\n{"summary":"plain","comments":[]}\n```';
    const result = parseReview(raw);
    expect(result.summary).toBe("plain");
  });

  it("handles an empty comments array", () => {
    const raw = JSON.stringify({ summary: "No issues.", comments: [] });
    const result = parseReview(raw);
    expect(result.comments).toHaveLength(0);
  });

  it("throws on non-JSON input", () => {
    expect(() => parseReview("not json at all")).toThrow("Could not parse AI response as JSON");
  });

  it("throws when summary is missing", () => {
    expect(() => parseReview(JSON.stringify({ comments: [] }))).toThrow(
      "missing or non-string summary"
    );
  });

  it("throws when comments is not an array", () => {
    expect(() => parseReview(JSON.stringify({ summary: "ok", comments: "nope" }))).toThrow(
      "comments must be an array"
    );
  });

  it("throws on a non-object response", () => {
    expect(() => parseReview(JSON.stringify(null))).toThrow("expected object");
  });
});
