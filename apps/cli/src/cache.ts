import { createHash } from "node:crypto";

export function computeDiffHash(diff: string, provider: string, model: string): string {
  return createHash("sha256").update(`${provider}\n${model}\n${diff}`).digest("hex");
}
