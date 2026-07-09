import type { ReviewReport, ReviewSeverity } from "@ai-review/shared";

const SEVERITY_RANK: Record<ReviewSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

/**
 * Returns a copy of `report` limited to the top `maxIssues` comments ordered by
 * severity (high → medium → low → info), plus the number of hidden comments.
 *
 * When `maxIssues` is 0 or the report has fewer issues than the limit, the
 * original report object is returned unchanged with `hiddenCount` of 0.
 */
export function limitReportIssues(
  report: ReviewReport,
  maxIssues: number
): { report: ReviewReport; hiddenCount: number } {
  if (maxIssues <= 0 || report.comments.length <= maxIssues) {
    return { report, hiddenCount: 0 };
  }

  const sorted = [...report.comments].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  );
  const limited = sorted.slice(0, maxIssues);
  const hiddenCount = report.comments.length - maxIssues;

  return {
    report: {
      ...report,
      comments: limited,
      stats: {
        high: limited.filter((c) => c.severity === "high").length,
        medium: limited.filter((c) => c.severity === "medium").length,
        low: limited.filter((c) => c.severity === "low").length,
        info: limited.filter((c) => c.severity === "info").length,
        total: limited.length,
      },
    },
    hiddenCount,
  };
}
