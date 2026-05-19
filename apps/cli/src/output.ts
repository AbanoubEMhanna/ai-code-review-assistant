import chalk from "chalk";
import { writeFileSync } from "node:fs";
import type { ReviewReport } from "@ai-review/shared";
import type { PingResult } from "@ai-review/ai";

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

export function printPingResult(result: PingResult): void {
  const providerLabel = chalk.bold(`${result.provider} @ ${result.host}`);
  console.log(`\nPinging ${providerLabel} (model: ${chalk.bold(result.model)})…\n`);

  if (!result.ok) {
    console.log(
      `  ${chalk.red("✗")} Connection failed: ${chalk.red(result.error ?? "unknown error")}`
    );
    console.log(`  ${chalk.dim(`(${result.latencyMs}ms)`)}`);
    if (result.provider === "ollama") {
      console.log(chalk.dim("\n  Hint: run `ollama serve` to start the local server."));
    } else {
      console.log(chalk.dim("\n  Hint: make sure LM Studio server is running."));
    }
    return;
  }

  console.log(`  ${chalk.green("✓")} Host reachable ${chalk.dim(`(${result.latencyMs}ms)`)}`);

  if (result.modelFound) {
    console.log(`  ${chalk.green("✓")} Model ${chalk.bold(result.model)} is available`);
    console.log(chalk.green.bold("\n  Ready to review!\n"));
  } else {
    console.log(`  ${chalk.yellow("⚠")} Model ${chalk.bold(result.model)} not found`);
    if (result.availableModels.length > 0) {
      console.log(`\n  Available models:`);
      for (const m of result.availableModels.slice(0, 10)) {
        console.log(`    ${chalk.cyan("•")} ${m}`);
      }
      if (result.availableModels.length > 10) {
        console.log(chalk.dim(`    … and ${result.availableModels.length - 10} more`));
      }
    } else {
      console.log(chalk.dim(`\n  No models found — try pulling one first.`));
    }
    if (result.provider === "ollama") {
      console.log(chalk.dim(`\n  Hint: run \`ollama pull ${result.model}\` to download it.\n`));
    }
  }
}

export function saveMarkdown(report: ReviewReport, outputPath: string): void {
  const md = buildMarkdown(report);
  writeFileSync(outputPath, md, "utf8");
}
