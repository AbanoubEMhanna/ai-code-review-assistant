import { describe, expect, it } from "vitest";
import type { PingResult } from "@ai-review/ai";
import { buildDoctorReport, formatDoctorReport, formatDoctorJson } from "./doctor.js";

function makePing(overrides: Partial<PingResult> = {}): PingResult {
  return {
    ok: true,
    provider: "ollama",
    host: "http://localhost:11434",
    model: "qwen3:latest",
    latencyMs: 42,
    modelFound: true,
    availableModels: ["qwen3:latest"],
    ...overrides,
  };
}

const defaultConfig = {
  model: "qwen3:latest",
  host: "http://localhost:11434",
  provider: "ollama",
};

describe("buildDoctorReport()", () => {
  it("all green when config file exists, provider reachable, model found", () => {
    const report = buildDoctorReport("/project/.ai-reviewrc.json", defaultConfig, makePing());
    expect(report.ok).toBe(true);
    expect(report.checks).toHaveLength(2);
    expect(report.checks.every((c) => c.status === "ok")).toBe(true);
  });

  it("warns when no config file found", () => {
    const report = buildDoctorReport(null, defaultConfig, makePing());
    const configCheck = report.checks.find((c) => c.label === "Config file");
    expect(configCheck?.status).toBe("warn");
    expect(configCheck?.suggestion).toContain("config init");
  });

  it("errors when provider unreachable", () => {
    const report = buildDoctorReport(
      null,
      defaultConfig,
      makePing({ ok: false, modelFound: false, availableModels: [], error: "ECONNREFUSED" })
    );
    expect(report.ok).toBe(false);
    const conn = report.checks.find((c) => c.label === "Connectivity");
    expect(conn?.status).toBe("error");
    expect(conn?.detail).toContain("ECONNREFUSED");
    expect(conn?.suggestion).toContain("ollama serve");
  });

  it("warns when connected but model not found (ollama)", () => {
    const report = buildDoctorReport(
      "/project/.ai-reviewrc.json",
      defaultConfig,
      makePing({ modelFound: false, availableModels: ["llama3:latest"] })
    );
    expect(report.ok).toBe(true);
    const conn = report.checks.find((c) => c.label === "Connectivity");
    expect(conn?.status).toBe("warn");
    expect(conn?.suggestion).toContain("ollama pull");
  });

  it("warns when connected but model not found (lmstudio)", () => {
    const report = buildDoctorReport(
      null,
      { ...defaultConfig, provider: "lmstudio" },
      makePing({ provider: "lmstudio", modelFound: false, availableModels: ["Qwen/Qwen3-8B"] })
    );
    const conn = report.checks.find((c) => c.label === "Connectivity");
    expect(conn?.status).toBe("warn");
    expect(conn?.suggestion).toContain("LM Studio");
  });

  it("errors when anthropic api key is missing", () => {
    const report = buildDoctorReport(
      null,
      { ...defaultConfig, provider: "anthropic" },
      makePing({ provider: "anthropic" })
    );
    const keyCheck = report.checks.find((c) => c.label === "API key");
    expect(keyCheck?.status).toBe("error");
    expect(report.ok).toBe(false);
  });

  it("does not add api key check when anthropic key is present", () => {
    const report = buildDoctorReport(
      "/project/.ai-reviewrc.json",
      { ...defaultConfig, provider: "anthropic", apiKey: "sk-ant-secret" },
      makePing({ provider: "anthropic" })
    );
    const keyCheck = report.checks.find((c) => c.label === "API key");
    expect(keyCheck).toBeUndefined();
  });

  it("lmstudio connection error suggests loading server", () => {
    const report = buildDoctorReport(
      null,
      { ...defaultConfig, provider: "lmstudio", host: "http://localhost:1234" },
      makePing({
        ok: false,
        provider: "lmstudio",
        host: "http://localhost:1234",
        modelFound: false,
        availableModels: [],
        error: "ECONNREFUSED",
      })
    );
    const conn = report.checks.find((c) => c.label === "Connectivity");
    expect(conn?.suggestion).toContain("LM Studio");
  });

  it("report.ok is false when any check is error status", () => {
    const report = buildDoctorReport(
      null,
      defaultConfig,
      makePing({ ok: false, modelFound: false, availableModels: [], error: "timeout" })
    );
    expect(report.ok).toBe(false);
  });

  it("report.ok is true when checks are only warnings", () => {
    const report = buildDoctorReport(
      null,
      defaultConfig,
      makePing({ modelFound: false, availableModels: [] })
    );
    expect(report.ok).toBe(true);
    const errors = report.checks.filter((c) => c.status === "error");
    expect(errors).toHaveLength(0);
  });
});

describe("formatDoctorReport()", () => {
  it("includes provider, model, host in output", () => {
    const report = buildDoctorReport("/cfg", defaultConfig, makePing());
    const out = formatDoctorReport(report, defaultConfig);
    expect(out).toContain("ollama");
    expect(out).toContain("qwen3:latest");
    expect(out).toContain("http://localhost:11434");
  });

  it('shows "Ready to use" when all checks pass', () => {
    const report = buildDoctorReport("/cfg", defaultConfig, makePing());
    const out = formatDoctorReport(report, defaultConfig);
    expect(out).toContain("Ready to use");
  });

  it("shows error count when errors exist", () => {
    const report = buildDoctorReport(
      null,
      defaultConfig,
      makePing({ ok: false, modelFound: false, availableModels: [], error: "ECONNREFUSED" })
    );
    const out = formatDoctorReport(report, defaultConfig);
    expect(out).toContain("1 error");
  });

  it("output ends with a newline", () => {
    const report = buildDoctorReport("/cfg", defaultConfig, makePing());
    const out = formatDoctorReport(report, defaultConfig);
    expect(out.endsWith("\n")).toBe(true);
  });
});

describe("formatDoctorJson()", () => {
  it("emits valid JSON with ok, config, and checks keys", () => {
    const report = buildDoctorReport("/cfg", defaultConfig, makePing());
    const raw = formatDoctorJson(report, defaultConfig);
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("config");
    expect(parsed).toHaveProperty("checks");
    expect(Array.isArray(parsed.checks)).toBe(true);
  });

  it("each check has label, status, detail", () => {
    const report = buildDoctorReport("/cfg", defaultConfig, makePing());
    const parsed = JSON.parse(formatDoctorJson(report, defaultConfig));
    for (const check of parsed.checks) {
      expect(check).toHaveProperty("label");
      expect(check).toHaveProperty("status");
      expect(check).toHaveProperty("detail");
    }
  });

  it("suggestion field omitted when not present", () => {
    const report = buildDoctorReport("/cfg", defaultConfig, makePing());
    const parsed = JSON.parse(formatDoctorJson(report, defaultConfig));
    const configCheck = parsed.checks.find((c: { label: string }) => c.label === "Config file");
    expect(configCheck?.suggestion).toBeUndefined();
  });

  it("suggestion field included when present", () => {
    const report = buildDoctorReport(null, defaultConfig, makePing());
    const parsed = JSON.parse(formatDoctorJson(report, defaultConfig));
    const configCheck = parsed.checks.find((c: { label: string }) => c.label === "Config file");
    expect(configCheck?.suggestion).toBeDefined();
  });

  it("output ends with a newline", () => {
    const report = buildDoctorReport("/cfg", defaultConfig, makePing());
    const out = formatDoctorJson(report, defaultConfig);
    expect(out.endsWith("\n")).toBe(true);
  });
});
