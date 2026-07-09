import { describe, it, expect } from "vitest";
import { limitReportIssues } from "./max-issues.js";
import type { ReviewComment, ReviewReport } from "@ai-review/shared";

function makeReport(overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    generatedAt: "2024-01-01T00:00:00.000Z",
    model: "test-model",
    diffSource: "staged changes",
    summary: "Test summary",
    comments: [],
    stats: { high: 0, medium: 0, low: 0, info: 0, total: 0 },
    ...overrides,
  };
}

function makeComment(severity: ReviewComment["severity"], file = "src/foo.ts"): ReviewComment {
  return { file, severity, category: "bug", message: `A ${severity} issue` };
}

describe("limitReportIssues", () => {
  it("returns report unchanged when comments < maxIssues", () => {
    const report = makeReport({
      comments: [makeComment("high"), makeComment("low")],
      stats: { high: 1, medium: 0, low: 1, info: 0, total: 2 },
    });
    const { report: r, hiddenCount } = limitReportIssues(report, 5);
    expect(r).toBe(report);
    expect(hiddenCount).toBe(0);
  });

  it("returns report unchanged when comments equals maxIssues", () => {
    const report = makeReport({
      comments: [makeComment("high"), makeComment("medium")],
      stats: { high: 1, medium: 1, low: 0, info: 0, total: 2 },
    });
    const { report: r, hiddenCount } = limitReportIssues(report, 2);
    expect(r).toBe(report);
    expect(hiddenCount).toBe(0);
  });

  it("keeps top N by severity and returns correct hiddenCount", () => {
    const report = makeReport({
      comments: [
        makeComment("info"),
        makeComment("low"),
        makeComment("medium"),
        makeComment("high"),
        makeComment("info"),
      ],
      stats: { high: 1, medium: 1, low: 1, info: 2, total: 5 },
    });
    const { report: r, hiddenCount } = limitReportIssues(report, 3);
    expect(r.comments).toHaveLength(3);
    expect(hiddenCount).toBe(2);
    expect(r.comments[0]?.severity).toBe("high");
    expect(r.comments[1]?.severity).toBe("medium");
    expect(r.comments[2]?.severity).toBe("low");
  });

  it("recomputes stats correctly after limiting", () => {
    const report = makeReport({
      comments: [
        makeComment("high"),
        makeComment("high"),
        makeComment("medium"),
        makeComment("low"),
        makeComment("info"),
      ],
      stats: { high: 2, medium: 1, low: 1, info: 1, total: 5 },
    });
    const { report: r } = limitReportIssues(report, 3);
    expect(r.stats).toEqual({ high: 2, medium: 1, low: 0, info: 0, total: 3 });
  });

  it("preserves all other report fields unchanged", () => {
    const report = makeReport({
      summary: "my summary",
      model: "my-model",
      diffSource: "my-source",
      generatedAt: "2024-06-01T00:00:00.000Z",
      comments: [makeComment("high"), makeComment("medium"), makeComment("low")],
      stats: { high: 1, medium: 1, low: 1, info: 0, total: 3 },
    });
    const { report: r } = limitReportIssues(report, 1);
    expect(r.summary).toBe("my summary");
    expect(r.model).toBe("my-model");
    expect(r.diffSource).toBe("my-source");
    expect(r.generatedAt).toBe("2024-06-01T00:00:00.000Z");
  });

  it("does not mutate the original report or its comments array", () => {
    const comments = [makeComment("high"), makeComment("medium"), makeComment("low")];
    const report = makeReport({
      comments,
      stats: { high: 1, medium: 1, low: 1, info: 0, total: 3 },
    });
    limitReportIssues(report, 1);
    expect(report.comments).toHaveLength(3);
    expect(report.comments).toBe(comments);
  });

  it("returns hiddenCount 0 when maxIssues equals 0", () => {
    const report = makeReport({
      comments: [makeComment("high"), makeComment("medium")],
      stats: { high: 1, medium: 1, low: 0, info: 0, total: 2 },
    });
    const { report: r, hiddenCount } = limitReportIssues(report, 0);
    expect(r).toBe(report);
    expect(hiddenCount).toBe(0);
  });

  it("handles an empty comments array without error", () => {
    const report = makeReport();
    const { report: r, hiddenCount } = limitReportIssues(report, 5);
    expect(r.comments).toHaveLength(0);
    expect(hiddenCount).toBe(0);
  });

  it("applies a maxIssues of 1 correctly", () => {
    const report = makeReport({
      comments: [makeComment("info"), makeComment("medium"), makeComment("high")],
      stats: { high: 1, medium: 1, low: 0, info: 1, total: 3 },
    });
    const { report: r, hiddenCount } = limitReportIssues(report, 1);
    expect(r.comments).toHaveLength(1);
    expect(r.comments[0]?.severity).toBe("high");
    expect(hiddenCount).toBe(2);
    expect(r.stats.total).toBe(1);
  });
});
