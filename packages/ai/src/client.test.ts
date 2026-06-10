import { describe, it, expect, vi, afterEach } from "vitest";
import { reviewDiff } from "./client.js";
import type { ReviewOptions } from "@ai-review/shared";

const OLLAMA_OPTS: ReviewOptions = {
  provider: "ollama",
  host: "http://localhost:11434",
  model: "qwen3:latest",
};

const ANTHROPIC_OPTS: ReviewOptions = {
  provider: "anthropic",
  host: "http://localhost:11434",
  model: "claude-sonnet-4-6",
  apiKey: "test-key",
};

const LMSTUDIO_OPTS: ReviewOptions = {
  provider: "lmstudio",
  host: "http://localhost:1234",
  model: "mistral-7b",
};

const STUB_REVIEW_JSON = JSON.stringify({
  summary: "Looks good",
  comments: [],
});

function mockFetchOk(body: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          message: { content: body },
          choices: [{ message: { content: body } }],
          content: [{ type: "text", text: body }],
        }),
      text: () => Promise.resolve(body),
    })
  );
}

function mockFetchAbortable() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise<never>((_, reject) => {
        (init.signal as AbortSignal).addEventListener("abort", () => {
          const err = new DOMException("The operation was aborted.", "AbortError");
          reject(err);
        });
      });
    })
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("reviewDiff — empty diff", () => {
  it("returns no-changes summary without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await reviewDiff("", "staged changes", OLLAMA_OPTS);
    expect(result.summary).toBe("No changes to review.");
    expect(result.comments).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("reviewDiff — timeout option", () => {
  it("passes custom timeoutMs to the ollama request", async () => {
    mockFetchOk(STUB_REVIEW_JSON);
    const result = await reviewDiff("+ const x = 1;", "staged changes", {
      ...OLLAMA_OPTS,
      timeoutMs: 5_000,
    });
    expect(result.summary).toBe("Looks good");
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it("passes custom timeoutMs to the lmstudio request", async () => {
    mockFetchOk(STUB_REVIEW_JSON);
    const result = await reviewDiff("+ const x = 1;", "staged changes", {
      ...LMSTUDIO_OPTS,
      timeoutMs: 8_000,
    });
    expect(result.summary).toBe("Looks good");
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it("passes custom timeoutMs to the anthropic request", async () => {
    mockFetchOk(STUB_REVIEW_JSON);
    const result = await reviewDiff("+ const x = 1;", "staged changes", {
      ...ANTHROPIC_OPTS,
      timeoutMs: 10_000,
    });
    expect(result.summary).toBe("Looks good");
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it("succeeds without timeoutMs — uses provider defaults", async () => {
    mockFetchOk(STUB_REVIEW_JSON);
    const result = await reviewDiff("+ const x = 1;", "staged changes", OLLAMA_OPTS);
    expect(result.comments).toEqual([]);
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it("aborts lmstudio request after timeoutMs elapses", async () => {
    vi.useFakeTimers();
    mockFetchAbortable();

    const promise = reviewDiff("+ const x = 1;", "staged changes", {
      ...LMSTUDIO_OPTS,
      timeoutMs: 3_000,
    });

    // Attach the rejection handler before advancing timers to avoid
    // PromiseRejectionHandledWarning from Node.js.
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(3_001);
    await assertion;
  }, 10_000);

  it("does not abort lmstudio request before timeoutMs elapses", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        capturedSignal = init.signal as AbortSignal;
        return new Promise<never>(() => {});
      })
    );

    reviewDiff("+ const x = 1;", "staged changes", {
      ...LMSTUDIO_OPTS,
      timeoutMs: 5_000,
    });

    await vi.advanceTimersByTimeAsync(4_999);
    expect(capturedSignal?.aborted).toBe(false);
  }, 10_000);

  it("aborts anthropic request after custom timeoutMs elapses", async () => {
    vi.useFakeTimers();
    mockFetchAbortable();

    const promise = reviewDiff("+ const x = 1;", "staged changes", {
      ...ANTHROPIC_OPTS,
      timeoutMs: 2_000,
    });

    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(2_001);
    await assertion;
  }, 10_000);
});

describe("reviewDiff — anthropic missing api key", () => {
  it("throws without making a fetch call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      reviewDiff("+ const x = 1;", "staged", {
        provider: "anthropic",
        host: "http://localhost:11434",
        model: "claude-sonnet-4-6",
      })
    ).rejects.toThrow(/API key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
