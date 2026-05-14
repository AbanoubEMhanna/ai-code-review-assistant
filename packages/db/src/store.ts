import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ReviewReport, StoredReview, ListOptions } from "./types.js";

const DEFAULT_DIR = join(homedir(), ".ai-review", "history");

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readJson(filePath: string): StoredReview {
  return JSON.parse(readFileSync(filePath, "utf8")) as StoredReview;
}

export class ReviewStore {
  private readonly dir: string;

  constructor(dir: string = DEFAULT_DIR) {
    this.dir = dir;
    mkdirSync(this.dir, { recursive: true });
  }

  save(report: ReviewReport): StoredReview {
    const id = generateId();
    const stored: StoredReview = {
      ...report,
      id,
      savedAt: new Date().toISOString(),
    };
    writeFileSync(join(this.dir, `${id}.json`), JSON.stringify(stored, null, 2), "utf8");
    return stored;
  }

  get(id: string): StoredReview | null {
    const file = join(this.dir, `${id}.json`);
    if (!existsSync(file)) return null;
    return readJson(file);
  }

  list(opts: ListOptions = {}): StoredReview[] {
    if (!existsSync(this.dir)) return [];

    let reviews = readdirSync(this.dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => readJson(join(this.dir, f)))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));

    if (opts.diffSource !== undefined) {
      reviews = reviews.filter((r) => r.diffSource === opts.diffSource);
    }

    if (opts.limit !== undefined && opts.limit > 0) {
      reviews = reviews.slice(0, opts.limit);
    }

    return reviews;
  }

  delete(id: string): boolean {
    const file = join(this.dir, `${id}.json`);
    if (!existsSync(file)) return false;
    unlinkSync(file);
    return true;
  }

  clear(): number {
    if (!existsSync(this.dir)) return 0;
    const files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      unlinkSync(join(this.dir, f));
    }
    return files.length;
  }
}
