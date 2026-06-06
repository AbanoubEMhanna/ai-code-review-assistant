#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { program } from "commander";
import { reviewDiff, pingProvider } from "@ai-review/ai";
import type { ReviewOptions, ReviewReport, ReviewSeverity } from "@ai-review/shared";
import { getStagedDiff, getBranchDiff, getFileDiff } from "./git.js";
import {
  printReport,
  printJson,
  printPingJson,
  printHistoryStats,
  printHistoryListJson,
  printHistoryStatsJson,
  printPingResult,
  saveMarkdown,
} from "./output.js";
import type { HistoryStats } from "./output.js";
import { ReviewHistoryStore } from "./history-store.js";
import { loadConfig, getConfigFilePath, type AiReviewConfig } from "./config.js";
import { buildDoctorReport, formatDoctorReport, formatDoctorJson } from "./doctor.js";
import { installHook, uninstallHook, showHookStatus, type HookType } from "./hook.js";

const fileConfig: AiReviewConfig = loadConfig();

const DEFAULT_HOST = process.env["AI_HOST"] ?? fileConfig.host ?? "http://localhost:11434";
const DEFAULT_PROVIDER = (process.env["AI_PROVIDER"] ??
  fileConfig.provider ??
  "ollama") as ReviewOptions["provider"];
const DEFAULT_MODEL =
  process.env["AI_MODEL"] ??
  fileConfig.model ??
  (DEFAULT_PROVIDER === "anthropic" ? "claude-sonnet-4-6" : "qwen3:latest");
const DEFAULT_API_KEY = process.env["ANTHROPIC_API_KEY"];

const SEVERITY_RANK: Record<ReviewSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

function makeOpts(cmd: {
  model: string;
  host: string;
  provider: string;
  output?: string;
  maxTokens?: string;
  apiKey?: string;
}): ReviewOptions {
  const provider = cmd.provider.trim().toLowerCase();
  if (provider !== "ollama" && provider !== "lmstudio" && provider !== "anthropic") {
    throw new Error(
      `Invalid provider "${cmd.provider}". Use "ollama", "lmstudio", or "anthropic".`
    );
  }
  const apiKey = cmd.apiKey ?? DEFAULT_API_KEY;
  if (provider === "anthropic" && !apiKey) {
    throw new Error(
      "Anthropic provider requires an API key. Set ANTHROPIC_API_KEY or pass --api-key <key>."
    );
  }
  const opts: ReviewOptions = { model: cmd.model, host: cmd.host, provider };
  if (apiKey) opts.apiKey = apiKey;
  if (cmd.maxTokens !== undefined) {
    const n = parseInt(cmd.maxTokens, 10);
    if (isNaN(n) || n < 1) {
      throw new Error(`--max-tokens must be a positive integer, got "${cmd.maxTokens}"`);
    }
    opts.maxTokens = n;
  }
  return opts;
}

function parseFailOn(value: string): ReviewSeverity {
  const v = value.trim().toLowerCase();
  if (v === "high" || v === "medium" || v === "low" || v === "info") return v;
  throw new Error(`--fail-on must be one of: high, medium, low, info. Got "${value}"`);
}

const store = new ReviewHistoryStore();

async function runReview(
  diff: string,
  diffSource: string,
  opts: ReviewOptions,
  outputFile: string | undefined,
  json: boolean,
  failOn: ReviewSeverity | undefined,
  noSave: boolean
): Promise<void> {
  if (!json) {
    console.log(`Reviewing ${diffSource} with ${opts.model} via ${opts.provider} (${opts.host})…`);
  }
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

  if (json) {
    printJson(report);
  } else {
    printReport(report);
  }

  if (outputFile) {
    saveMarkdown(report, outputFile);
    if (!json) console.log(`Report saved to ${outputFile}`);
  }

  if (!noSave) {
    const stored = store.save(report);
    if (!json) console.log(`Review saved to history (id: ${stored.id})`);
  }

  if (failOn !== undefined) {
    const threshold = SEVERITY_RANK[failOn];
    const exceeded = comments.some((c) => SEVERITY_RANK[c.severity] >= threshold);
    if (exceeded) {
      if (!json) {
        console.error(
          `\nFailed: issues at severity "${failOn}" or above were found (use --fail-on to configure).`
        );
      }
      process.exit(1);
    }
  }
}

program
  .name("ai-review")
  .description("Local AI code review — powered by Ollama or LM Studio")
  .version("0.1.0");

const sharedOptions = (cmd: ReturnType<typeof program.command>) =>
  cmd
    .option("-m, --model <model>", "Model name", DEFAULT_MODEL)
    .option("-H, --host <url>", "AI host URL (Ollama/LM Studio only)", DEFAULT_HOST)
    .option(
      "-p, --provider <provider>",
      "Provider: ollama | lmstudio | anthropic",
      DEFAULT_PROVIDER
    )
    .option("-k, --api-key <key>", "API key (Anthropic; or set ANTHROPIC_API_KEY env var)")
    .option("-t, --max-tokens <number>", "Maximum tokens for the AI response (default: 4096)")
    .option("-o, --output <file>", "Save Markdown report to file")
    .option("--json", "Output review as JSON (suppresses formatted output)")
    .option(
      "--fail-on <severity>",
      "Exit with code 1 if any issue at this severity or above is found (high|medium|low|info)"
    )
    .option("--no-save", "Do not save this review to history");

type SharedOpts = {
  model: string;
  host: string;
  provider: string;
  output?: string;
  maxTokens?: string;
  apiKey?: string;
  json?: boolean;
  failOn?: string;
  save: boolean;
};

sharedOptions(program.command("staged").description("Review staged changes (git add)")).action(
  async (opts: SharedOpts) => {
    const diff = await getStagedDiff().catch(die);
    const failOn = opts.failOn !== undefined ? parseFailOn(opts.failOn) : undefined;
    await runReview(
      diff,
      "staged changes",
      makeOpts(opts),
      opts.output,
      !!opts.json,
      failOn,
      !opts.save
    ).catch(die);
  }
);

sharedOptions(
  program.command("branch <base>").description("Review commits on HEAD not in <base>")
).action(async (base: string, opts: SharedOpts) => {
  const diff = await getBranchDiff(base).catch(die);
  const failOn = opts.failOn !== undefined ? parseFailOn(opts.failOn) : undefined;
  await runReview(
    diff,
    `diff vs ${base}`,
    makeOpts(opts),
    opts.output,
    !!opts.json,
    failOn,
    !opts.save
  ).catch(die);
});

sharedOptions(
  program.command("file <path>").description("Review unstaged or staged changes to a specific file")
).action(async (filePath: string, opts: SharedOpts) => {
  const diff = await getFileDiff(filePath).catch(die);
  const failOn = opts.failOn !== undefined ? parseFailOn(opts.failOn) : undefined;
  await runReview(
    diff,
    `file: ${filePath}`,
    makeOpts(opts),
    opts.output,
    !!opts.json,
    failOn,
    !opts.save
  ).catch(die);
});

// ─── ping command ─────────────────────────────────────────────────────────

program
  .command("ping")
  .description("Test connectivity to the configured AI provider")
  .option("-m, --model <model>", "Model name", DEFAULT_MODEL)
  .option("-H, --host <url>", "AI host URL (Ollama/LM Studio only)", DEFAULT_HOST)
  .option("-p, --provider <provider>", "Provider: ollama | lmstudio | anthropic", DEFAULT_PROVIDER)
  .option("-k, --api-key <key>", "API key (Anthropic; or set ANTHROPIC_API_KEY env var)")
  .option("--json", "Output ping result as JSON (suppresses formatted output)")
  .action(
    async (opts: {
      model: string;
      host: string;
      provider: string;
      apiKey?: string;
      json?: boolean;
    }) => {
      const provider = opts.provider.trim().toLowerCase();
      if (provider !== "ollama" && provider !== "lmstudio" && provider !== "anthropic") {
        if (!opts.json) {
          console.error(
            `Invalid provider "${opts.provider}". Use "ollama", "lmstudio", or "anthropic".`
          );
        } else {
          process.stderr.write(
            JSON.stringify({ error: `Invalid provider "${opts.provider}"` }) + "\n"
          );
        }
        process.exit(1);
      }
      const apiKey = opts.apiKey ?? DEFAULT_API_KEY;
      const pingOpts: Parameters<typeof pingProvider>[0] = {
        provider: provider as ReviewOptions["provider"],
        host: opts.host,
        model: opts.model,
      };
      if (apiKey) pingOpts.apiKey = apiKey;
      const result = await pingProvider(pingOpts);
      if (opts.json) {
        printPingJson(result);
      } else {
        printPingResult(result);
      }
      if (!result.ok || !result.modelFound) process.exit(1);
    }
  );

// ─── doctor command ────────────────────────────────────────────────────────

program
  .command("doctor")
  .description("Run a health check: verify config, connectivity, and model availability")
  .option("-H, --host <url>", "AI host URL (Ollama/LM Studio only)", DEFAULT_HOST)
  .option("-p, --provider <provider>", "Provider: ollama | lmstudio | anthropic", DEFAULT_PROVIDER)
  .option("-m, --model <model>", "Model name", DEFAULT_MODEL)
  .option("-k, --api-key <key>", "API key (Anthropic; or set ANTHROPIC_API_KEY env var)")
  .option("--json", "Output diagnostic result as JSON")
  .action(
    async (opts: {
      host: string;
      provider: string;
      model: string;
      apiKey?: string;
      json?: boolean;
    }) => {
      const provider = opts.provider.trim().toLowerCase() as ReviewOptions["provider"];
      if (provider !== "ollama" && provider !== "lmstudio" && provider !== "anthropic") {
        console.error(
          `Invalid provider "${opts.provider}". Use "ollama", "lmstudio", or "anthropic".`
        );
        process.exit(1);
      }

      const apiKey = opts.apiKey ?? DEFAULT_API_KEY;
      const effectiveConfig = {
        model: opts.model,
        host: provider === "anthropic" ? "api.anthropic.com" : opts.host,
        provider,
        ...(apiKey ? { apiKey } : {}),
      };

      if (!opts.json) process.stdout.write("Running diagnostics…\n");

      const ping = await pingProvider({
        provider,
        host: opts.host,
        model: opts.model,
        ...(apiKey ? { apiKey } : {}),
      });

      const configFile = getConfigFilePath();
      const report = buildDoctorReport(configFile, effectiveConfig, ping);

      if (opts.json) {
        process.stdout.write(formatDoctorJson(report, effectiveConfig));
      } else {
        process.stdout.write(formatDoctorReport(report, effectiveConfig));
      }

      if (!report.ok) process.exit(1);
    }
  );

// ─── history subcommand group ──────────────────────────────────────────────

const historyCmd = program.command("history").description("Manage saved review history");

historyCmd
  .command("list")
  .description("List saved reviews (newest first)")
  .option("-n, --limit <number>", "Number of reviews to show", "20")
  .option("-s, --source <pattern>", "Filter by diff source (exact match)")
  .option("--json", "Output as JSON array")
  .action((opts: { limit: string; source?: string; json?: boolean }) => {
    const limit = parseInt(opts.limit, 10);
    if (isNaN(limit) || limit < 1) {
      console.error(`Invalid --limit "${opts.limit}". Use a positive integer.`);
      process.exit(1);
    }
    const reviews = store.list({
      limit,
      ...(opts.source !== undefined ? { diffSource: opts.source } : {}),
    });
    if (opts.json) {
      printHistoryListJson(reviews);
      return;
    }
    if (reviews.length === 0) {
      console.log("No saved reviews.");
      return;
    }
    for (const r of reviews) {
      const date = new Date(r.generatedAt).toLocaleString();
      const badge =
        r.stats.high > 0
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
  .option("--json", "Output as JSON")
  .action((id: string, opts: { json?: boolean }) => {
    const review = store.get(id);
    if (!review) {
      console.error(`Review "${id}" not found.`);
      process.exit(1);
    }
    if (opts.json) {
      printJson(review);
    } else {
      printReport(review);
    }
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
  .command("stats")
  .description("Show aggregate statistics across saved reviews")
  .option("-s, --source <pattern>", "Restrict stats to a specific diff source (exact match)")
  .option("--json", "Output as JSON")
  .action((opts: { source?: string; json?: boolean }) => {
    const reviews = store.list(opts.source !== undefined ? { diffSource: opts.source } : {});
    if (reviews.length === 0) {
      if (opts.json) {
        printHistoryStatsJson({
          reviewCount: 0,
          totalIssues: 0,
          bySeverity: { high: 0, medium: 0, low: 0, info: 0 },
          byCategory: {},
          topSources: [],
          avgIssuesPerReview: 0,
        });
      } else {
        console.log("No saved reviews.");
      }
      return;
    }

    const bySeverity = { high: 0, medium: 0, low: 0, info: 0 };
    const byCategory: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};

    for (const r of reviews) {
      bySeverity.high += r.stats.high;
      bySeverity.medium += r.stats.medium;
      bySeverity.low += r.stats.low;
      bySeverity.info += r.stats.info;
      sourceCounts[r.diffSource] = (sourceCounts[r.diffSource] ?? 0) + 1;
      for (const c of r.comments) {
        byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
      }
    }

    const totalIssues = bySeverity.high + bySeverity.medium + bySeverity.low + bySeverity.info;
    const topSources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, count]) => ({ source, count }));

    const histStats: HistoryStats = {
      reviewCount: reviews.length,
      totalIssues,
      bySeverity,
      byCategory,
      topSources,
      avgIssuesPerReview: reviews.length > 0 ? totalIssues / reviews.length : 0,
    };

    if (opts.json) {
      printHistoryStatsJson(histStats);
    } else {
      printHistoryStats(histStats);
    }
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

historyCmd
  .command("search <query>")
  .description("Search saved reviews by keyword (searches summary, source, model, and comments)")
  .option("-n, --limit <number>", "Maximum results to show", "20")
  .action((query: string, opts: { limit: string }) => {
    const limit = parseInt(opts.limit, 10);
    const results = store.search(query, { limit: isNaN(limit) ? 20 : limit });
    if (results.length === 0) {
      console.log(`No reviews matching "${query}".`);
      return;
    }
    console.log(`Found ${results.length} review(s) matching "${query}":\n`);
    for (const r of results) {
      const date = new Date(r.generatedAt).toLocaleString();
      const badge =
        r.stats.high > 0
          ? `🔴 ${r.stats.high}H`
          : r.stats.medium > 0
            ? `🟡 ${r.stats.medium}M`
            : "✅";
      console.log(`${r.id}  ${badge}  ${r.diffSource}  (${r.model}, ${date})`);
    }
  });

// ─── config subcommand group ───────────────────────────────────────────────

const configCmd = program.command("config").description("Manage ai-review configuration");

configCmd
  .command("show")
  .description("Show the active configuration and its source")
  .action(() => {
    const configPath = getConfigFilePath();
    const effective = {
      model: DEFAULT_MODEL,
      host: DEFAULT_HOST,
      provider: DEFAULT_PROVIDER,
      ...(fileConfig.maxTokens !== undefined ? { maxTokens: fileConfig.maxTokens } : {}),
    };

    console.log("\nEffective configuration:");
    console.log(JSON.stringify(effective, null, 2));

    if (configPath) {
      console.log(`\nConfig file: ${configPath}`);
    } else {
      console.log("\nNo config file found — using defaults and environment variables.");
      console.log(`  Create .ai-reviewrc.json in the project root to set persistent defaults.`);
    }
  });

configCmd
  .command("init")
  .description("Create a .ai-reviewrc.json with the current defaults")
  .action(() => {
    const configPath = getConfigFilePath();
    if (configPath) {
      console.error(`Config file already exists: ${configPath}`);
      console.error("Delete it first or edit it directly.");
      process.exit(1);
    }
    const defaults: AiReviewConfig = {
      model: DEFAULT_MODEL,
      host: DEFAULT_HOST,
      provider: DEFAULT_PROVIDER,
    };
    writeFileSync(".ai-reviewrc.json", JSON.stringify(defaults, null, 2) + "\n", "utf8");
    console.log("Created .ai-reviewrc.json with current defaults.");
    console.log("Edit it to set your preferred model, host, and provider.");
  });

// ─── hook subcommand group ─────────────────────────────────────────────────

const hookCmd = program.command("hook").description("Manage git hook integration");

hookCmd
  .command("install")
  .description("Install an ai-review git hook (default: pre-commit)")
  .option("--hook <type>", "Hook type to install: pre-commit | pre-push", "pre-commit")
  .option("--fail-on <severity>", "Add --fail-on <severity> to the hook (high|medium|low|info)")
  .option("--base <branch>", "Base branch for pre-push hook comparison (default: main)", "main")
  .option("--force", "Overwrite an existing hook even if not managed by ai-review")
  .action((opts: { hook: string; failOn?: string; base: string; force?: boolean }) => {
    const hookType = opts.hook.trim().toLowerCase();
    if (hookType !== "pre-commit" && hookType !== "pre-push") {
      console.error(`Invalid hook type "${opts.hook}". Use "pre-commit" or "pre-push".`);
      process.exit(1);
    }
    try {
      const validatedFailOn = opts.failOn !== undefined ? parseFailOn(opts.failOn) : undefined;
      installHook(hookType as HookType, {
        ...(validatedFailOn !== undefined ? { failOn: validatedFailOn } : {}),
        base: opts.base,
        ...(opts.force !== undefined ? { force: opts.force } : {}),
      });
      console.log(`✓ Installed ${hookType} hook at .git/hooks/${hookType}`);
      if (hookType === "pre-commit") {
        console.log(
          "  Runs: ai-review staged" + (validatedFailOn ? ` --fail-on ${validatedFailOn}` : "")
        );
      } else {
        console.log(
          `  Runs: ai-review branch ${opts.base}` +
            (validatedFailOn ? ` --fail-on ${validatedFailOn}` : "")
        );
      }
      console.log(`  Remove with: ai-review hook uninstall --hook ${hookType}`);
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

hookCmd
  .command("uninstall")
  .description("Remove an ai-review-managed git hook")
  .option("--hook <type>", "Hook type to remove: pre-commit | pre-push", "pre-commit")
  .action((opts: { hook: string }) => {
    const hookType = opts.hook.trim().toLowerCase();
    if (hookType !== "pre-commit" && hookType !== "pre-push") {
      console.error(`Invalid hook type "${opts.hook}". Use "pre-commit" or "pre-push".`);
      process.exit(1);
    }
    const result = uninstallHook(hookType as HookType);
    if (result === "removed") {
      console.log(`✓ Removed ${hookType} hook from .git/hooks/${hookType}`);
    } else if (result === "not-found") {
      console.log(`No ${hookType} hook found at .git/hooks/${hookType}`);
    } else {
      console.error(
        `.git/hooks/${hookType} exists but was not installed by ai-review.\nRemove it manually if needed.`
      );
      process.exit(1);
    }
  });

hookCmd
  .command("status")
  .description("Show which git hooks are managed by ai-review")
  .action(() => {
    const statuses = showHookStatus(".git");
    console.log("\nGit hook status:");
    for (const { hook, installed, managed } of statuses) {
      if (!installed) {
        console.log(`  ${hook.padEnd(12)}  not installed`);
      } else if (managed) {
        console.log(`  ${hook.padEnd(12)}  ✓ managed by ai-review`);
      } else {
        console.log(`  ${hook.padEnd(12)}  installed (not managed by ai-review)`);
      }
    }
    console.log();
  });

function die(err: unknown): never {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
}

program.parse();
