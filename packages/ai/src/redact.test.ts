import { describe, expect, it } from "vitest";
import { redactSecrets } from "./redact.js";

describe("redactSecrets", () => {
  it("leaves ordinary diff text untouched", () => {
    const diff = `diff --git a/src/app.ts b/src/app.ts
index abc123..def456 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,3 @@
-const x = 1;
+const x = 2;
 export default x;
`;
    const result = redactSecrets(diff);
    expect(result.text).toBe(diff);
    expect(result.found).toEqual([]);
  });

  it("redacts an AWS access key ID", () => {
    const result = redactSecrets("+const key = 'AKIAABCDEFGHIJKLMNOP';");
    expect(result.found).toEqual(["aws-access-key-id"]);
    expect(result.text).toContain("[REDACTED:aws-access-key-id]");
    expect(result.text).not.toContain("AKIAABCDEFGHIJKLMNOP");
  });

  it("redacts a GitHub personal access token", () => {
    const token = "ghp_" + "a".repeat(36);
    const result = redactSecrets(`+GITHUB_TOKEN=${token}`);
    expect(result.found).toEqual(["github-token"]);
    expect(result.text).not.toContain(token);
  });

  it("redacts a Slack token", () => {
    const result = redactSecrets("+SLACK_TOKEN=xoxb-1234567890-abcdefghij");
    expect(result.found).toEqual(["slack-token"]);
    expect(result.text).toContain("[REDACTED:slack-token]");
  });

  it("redacts an Anthropic API key and does not also flag it as an OpenAI key", () => {
    const key = "sk-ant-" + "a".repeat(30);
    const result = redactSecrets(`+ANTHROPIC_API_KEY=${key}`);
    expect(result.found).toEqual(["anthropic-api-key"]);
    expect(result.text).not.toContain(key);
  });

  it("redacts an OpenAI-style API key", () => {
    const key = "sk-" + "a".repeat(30);
    const result = redactSecrets(`+OPENAI_API_KEY=${key}`);
    expect(result.found).toEqual(["openai-api-key"]);
    expect(result.text).not.toContain(key);
  });

  it("redacts a Google API key", () => {
    const key = "AIza" + "a".repeat(35);
    const result = redactSecrets(`+const key = "${key}";`);
    expect(result.found).toEqual(["google-api-key"]);
    expect(result.text).not.toContain(key);
  });

  it("redacts a Stripe secret key", () => {
    const key = "sk_live_" + "a".repeat(20);
    const result = redactSecrets(`+STRIPE_KEY=${key}`);
    expect(result.found).toEqual(["stripe-key"]);
    expect(result.text).not.toContain(key);
  });

  it("redacts a JWT", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const result = redactSecrets(`+Authorization: Bearer ${jwt}`);
    expect(result.found).toEqual(["jwt"]);
    expect(result.text).not.toContain(jwt);
  });

  it("redacts a PEM private key block", () => {
    const diff = `+-----BEGIN RSA PRIVATE KEY-----
+MIIEpAIBAAKCAQEA...
+-----END RSA PRIVATE KEY-----`;
    const result = redactSecrets(diff);
    expect(result.found).toEqual(["private-key"]);
    expect(result.text).toBe("+[REDACTED:private-key]");
  });

  it("redacts generic credential assignments while keeping the key name and operator", () => {
    const result = redactSecrets('+const password = "hunter2super";');
    expect(result.found).toEqual(["generic-credential"]);
    expect(result.text).toBe('+const password = "[REDACTED:generic-credential]";');
    expect(result.text).not.toContain("hunter2super");
  });

  it("does not flag a short password-like value below the minimum length", () => {
    const result = redactSecrets('+const pwd = "short";');
    expect(result.found).toEqual([]);
    expect(result.text).toContain("short");
  });

  it("collects multiple distinct categories from one diff", () => {
    const diff = [
      "+const aws = 'AKIAABCDEFGHIJKLMNOP';",
      `+const gh = 'ghp_${"b".repeat(36)}';`,
    ].join("\n");
    const result = redactSecrets(diff);
    expect(result.found.sort()).toEqual(["aws-access-key-id", "github-token"]);
  });

  it("does not mutate the input string reference semantics (returns a new string)", () => {
    const input = "+const key = 'AKIAABCDEFGHIJKLMNOP';";
    const result = redactSecrets(input);
    expect(input).toContain("AKIAABCDEFGHIJKLMNOP");
    expect(result.text).not.toBe(input);
  });
});
