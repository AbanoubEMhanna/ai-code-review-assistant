// Approximate USD list prices per 1M tokens for cloud providers, used to give users a
// ballpark cost estimate. Local providers (Ollama, LM Studio) have no per-token cost.
// Prices are best-effort and may drift from the provider's current pricing page.
interface ModelPrice {
  match: RegExp;
  inputPerMillion: number;
  outputPerMillion: number;
}

// Version-specific entries are listed before family-wide fallbacks — the first match wins,
// so put newer/cheaper or newer/pricier model IDs ahead of the generic "-opus/-sonnet/-haiku"
// patterns they'd otherwise also match.
const ANTHROPIC_PRICES: ModelPrice[] = [
  { match: /^claude-3-haiku/i, inputPerMillion: 0.25, outputPerMillion: 1.25 },
  { match: /^claude-haiku-4-5/i, inputPerMillion: 1, outputPerMillion: 5 },
  { match: /claude-.*opus/i, inputPerMillion: 15, outputPerMillion: 75 },
  { match: /claude-.*sonnet/i, inputPerMillion: 3, outputPerMillion: 15 },
  { match: /claude-.*haiku/i, inputPerMillion: 0.8, outputPerMillion: 4 },
];

/**
 * Estimates the USD cost of a request for a known cloud model. Returns undefined when the
 * provider has no per-token cost (local models) or the model isn't in the pricing table.
 */
export function estimateCostUsd(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number | undefined {
  if (provider !== "anthropic") return undefined;

  const price = ANTHROPIC_PRICES.find((p) => p.match.test(model));
  if (!price) return undefined;

  return (
    (inputTokens / 1_000_000) * price.inputPerMillion +
    (outputTokens / 1_000_000) * price.outputPerMillion
  );
}
