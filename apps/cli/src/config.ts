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

// Finds the directory that bounds the config search: the nearest ancestor
// (inclusive of startDir) that is either the home directory or a git
// repository root. Returns null if neither is found before the filesystem
// root — e.g. startDir is outside the home tree and not inside any git repo.
function findSearchBoundary(startDir: string, home: string): string | null {
  let dir = startDir;
  while (true) {
    if (dir === home || existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Bounded at the git repository root (or the home directory, whichever is hit
// first) rather than walking all the way to the filesystem root. Otherwise a
// `.ai-reviewrc.json` planted in an unrelated ancestor directory — e.g. a
// shared parent folder on a CI runner or multi-tenant box — would be picked
// up silently, and since `host` is read straight out of it, that lets an
// attacker with write access to that ancestor redirect where diffs (source
// code) get sent. When startDir has no such boundary (outside the home tree,
// not inside a git repo), only startDir itself is trusted — no ancestor is
// checked at all.
function findProjectConfig(startDir: string): string | null {
  const home = homedir();
  const boundary = findSearchBoundary(startDir, home);
  if (boundary === null) {
    const candidate = join(startDir, CONFIG_FILE);
    return existsSync(candidate) ? candidate : null;
  }
  let dir = startDir;
  while (true) {
    const candidate = join(dir, CONFIG_FILE);
    if (existsSync(candidate)) return candidate;
    if (dir === boundary) return null;
    dir = dirname(dir);
  }
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
