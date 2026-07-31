import type { ReviewComment, ReviewOptions, TokenUsage } from "@ai-review/shared";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";
import { parseReview } from "./parser.js";
import { estimateCostUsd } from "./pricing.js";

interface ChatResult {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 60_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function anthropicChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<ChatResult> {
  const res = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    },
    120_000
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API request failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };
  const content = data.content.find((c) => c.type === "text")?.text;
  if (!content) throw new Error("Empty response from Anthropic");
  const usage = data.usage
    ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens }
    : undefined;
  return { content, ...(usage ? { usage } : {}) };
}

async function chatCompletions(
  host: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Promise<ChatResult> {
  const url = `${host}/v1/chat/completions`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, stream: false }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI request failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from AI");
  const usage = data.usage
    ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
    : undefined;
  return { content, ...(usage ? { usage } : {}) };
}

async function ollamaChat(
  host: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Promise<ChatResult> {
  const url = `${host}/api/chat`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { num_predict: maxTokens },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama request failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    message: { content: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };
  if (!data.message?.content) throw new Error("Empty response from Ollama");
  const usage =
    data.prompt_eval_count != null && data.eval_count != null
      ? { inputTokens: data.prompt_eval_count, outputTokens: data.eval_count }
      : undefined;
  return { content: data.message.content, ...(usage ? { usage } : {}) };
}

export async function reviewDiff(
  diff: string,
  diffSource: string,
  opts: ReviewOptions
): Promise<{ summary: string; comments: ReviewComment[]; usage?: TokenUsage }> {
  if (!diff.trim()) {
    return { summary: "No changes to review.", comments: [] };
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(diff, diffSource) },
  ];
  const maxTokens = opts.maxTokens ?? 4096;

  let result: ChatResult;
  if (opts.provider === "anthropic") {
    if (!opts.apiKey) {
      throw new Error(
        "Anthropic provider requires an API key. Set ANTHROPIC_API_KEY or use --api-key."
      );
    }
    result = await anthropicChat(
      opts.apiKey,
      opts.model,
      SYSTEM_PROMPT,
      buildUserPrompt(diff, diffSource),
      maxTokens
    );
  } else if (opts.provider === "lmstudio") {
    result = await chatCompletions(opts.host, opts.model, messages, maxTokens);
  } else {
    try {
      result = await ollamaChat(opts.host, opts.model, messages, maxTokens);
    } catch {
      // Fall back to OpenAI-compatible endpoint (Ollama also supports this)
      result = await chatCompletions(opts.host, opts.model, messages, maxTokens);
    }
  }

  const parsed = parseReview(result.content);

  const comments: ReviewComment[] = parsed.comments.map((c) => ({
    file: c.file,
    ...(c.line != null ? { line: c.line } : {}),
    severity: c.severity,
    category: c.category,
    message: c.message,
    ...(c.suggestion != null ? { suggestion: c.suggestion } : {}),
  }));

  if (!result.usage) {
    return { summary: parsed.summary, comments };
  }

  const estimatedCostUsd = estimateCostUsd(
    opts.provider,
    opts.model,
    result.usage.inputTokens,
    result.usage.outputTokens
  );
  const usage: TokenUsage = {
    ...result.usage,
    ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
  };

  return { summary: parsed.summary, comments, usage };
}
