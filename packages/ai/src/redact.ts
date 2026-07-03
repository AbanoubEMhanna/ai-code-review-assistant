export interface RedactResult {
  text: string;
  found: string[];
}

interface SecretPattern {
  category: string;
  regex: RegExp;
}

// High-confidence, format-specific secret patterns. Deliberately excludes
// anything that would require guessing at arbitrary base64/hex blobs (e.g.
// AWS secret access keys) since that produces too many false positives.
const SECRET_PATTERNS: SecretPattern[] = [
  {
    category: "private-key",
    regex: /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g,
  },
  { category: "aws-access-key-id", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { category: "github-token", regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { category: "slack-token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { category: "anthropic-api-key", regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { category: "openai-api-key", regex: /\bsk-(?!ant-)[A-Za-z0-9]{20,}\b/g },
  { category: "google-api-key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { category: "stripe-key", regex: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{10,}\b/g },
  { category: "jwt", regex: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g },
];

// Matches `key = "value"` / `key: 'value'` assignments for common credential
// field names, e.g. `password = "hunter2"` or `apiKey: "abc123xyz"`.
const GENERIC_CREDENTIAL_REGEX =
  /\b(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)(\s*[:=]\s*)["']([^"'\s]{8,})["']/gi;

/**
 * Scrubs common secret formats (cloud provider keys, tokens, private keys,
 * generic credential assignments) from a diff before it is sent to an AI
 * provider. Returns the redacted text plus the distinct categories found,
 * so callers can warn the user without leaking the actual secret values.
 */
export function redactSecrets(diff: string): RedactResult {
  const found = new Set<string>();
  let text = diff;

  for (const { category, regex } of SECRET_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(text)) found.add(category);
    regex.lastIndex = 0;
    text = text.replace(regex, `[REDACTED:${category}]`);
  }

  GENERIC_CREDENTIAL_REGEX.lastIndex = 0;
  if (GENERIC_CREDENTIAL_REGEX.test(text)) found.add("generic-credential");
  GENERIC_CREDENTIAL_REGEX.lastIndex = 0;
  text = text.replace(
    GENERIC_CREDENTIAL_REGEX,
    (_match: string, key: string, sep: string) => `${key}${sep}"[REDACTED:generic-credential]"`
  );

  return { text, found: Array.from(found) };
}
