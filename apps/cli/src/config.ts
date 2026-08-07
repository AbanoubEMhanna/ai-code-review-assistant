import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export interface AiReviewConfig {
  model?: string;
  host?: string;
  provider?: string;
  maxTokens?: number;
}

export const CONFIG_KEYS = ["model", "host", "provider", "maxTokens"] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];

const CONFIG_FILE = ".ai-reviewrc.json";

function findProjectConfig(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, CONFIG_FILE);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readConfigFile(filePath: string): AiReviewConfig {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const obj = parsed as Record<string, unknown>;
    const cfg: AiReviewConfig = {};
    if (typeof obj["model"] === "string") cfg.model = obj["model"];
    if (typeof obj["host"] === "string") cfg.host = obj["host"];
    if (typeof obj["provider"] === "string") cfg.provider = obj["provider"];
    if (typeof obj["maxTokens"] === "number") cfg.maxTokens = obj["maxTokens"];
    return cfg;
  } catch {
    return {};
  }
}

export function loadConfig(): AiReviewConfig {
  const projectPath = findProjectConfig(process.cwd());
  if (projectPath) return readConfigFile(projectPath);

  const globalPath = join(homedir(), CONFIG_FILE);
  if (existsSync(globalPath)) return readConfigFile(globalPath);

  return {};
}

export function getConfigFilePath(): string | null {
  const projectPath = findProjectConfig(process.cwd());
  if (projectPath) return projectPath;
  const globalPath = join(homedir(), CONFIG_FILE);
  return existsSync(globalPath) ? globalPath : null;
}

export function writeConfigValue(filePath: string, key: ConfigKey, value: string | number): void {
  let existing: Record<string, unknown> = {};
  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>;
      }
    } catch {
      // Corrupt/unreadable config: overwrite it rather than losing the update.
    }
  }
  existing[key] = value;
  writeFileSync(filePath, JSON.stringify(existing, null, 2) + "\n", "utf8");
}
