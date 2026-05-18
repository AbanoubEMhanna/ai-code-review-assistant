import type { ReviewComment, ReviewOptions } from "@ai-review/shared";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";

interface RawReviewResult {
  summary: string;
  comments: Array<{
    file: string;
    line?: number | null;
    severity: ReviewComment["severity"];
    category: ReviewComment["category"];
    message: string;
    suggestion?: string | null;
  }>;
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
): Promise<string> {
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
  };
  const content = data.content.find((c) => c.type === "text")?.text;
  if (!content) throw new Error("Empty response from Anthropic");
  return content;
}

async function chatCompletions(
  host: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Promise<string> {
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
  };
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from AI");
  return content;
}

async function ollamaChat(
  host: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): Promise<string> {
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
  const data = (await res.json()) as { message: { content: string } };
  if (!data.message?.content) throw new Error("Empty response from Ollama");
  return data.message.content;
}

function assertRawReviewResult(value: unknown): asserts value is RawReviewResult {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid AI response: expected object");
  }
  const v = value as Partial<RawReviewResult>;
  if (typeof v.summary !== "string") {
    throw new Error("Invalid AI response: missing or non-string summary");
  }
  if (!Array.isArray(v.comments)) {
    throw new Error("Invalid AI response: comments must be an array");
  }
}

function parseReview(raw: string): RawReviewResult {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    assertRawReviewResult(parsed);
    return parsed;
  } catch (err) {
    throw new Error(
      `Could not parse AI response as JSON.\n\nRaw response:\n${raw}\n\nReason: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function reviewDiff(
  diff: string,
  diffSource: string,
  opts: ReviewOptions
): Promise<{ summary: string; comments: ReviewComment[] }> {
  if (!diff.trim()) {
    return { summary: "No changes to review.", comments: [] };
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(diff, diffSource) },
  ];
  const maxTokens = opts.maxTokens ?? 4096;

  let raw: string;
  if (opts.provider === "anthropic") {
    if (!opts.apiKey) {
      throw new Error(
        "Anthropic provider requires an API key. Set ANTHROPIC_API_KEY or use --api-key."
      );
    }
    raw = await anthropicChat(
      opts.apiKey,
      opts.model,
      SYSTEM_PROMPT,
      buildUserPrompt(diff, diffSource),
      maxTokens
    );
  } else if (opts.provider === "lmstudio") {
    raw = await chatCompletions(opts.host, opts.model, messages, maxTokens);
  } else {
    try {
      raw = await ollamaChat(opts.host, opts.model, messages, maxTokens);
    } catch {
      // Fall back to OpenAI-compatible endpoint (Ollama also supports this)
      raw = await chatCompletions(opts.host, opts.model, messages, maxTokens);
    }
  }

  const parsed = parseReview(raw);

  const comments: ReviewComment[] = parsed.comments.map((c) => ({
    file: c.file,
    ...(c.line != null ? { line: c.line } : {}),
    severity: c.severity,
    category: c.category,
    message: c.message,
    ...(c.suggestion != null ? { suggestion: c.suggestion } : {}),
  }));

  return { summary: parsed.summary, comments };
}
