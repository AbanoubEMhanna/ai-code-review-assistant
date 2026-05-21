import type { ReviewOptions } from "@ai-review/shared";

export interface PingResult {
  ok: boolean;
  provider: string;
  host: string;
  model: string;
  latencyMs: number;
  modelFound: boolean;
  availableModels: string[];
  error?: string;
}

async function listOllamaModels(host: string, timeoutMs: number): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${host}/api/tags`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return (data.models ?? []).map((m) => m.name);
  } finally {
    clearTimeout(timer);
  }
}

async function listLmStudioModels(host: string, timeoutMs: number): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${host}/v1/models`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    return (data.data ?? []).map((m) => m.id);
  } finally {
    clearTimeout(timer);
  }
}

export async function pingProvider(
  opts: Pick<ReviewOptions, "provider" | "host" | "model">,
  timeoutMs = 10_000
): Promise<PingResult> {
  const { provider, host, model } = opts;
  const start = Date.now();

  try {
    const models =
      provider === "lmstudio"
        ? await listLmStudioModels(host, timeoutMs)
        : await listOllamaModels(host, timeoutMs);

    const latencyMs = Date.now() - start;
    const modelFound = models.some((m) => m === model || m.startsWith(`${model}:`));

    return {
      ok: true,
      provider,
      host,
      model,
      latencyMs,
      modelFound,
      availableModels: models,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? `Timed out after ${timeoutMs}ms`
          : err.message
        : String(err);

    return {
      ok: false,
      provider,
      host,
      model,
      latencyMs,
      modelFound: false,
      availableModels: [],
      error: message,
    };
  }
}
