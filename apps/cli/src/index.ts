#!/usr/bin/env node
import { program } from "commander";
import { reviewDiff } from "@ai-review/ai";
import type { ReviewOptions, ReviewReport } from "@ai-review/shared";
import { getStagedDiff, getBranchDiff, getFileDiff } from "./git.js";
import { printReport, saveMarkdown } from "./output.js";

const DEFAULT_HOST = process.env["AI_HOST"] ?? "http://localhost:11434";
const DEFAULT_MODEL = process.env["AI_MODEL"] ?? "qwen3:latest";
const DEFAULT_PROVIDER = (process.env["AI_PROVIDER"] ?? "ollama") as ReviewOptions["provider"];

function makeOpts(cmd: {
  model: string;
  host: string;
  provider: string;
  output?: string;
  maxTokens?: string;
}): ReviewOptions {
  const provider = cmd.provider.trim().toLowerCase();
  if (provider !== "ollama" && provider !== "lmstudio") {
    throw new Error(`Invalid provider "${cmd.provider}". Use "ollama" or "lmstudio".`);
  }
  const opts: ReviewOptions = { model: cmd.model, host: cmd.host, provider };
  if (cmd.maxTokens !== undefined) {
    const n = parseInt(cmd.maxTokens, 10);
    if (isNaN(n) || n < 1) {
      throw new Error(`--max-tokens must be a positive integer, got "${cmd.maxTokens}"`);
    }
    opts.maxTokens = n;
  }
  return opts;
}

async function runReview(
  diff: string,
  diffSource: string,
  opts: ReviewOptions,
  outputFile: string | undefined
): Promise<void> {
  console.log(`Reviewing ${diffSource} with ${opts.model} via ${opts.provider} (${opts.host})…`);
  const { summary, comments } = await reviewDiff(diff, diffSource, opts);

  const stats = {
    high: comments.filter((c) => c.severity === "high").length,
    medium: comments.filter((c) => c.severity === "medium").length,
    low: comments.filter((c) => c.severity === "low").length,
    info: comments.filter((c) => c.severity === "info").length,
    total: comments.length,
  };

  const report: ReviewReport = {
    generatedAt: new Date().toISOString(),
    model: opts.model,
    diffSource,
    summary,
    comments,
    stats,
  };

  printReport(report);

  if (outputFile) {
    saveMarkdown(report, outputFile);
    console.log(`Report saved to ${outputFile}`);
  }
}

program
  .name("ai-review")
  .description("Local AI code review — powered by Ollama or LM Studio")
  .version("0.1.0");

const sharedOptions = (cmd: ReturnType<typeof program.command>) =>
  cmd
    .option("-m, --model <model>", "Model name", DEFAULT_MODEL)
    .option("-H, --host <url>", "AI host URL", DEFAULT_HOST)
    .option("-p, --provider <provider>", "Provider: ollama or lmstudio", DEFAULT_PROVIDER)
    .option("-t, --max-tokens <number>", "Maximum tokens for the AI response (default: 4096)")
    .option("-o, --output <file>", "Save Markdown report to file");

sharedOptions(
  program
    .command("staged")
    .description("Review staged changes (git add)")
).action(async (opts: { model: string; host: string; provider: string; output?: string; maxTokens?: string }) => {
  const diff = await getStagedDiff().catch(die);
  await runReview(diff, "staged changes", makeOpts(opts), opts.output).catch(die);
});

sharedOptions(
  program
    .command("branch <base>")
    .description("Review commits on HEAD not in <base>")
).action(async (base: string, opts: { model: string; host: string; provider: string; output?: string; maxTokens?: string }) => {
  const diff = await getBranchDiff(base).catch(die);
  await runReview(diff, `diff vs ${base}`, makeOpts(opts), opts.output).catch(die);
});

sharedOptions(
  program
    .command("file <path>")
    .description("Review unstaged or staged changes to a specific file")
).action(async (filePath: string, opts: { model: string; host: string; provider: string; output?: string; maxTokens?: string }) => {
  const diff = await getFileDiff(filePath).catch(die);
  await runReview(diff, `file: ${filePath}`, makeOpts(opts), opts.output).catch(die);
});

function die(err: unknown): never {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
}

program.parse();
