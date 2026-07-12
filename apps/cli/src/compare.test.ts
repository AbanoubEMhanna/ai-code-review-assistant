import { describe, expect, it } from "vitest";
import type { ReviewComment } from "@ai-review/shared";
import type { StoredReview } from "./history-store.js";
import { compareReviews } from "./compare.js";

function makeComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    file: "src/app.ts",
    severity: "low",
    category: "maintainability",
    message: "default message",
    ...overrides,
  };
}

function makeReview(id: string, comments: ReviewComment[] = []): StoredReview {
  const stats = {
    high: comments.filter((c) => c.severity === "high").length,
    medium: comments.filter((c) => c.severity === "medium").length,
    low: comments.filter((c) => c.severity === "low").length,
    info: comments.filter((c) => c.severity === "info").length,
    total: comments.length,
  };
  return {
    id,
    generatedAt: new Date().toISOString(),
    model: "test-model",
    diffSource: "staged changes",
    summary: "summary",
    comments,
    stats,
  };
}

describe("compareReviews", () => {
  it("returns zero delta when both reviews have no comments", () => {
    const result = compareReviews(makeReview("a"), makeReview("b"));
    expect(result.delta).toEqual({ high: 0, medium: 0, low: 0, info: 0, total: 0 });
    expect(result.resolved).toHaveLength(0);
    expect(result.added).toHaveLength(0);
  });

  it("counts positive delta when B has more issues than A", () => {
    const a = makeReview("a", [makeComment({ severity: "high", message: "bug" })]);
    const b = makeReview("b", [
      makeComment({ severity: "high", message: "bug" }),
      makeComment({ severity: "high", message: "another bug" }),
    ]);
    const result = compareReviews(a, b);
    expect(result.delta.high).toBe(1);
    expect(result.delta.total).toBe(1);
  });

  it("counts negative delta when B has fewer issues than A", () => {
    const a = makeReview("a", [
      makeComment({ severity: "medium", message: "m1" }),
      makeComment({ severity: "medium", message: "m2" }),
    ]);
    const b = makeReview("b", [makeComment({ severity: "medium", message: "m1" })]);
    const result = compareReviews(a, b);
    expect(result.delta.medium).toBe(-1);
    expect(result.delta.total).toBe(-1);
  });

  it("identifies resolved issues (in A but not B)", () => {
    const fixed = makeComment({ file: "src/a.ts", message: "fixed bug" });
    const kept = makeComment({ file: "src/b.ts", message: "still here" });
    const a = makeReview("a", [fixed, kept]);
    const b = makeReview("b", [kept]);
    const result = compareReviews(a, b);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0]?.message).toBe("fixed bug");
    expect(result.added).toHaveLength(0);
  });

  it("identifies added issues (in B but not A)", () => {
    const existing = makeComment({ file: "src/a.ts", message: "existing" });
    const newIssue = makeComment({ file: "src/b.ts", message: "new regression" });
    const a = makeReview("a", [existing]);
    const b = makeReview("b", [existing, newIssue]);
    const result = compareReviews(a, b);
    expect(result.added).toHaveLength(1);
    expect(result.added[0]?.message).toBe("new regression");
    expect(result.resolved).toHaveLength(0);
  });

  it("distinguishes comments by file — same message on different files is two separate issues", () => {
    const inA = makeComment({ file: "src/a.ts", message: "unused import" });
    const inB = makeComment({ file: "src/b.ts", message: "unused import" });
    const a = makeReview("a", [inA]);
    const b = makeReview("b", [inB]);
    const result = compareReviews(a, b);
    expect(result.resolved).toHaveLength(1);
    expect(result.added).toHaveLength(1);
  });

  it("treats same file+message as the same issue even if other fields differ", () => {
    const c1 = makeComment({ file: "src/x.ts", message: "duplicate code", severity: "low" });
    const c2 = makeComment({ file: "src/x.ts", message: "duplicate code", severity: "medium" });
    const a = makeReview("a", [c1]);
    const b = makeReview("b", [c2]);
    const result = compareReviews(a, b);
    expect(result.resolved).toHaveLength(0);
    expect(result.added).toHaveLength(0);
  });

  it("includes review metadata in output", () => {
    const a = makeReview("id-a", []);
    const b = makeReview("id-b", []);
    const result = compareReviews(a, b);
    expect(result.a.id).toBe("id-a");
    expect(result.b.id).toBe("id-b");
  });

  it("computes delta correctly across all severity levels", () => {
    const a = makeReview("a", [
      makeComment({ severity: "high", message: "h1" }),
      makeComment({ severity: "medium", message: "m1" }),
      makeComment({ severity: "medium", message: "m2" }),
      makeComment({ severity: "low", message: "l1" }),
      makeComment({ severity: "info", message: "i1" }),
    ]);
    const b = makeReview("b", [
      makeComment({ severity: "medium", message: "m1" }),
      makeComment({ severity: "low", message: "l1" }),
      makeComment({ severity: "low", message: "l2" }),
      makeComment({ severity: "info", message: "i1" }),
      makeComment({ severity: "info", message: "i2" }),
    ]);
    const result = compareReviews(a, b);
    expect(result.delta).toEqual({ high: -1, medium: -1, low: 1, info: 1, total: 0 });
  });
});
