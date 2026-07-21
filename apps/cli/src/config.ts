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

export function getConfigFilePath(cwd: string = process.cwd()): string | null {
  const projectPath = findProjectConfig(cwd);
  if (projectPath) return projectPath;
  const globalPath = join(homedir(), CONFIG_FILE);
  return existsSync(globalPath) ? globalPath : null;
}

export class ConfigFileExistsError extends Error {
  constructor(public readonly path: string) {
    super(`Config file already exists: ${path}`);
    this.name = "ConfigFileExistsError";
  }
}

/**
 * Writes a new .ai-reviewrc.json in `cwd`. Refuses to clobber an existing config
 * (project-local or global) unless `force` is set, since the global config path
 * doesn't necessarily match the local file being written.
 */
export function initConfigFile(
  defaults: AiReviewConfig,
  options: { force?: boolean; cwd?: string } = {}
): { path: string; overwrote: boolean } {
  const cwd = options.cwd ?? process.cwd();
  const localPath = join(cwd, CONFIG_FILE);
  const existingPath = getConfigFilePath(cwd);
  if (existingPath && !options.force) {
    throw new ConfigFileExistsError(existingPath);
  }
  writeFileSync(localPath, JSON.stringify(defaults, null, 2) + "\n", "utf8");
  return { path: localPath, overwrote: existingPath === localPath };
}
