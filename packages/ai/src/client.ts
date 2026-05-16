import type { ReviewComment, ReviewOptions } from "@ai-review/shared";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";
import { parseReview } from "./parser.js";

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
  if (opts.provider === "lmstudio") {
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
