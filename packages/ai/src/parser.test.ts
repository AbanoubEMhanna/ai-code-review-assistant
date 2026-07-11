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

  it("throws when a comment entry is not an object", () => {
    expect(() => parseReview(JSON.stringify({ summary: "ok", comments: ["bad"] }))).toThrow(
      "comments[0] must be an object"
    );
  });

  it("throws when a comment is missing file", () => {
    expect(() =>
      parseReview(
        JSON.stringify({
          summary: "ok",
          comments: [{ message: "m", severity: "low", category: "style" }],
        })
      )
    ).toThrow("comments[0].file must be a non-empty string");
  });

  it("throws when a comment has empty file", () => {
    expect(() =>
      parseReview(
        JSON.stringify({
          summary: "ok",
          comments: [{ file: "  ", message: "m", severity: "low", category: "style" }],
        })
      )
    ).toThrow("comments[0].file must be a non-empty string");
  });

  it("throws when a comment is missing message", () => {
    expect(() =>
      parseReview(
        JSON.stringify({
          summary: "ok",
          comments: [{ file: "src/a.ts", severity: "low", category: "style" }],
        })
      )
    ).toThrow("comments[0].message must be a string");
  });

  it("throws when a comment has a non-integer line", () => {
    expect(() =>
      parseReview(
        JSON.stringify({
          summary: "ok",
          comments: [
            { file: "src/a.ts", message: "m", severity: "low", category: "style", line: 1.5 },
          ],
        })
      )
    ).toThrow("comments[0].line must be an integer or null");
  });

  it("throws when a comment has a non-string suggestion", () => {
    expect(() =>
      parseReview(
        JSON.stringify({
          summary: "ok",
          comments: [
            {
              file: "src/a.ts",
              message: "m",
              severity: "low",
              category: "style",
              suggestion: 42,
            },
          ],
        })
      )
    ).toThrow("comments[0].suggestion must be a string or null");
  });

  it("strips a <think>...</think> reasoning trace before parsing", () => {
    const raw =
      "<think>\nLet me review this diff... looks like a null check is missing.\n</think>\n" +
      '{"summary":"ok","comments":[]}';
    const result = parseReview(raw);
    expect(result.summary).toBe("ok");
  });

  it("strips a <think> trace that itself contains braces", () => {
    const raw =
      "<think>Should I flag `{ foo: 1 }` as a style nit? Probably not.</think>" +
      '{"summary":"clean","comments":[]}';
    const result = parseReview(raw);
    expect(result.summary).toBe("clean");
  });

  it("extracts a JSON object surrounded by unfenced preamble/postamble text", () => {
    const raw =
      'Sure, here is the review:\n{"summary":"extracted","comments":[]}\nLet me know if you need anything else!';
    const result = parseReview(raw);
    expect(result.summary).toBe("extracted");
  });

  it("extracts JSON with braces inside string values correctly", () => {
    const raw =
      'noise before {"summary":"has braces","comments":[{"file":"a.ts","message":"uses `{}` syntax","severity":"low","category":"style"}]} noise after';
    const result = parseReview(raw);
    expect(result.summary).toBe("has braces");
    expect(result.comments[0]?.message).toBe("uses `{}` syntax");
  });

  it("preserves literal <think> tags inside JSON string values", () => {
    const raw = JSON.stringify({
      summary: "ok",
      comments: [
        {
          file: "a.ts",
          message: "documents <think>literal</think> tags",
          severity: "low",
          category: "style",
        },
      ],
    });
    const result = parseReview(raw);
    expect(result.comments[0]?.message).toBe("documents <think>literal</think> tags");
  });

  it("does not include the raw response in parse errors", () => {
    const secret = "SUPER_SECRET_TOKEN=abc123";
    const err = (() => {
      try {
        parseReview(`not json containing ${secret}`);
      } catch (e) {
        return e as Error;
      }
    })();
    expect(err?.message).not.toContain(secret);
    expect(err?.message).toContain("raw length:");
  });
});
