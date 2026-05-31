import { describe, it, expect } from "vitest";
import type { ReviewComment, ReviewReport } from "@ai-review/shared";
import { filterReportBySeverity } from "./severity-filter.js";

function makeComment(severity: ReviewComment["severity"]): ReviewComment {
  return {
    file: "src/index.ts",
    severity,
    category: "bug",
    message: `A ${severity} issue`,
  };
}

function makeReport(comments: ReviewComment[]): ReviewReport {
  return {
    generatedAt: new Date().toISOString(),
    model: "test-model",
    diffSource: "staged changes",
    summary: "Test review.",
    comments,
    stats: {
      high: comments.filter((c) => c.severity === "high").length,
      medium: comments.filter((c) => c.severity === "medium").length,
      low: comments.filter((c) => c.severity === "low").length,
      info: comments.filter((c) => c.severity === "info").length,
      total: comments.length,
    },
  };
}

describe("filterReportBySeverity", () => {
  it("returns all comments unchanged when minSeverity is 'info'", () => {
    const report = makeReport([makeComment("info"), makeComment("low"), makeComment("high")]);
    const { filtered, hiddenCount } = filterReportBySeverity(report, "info");
    expect(filtered.comments).toHaveLength(3);
    expect(hiddenCount).toBe(0);
  });

  it("hides info comments when minSeverity is 'low'", () => {
    const report = makeReport([makeComment("info"), makeComment("low"), makeComment("medium")]);
    const { filtered, hiddenCount } = filterReportBySeverity(report, "low");
    expect(filtered.comments).toHaveLength(2);
    expect(filtered.comments.every((c) => c.severity !== "info")).toBe(true);
    expect(hiddenCount).toBe(1);
  });

  it("hides info and low when minSeverity is 'medium'", () => {
    const report = makeReport([
      makeComment("info"),
      makeComment("low"),
      makeComment("medium"),
      makeComment("high"),
    ]);
    const { filtered, hiddenCount } = filterReportBySeverity(report, "medium");
    expect(filtered.comments).toHaveLength(2);
    expect(hiddenCount).toBe(2);
  });

  it("only shows high when minSeverity is 'high'", () => {
    const report = makeReport([
      makeComment("info"),
      makeComment("low"),
      makeComment("medium"),
      makeComment("high"),
      makeComment("high"),
    ]);
    const { filtered, hiddenCount } = filterReportBySeverity(report, "high");
    expect(filtered.comments).toHaveLength(2);
    expect(filtered.comments.every((c) => c.severity === "high")).toBe(true);
    expect(hiddenCount).toBe(3);
  });

  it("recomputes stats to match filtered comments", () => {
    const report = makeReport([makeComment("high"), makeComment("medium"), makeComment("low")]);
    const { filtered } = filterReportBySeverity(report, "medium");
    expect(filtered.stats.high).toBe(1);
    expect(filtered.stats.medium).toBe(1);
    expect(filtered.stats.low).toBe(0);
    expect(filtered.stats.info).toBe(0);
    expect(filtered.stats.total).toBe(2);
  });

  it("returns hiddenCount = 0 when no comments are below threshold", () => {
    const report = makeReport([makeComment("high"), makeComment("high")]);
    const { hiddenCount } = filterReportBySeverity(report, "high");
    expect(hiddenCount).toBe(0);
  });

  it("returns empty comments when all are below threshold", () => {
    const report = makeReport([makeComment("info"), makeComment("low")]);
    const { filtered, hiddenCount } = filterReportBySeverity(report, "high");
    expect(filtered.comments).toHaveLength(0);
    expect(filtered.stats.total).toBe(0);
    expect(hiddenCount).toBe(2);
  });

  it("does not mutate the original report", () => {
    const comments = [makeComment("info"), makeComment("high")];
    const report = makeReport(comments);
    filterReportBySeverity(report, "high");
    expect(report.comments).toHaveLength(2);
    expect(report.stats.total).toBe(2);
  });

  it("preserves all non-comments fields from the original report", () => {
    const report = makeReport([makeComment("low")]);
    const { filtered } = filterReportBySeverity(report, "medium");
    expect(filtered.generatedAt).toBe(report.generatedAt);
    expect(filtered.model).toBe(report.model);
    expect(filtered.diffSource).toBe(report.diffSource);
    expect(filtered.summary).toBe(report.summary);
  });
});
