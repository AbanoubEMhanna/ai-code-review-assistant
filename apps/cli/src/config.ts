import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export interface AiReviewConfig {
  model?: string;
  host?: string;
  provider?: string;
  maxTokens?: number;
}

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

export const CONFIG_KEYS = ["model", "host", "provider", "maxTokens"] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];

export function isConfigKey(key: string): key is ConfigKey {
  return (CONFIG_KEYS as readonly string[]).includes(key);
}

export function setConfigValue(key: ConfigKey, rawValue: string, targetPath?: string): void {
  const configPath =
    targetPath ?? findProjectConfig(process.cwd()) ?? join(process.cwd(), CONFIG_FILE);
  const current = existsSync(configPath) ? readConfigFile(configPath) : {};
  let value: string | number;
  if (key === "maxTokens") {
    const n = parseInt(rawValue, 10);
    if (isNaN(n) || n < 1) {
      throw new Error(`"maxTokens" must be a positive integer, got "${rawValue}"`);
    }
    value = n;
  } else {
    value = rawValue;
  }
  const updated: AiReviewConfig = { ...current, [key]: value };
  writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
}

export function unsetConfigValue(key: ConfigKey, targetPath?: string): boolean {
  const configPath =
    targetPath ?? findProjectConfig(process.cwd()) ?? join(process.cwd(), CONFIG_FILE);
  if (!existsSync(configPath)) return false;
  const current = readConfigFile(configPath);
  if (!(key in current)) return false;
  const updated = { ...current };
  delete updated[key];
  writeFileSync(configPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
  return true;
}
