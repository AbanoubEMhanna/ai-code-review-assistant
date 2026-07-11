import { existsSync, readFileSync } from "node:fs";
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
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(
      `⚠ Could not read config file ${filePath}: ${err instanceof Error ? err.message : String(err)}. Using defaults.`
    );
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(
      `⚠ Config file ${filePath} is not valid JSON (${err instanceof Error ? err.message : String(err)}). Ignoring it and using defaults.`
    );
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.error(
      `⚠ Config file ${filePath} must contain a JSON object. Ignoring it and using defaults.`
    );
    return {};
  }

  const obj = parsed as Record<string, unknown>;
  const cfg: AiReviewConfig = {};

  if (obj["model"] !== undefined) {
    if (typeof obj["model"] === "string") cfg.model = obj["model"];
    else console.error(`⚠ Config file ${filePath}: "model" must be a string, ignoring it.`);
  }
  if (obj["host"] !== undefined) {
    if (typeof obj["host"] === "string") cfg.host = obj["host"];
    else console.error(`⚠ Config file ${filePath}: "host" must be a string, ignoring it.`);
  }
  if (obj["provider"] !== undefined) {
    if (typeof obj["provider"] === "string") cfg.provider = obj["provider"];
    else console.error(`⚠ Config file ${filePath}: "provider" must be a string, ignoring it.`);
  }
  if (obj["maxTokens"] !== undefined) {
    if (typeof obj["maxTokens"] === "number") cfg.maxTokens = obj["maxTokens"];
    else console.error(`⚠ Config file ${filePath}: "maxTokens" must be a number, ignoring it.`);
  }

  return cfg;
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
