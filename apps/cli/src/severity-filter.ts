import type { ReviewReport, ReviewSeverity } from "@ai-review/shared";

export const SEVERITY_RANK: Record<ReviewSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export interface FilterResult {
  filtered: ReviewReport;
  hiddenCount: number;
}

export function filterReportBySeverity(
  report: ReviewReport,
  minSeverity: ReviewSeverity
): FilterResult {
  if (minSeverity === "info") {
    return { filtered: report, hiddenCount: 0 };
  }

  const threshold = SEVERITY_RANK[minSeverity];
  const visible = report.comments.filter((c) => SEVERITY_RANK[c.severity] >= threshold);
  const hiddenCount = report.comments.length - visible.length;

  const filtered: ReviewReport = {
    ...report,
    comments: visible,
    stats: {
      high: visible.filter((c) => c.severity === "high").length,
      medium: visible.filter((c) => c.severity === "medium").length,
      low: visible.filter((c) => c.severity === "low").length,
      info: visible.filter((c) => c.severity === "info").length,
      total: visible.length,
    },
  };

  return { filtered, hiddenCount };
}
