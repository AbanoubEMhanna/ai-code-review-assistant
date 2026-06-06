import type { PingResult } from "@ai-review/ai";
import type { ReviewOptions } from "@ai-review/shared";

export interface DoctorCheck {
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
  suggestion?: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  ok: boolean;
}

export function buildDoctorReport(
  configFile: string | null,
  effectiveConfig: { model: string; host: string; provider: string; apiKey?: string },
  ping: PingResult
): DoctorReport {
  const checks: DoctorCheck[] = [];

  // ── Config check ───────────────────────────────────────────────────────────
  if (configFile) {
    checks.push({
      label: "Config file",
      status: "ok",
      detail: configFile,
    });
  } else {
    checks.push({
      label: "Config file",
      status: "warn",
      detail: "No .ai-reviewrc.json found — using defaults and env vars",
      suggestion: "Run: ai-review config init",
    });
  }

  // ── Provider / API key check ───────────────────────────────────────────────
  if (effectiveConfig.provider === "anthropic" && !effectiveConfig.apiKey) {
    checks.push({
      label: "API key",
      status: "error",
      detail: "ANTHROPIC_API_KEY is not set",
      suggestion: "Set the ANTHROPIC_API_KEY environment variable or pass --api-key <key>",
    });
  }

  // ── Connectivity check ─────────────────────────────────────────────────────
  if (!ping.ok) {
    checks.push({
      label: "Connectivity",
      status: "error",
      detail: `Cannot reach ${ping.provider} @ ${ping.host}: ${ping.error ?? "unknown error"}`,
      suggestion:
        ping.provider === "ollama"
          ? "Start Ollama: ollama serve"
          : ping.provider === "lmstudio"
            ? "Start the LM Studio local server from the app"
            : "Check your ANTHROPIC_API_KEY and network connection",
    });
  } else if (!ping.modelFound) {
    const hint =
      ping.provider === "ollama"
        ? `ollama pull ${effectiveConfig.model}`
        : ping.provider === "lmstudio"
          ? "Load the model in LM Studio"
          : undefined;
    checks.push({
      label: "Connectivity",
      status: "warn",
      detail: `Connected to ${ping.provider} @ ${ping.host} (${ping.latencyMs}ms) — model "${effectiveConfig.model}" not found`,
      suggestion: hint
        ? `Pull the model: ${hint}`
        : `Available models: ${ping.availableModels.slice(0, 3).join(", ")}`,
    });
  } else {
    checks.push({
      label: "Connectivity",
      status: "ok",
      detail: `${ping.provider} @ ${ping.host} — ${ping.latencyMs}ms, model "${effectiveConfig.model}" found`,
    });
  }

  const ok = checks.every((c) => c.status !== "error");
  return { checks, ok };
}

export function formatDoctorReport(
  report: DoctorReport,
  effectiveConfig: { model: string; host: string; provider: string }
): string {
  const lines: string[] = [];

  lines.push("\nai-review diagnostic report");
  lines.push("═".repeat(40));

  lines.push("\nEffective config:");
  lines.push(`  provider : ${effectiveConfig.provider}`);
  lines.push(`  model    : ${effectiveConfig.model}`);
  lines.push(`  host     : ${effectiveConfig.host}`);

  lines.push("\nChecks:");
  for (const check of report.checks) {
    const icon = check.status === "ok" ? "✅" : check.status === "warn" ? "⚠️ " : "❌";
    lines.push(`  ${icon}  ${check.label}: ${check.detail}`);
    if (check.suggestion) {
      lines.push(`       → ${check.suggestion}`);
    }
  }

  const errors = report.checks.filter((c) => c.status === "error").length;
  const warnings = report.checks.filter((c) => c.status === "warn").length;

  lines.push("");
  if (errors === 0 && warnings === 0) {
    lines.push("Overall: ✅  Ready to use");
  } else {
    const parts: string[] = [];
    if (errors > 0) parts.push(`${errors} error${errors > 1 ? "s" : ""}`);
    if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? "s" : ""}`);
    lines.push(`Overall: ${errors > 0 ? "❌" : "⚠️ "}  ${parts.join(", ")}`);
  }

  return lines.join("\n") + "\n";
}

export function formatDoctorJson(
  report: DoctorReport,
  effectiveConfig: { model: string; host: string; provider: string }
): string {
  return (
    JSON.stringify(
      {
        ok: report.ok,
        config: effectiveConfig,
        checks: report.checks.map((c) => ({
          label: c.label,
          status: c.status,
          detail: c.detail,
          ...(c.suggestion !== undefined ? { suggestion: c.suggestion } : {}),
        })),
      },
      null,
      2
    ) + "\n"
  );
}

export function providerHint(provider: string): string {
  if (provider === "anthropic") return "Anthropic Claude API";
  if (provider === "lmstudio") return "LM Studio";
  return "Ollama";
}

export function placeholderModel(provider: ReviewOptions["provider"]): string {
  return provider === "anthropic" ? "claude-sonnet-4-6" : "qwen3:latest";
}
