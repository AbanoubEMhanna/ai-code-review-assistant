import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ReviewReport } from "@ai-review/shared";

export interface StoredReview extends ReviewReport {
  id: string;
}

const DEFAULT_DIR = join(homedir(), ".ai-review", "history");

export class ReviewHistoryStore {
  private readonly dir: string;

  constructor(dir = DEFAULT_DIR) {
    this.dir = dir;
    mkdirSync(this.dir, { recursive: true });
  }

  save(report: ReviewReport): StoredReview {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const stored: StoredReview = { ...report, id };
    writeFileSync(join(this.dir, `${id}.json`), JSON.stringify(stored, null, 2), "utf8");
    return stored;
  }

  get(id: string): StoredReview | null {
    try {
      const raw = readFileSync(join(this.dir, `${id}.json`), "utf8");
      return JSON.parse(raw) as StoredReview;
    } catch {
      return null;
    }
  }

  list(opts: { limit?: number } = {}): StoredReview[] {
    let files: string[];
    try {
      files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    } catch {
      return [];
    }
    files.sort().reverse();
    if (opts.limit) files = files.slice(0, opts.limit);
    return files.flatMap((f) => {
      try {
        return [JSON.parse(readFileSync(join(this.dir, f), "utf8")) as StoredReview];
      } catch {
        return [];
      }
    });
  }

  delete(id: string): boolean {
    try {
      rmSync(join(this.dir, `${id}.json`));
      return true;
    } catch {
      return false;
    }
  }

  clear(): number {
    let files: string[];
    try {
      files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    } catch {
      return 0;
    }
    let count = 0;
    for (const f of files) {
      try {
        rmSync(join(this.dir, f));
        count++;
      } catch {
        // skip
      }
    }
    return count;
  }
}
