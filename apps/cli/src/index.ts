#!/usr/bin/env node
import { program } from "commander";
import { reviewDiff } from "@ai-review/ai";
import type { ReviewOptions, ReviewReport } from "@ai-review/shared";
import { getStagedDiff, getBranchDiff, getFileDiff } from "./git.js";
import { printReport, saveMarkdown } from "./output.js";
import { ReviewHistoryStore } from "./history-store.js";

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

const store = new ReviewHistoryStore();

async function runReview(
  diff: string,
  diffSource: string,
  opts: ReviewOptions,
  outputFile: string | undefined,
  noSave: boolean
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

  if (!noSave) {
    const stored = store.save(report);
    console.log(`Review saved to history (id: ${stored.id})`);
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
    .option("-o, --output <file>", "Save Markdown report to file")
    .option("--no-save", "Do not save this review to history");

sharedOptions(
  program
    .command("staged")
    .description("Review staged changes (git add)")
).action(async (opts: { model: string; host: string; provider: string; output?: string; maxTokens?: string; save: boolean }) => {
  const diff = await getStagedDiff().catch(die);
  await runReview(diff, "staged changes", makeOpts(opts), opts.output, !opts.save).catch(die);
});

sharedOptions(
  program
    .command("branch <base>")
    .description("Review commits on HEAD not in <base>")
).action(async (base: string, opts: { model: string; host: string; provider: string; output?: string; maxTokens?: string; save: boolean }) => {
  const diff = await getBranchDiff(base).catch(die);
  await runReview(diff, `diff vs ${base}`, makeOpts(opts), opts.output, !opts.save).catch(die);
});

sharedOptions(
  program
    .command("file <path>")
    .description("Review unstaged or staged changes to a specific file")
).action(async (filePath: string, opts: { model: string; host: string; provider: string; output?: string; maxTokens?: string; save: boolean }) => {
  const diff = await getFileDiff(filePath).catch(die);
  await runReview(diff, `file: ${filePath}`, makeOpts(opts), opts.output, !opts.save).catch(die);
});

// ─── history subcommand group ──────────────────────────────────────────────

const historyCmd = program
  .command("history")
  .description("Manage saved review history");

historyCmd
  .command("list")
  .description("List saved reviews (newest first)")
  .option("-n, --limit <number>", "Number of reviews to show", "20")
  .action((opts: { limit: string }) => {
    const limit = parseInt(opts.limit, 10);
    const reviews = store.list({ limit: isNaN(limit) ? 20 : limit });
    if (reviews.length === 0) {
      console.log("No saved reviews.");
      return;
    }
    for (const r of reviews) {
      const date = new Date(r.generatedAt).toLocaleString();
      const badge = r.stats.high > 0
        ? `🔴 ${r.stats.high}H`
        : r.stats.medium > 0
          ? `🟡 ${r.stats.medium}M`
          : "✅";
      console.log(`${r.id}  ${badge}  ${r.diffSource}  (${r.model}, ${date})`);
    }
  });

historyCmd
  .command("show <id>")
  .description("Show a saved review by ID")
  .action((id: string) => {
    const review = store.get(id);
    if (!review) {
      console.error(`Review "${id}" not found.`);
      process.exit(1);
    }
    printReport(review);
  });

historyCmd
  .command("export <id>")
  .description("Export a saved review as Markdown")
  .requiredOption("-o, --output <file>", "Output file path")
  .action((id: string, opts: { output: string }) => {
    const review = store.get(id);
    if (!review) {
      console.error(`Review "${id}" not found.`);
      process.exit(1);
    }
    saveMarkdown(review, opts.output);
    console.log(`Exported to ${opts.output}`);
  });

historyCmd
  .command("delete <id>")
  .description("Delete a saved review by ID")
  .action((id: string) => {
    const removed = store.delete(id);
    if (removed) {
      console.log(`Deleted review ${id}.`);
    } else {
      console.error(`Review "${id}" not found.`);
      process.exit(1);
    }
  });

historyCmd
  .command("clear")
  .description("Delete all saved reviews")
  .action(() => {
    const n = store.clear();
    console.log(`Cleared ${n} review(s) from history.`);
  });

function die(err: unknown): never {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
}

program.parse();
