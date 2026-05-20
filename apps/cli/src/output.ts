import chalk from "chalk";
import { writeFileSync } from "node:fs";
import type { ReviewReport } from "@ai-review/shared";

const SEVERITY_COLORS = {
  high: chalk.red.bold,
  medium: chalk.yellow.bold,
  low: chalk.cyan,
  info: chalk.gray,
} as const;

const SEVERITY_ICONS = {
  high: "🔴",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
} as const;

export function printReport(report: ReviewReport): void {
  console.log("\n" + chalk.bold.underline("AI Code Review Report"));
  console.log(
    chalk.dim(`Model: ${report.model}  |  Source: ${report.diffSource}  |  ${report.generatedAt}`)
  );
  console.log();
  console.log(chalk.bold("Summary"));
  console.log(report.summary);
  console.log();

  const { stats } = report;
  const parts = [
    stats.high > 0 ? chalk.red.bold(`${stats.high} high`) : null,
    stats.medium > 0 ? chalk.yellow.bold(`${stats.medium} medium`) : null,
    stats.low > 0 ? chalk.cyan(`${stats.low} low`) : null,
    stats.info > 0 ? chalk.gray(`${stats.info} info`) : null,
  ].filter(Boolean);

  console.log(
    chalk.bold("Issues: ") + (parts.length ? parts.join(chalk.dim("  ·  ")) : chalk.green("none"))
  );

  if (report.comments.length === 0) {
    console.log(chalk.green("\nNo issues found. "));
    return;
  }

  // Group by file
  const byFile = new Map<string, typeof report.comments>();
  for (const c of report.comments) {
    const list = byFile.get(c.file) ?? [];
    list.push(c);
    byFile.set(c.file, list);
  }

  for (const [file, comments] of byFile) {
    console.log("\n" + chalk.bold.underline(file));
    for (const c of comments) {
      const colorFn = SEVERITY_COLORS[c.severity];
      const icon = SEVERITY_ICONS[c.severity];
      const location = c.line != null ? chalk.dim(`:${c.line}`) : "";
      console.log(`  ${icon} ${colorFn(c.severity.toUpperCase())}${location}  [${c.category}]`);
      console.log(`     ${c.message}`);
      if (c.suggestion) {
        console.log(`     ${chalk.dim("→")} ${chalk.italic(c.suggestion)}`);
      }
    }
  }
  console.log();
}

export function buildMarkdown(report: ReviewReport): string {
  const lines: string[] = [];

  lines.push(`# AI Code Review Report`);
  lines.push(
    `\n**Model:** ${report.model}  \n**Source:** ${report.diffSource}  \n**Generated:** ${report.generatedAt}`
  );
  lines.push(`\n## Summary\n\n${report.summary}`);
  lines.push(`\n## Stats\n`);
  lines.push(`| Severity | Count |`);
  lines.push(`|----------|-------|`);
  lines.push(`| 🔴 High | ${report.stats.high} |`);
  lines.push(`| 🟡 Medium | ${report.stats.medium} |`);
  lines.push(`| 🔵 Low | ${report.stats.low} |`);
  lines.push(`| ⚪ Info | ${report.stats.info} |`);
  lines.push(`| **Total** | **${report.stats.total}** |`);

  if (report.comments.length === 0) {
    lines.push(`\n## Issues\n\nNo issues found.`);
    return lines.join("\n");
  }

  lines.push(`\n## Issues\n`);

  const byFile = new Map<string, typeof report.comments>();
  for (const c of report.comments) {
    const list = byFile.get(c.file) ?? [];
    list.push(c);
    byFile.set(c.file, list);
  }

  for (const [file, comments] of byFile) {
    lines.push(`### \`${file}\`\n`);
    for (const c of comments) {
      const icon = { high: "🔴", medium: "🟡", low: "🔵", info: "⚪" }[c.severity];
      const loc = c.line != null ? ` (line ${c.line})` : "";
      lines.push(
        `- ${icon} **${c.severity.toUpperCase()}**${loc} \`${c.category}\` — ${c.message}`
      );
      if (c.suggestion) {
        lines.push(`  > **Suggestion:** ${c.suggestion}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function saveMarkdown(report: ReviewReport, outputPath: string): void {
  const md = buildMarkdown(report);
  writeFileSync(outputPath, md, "utf8");
}

export function printJson(report: ReviewReport): void {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
