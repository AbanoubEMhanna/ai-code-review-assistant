import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ReviewReport } from "@ai-review/shared";

export interface StoredReview extends ReviewReport {
  id: string;
}

const DEFAULT_DIR = join(homedir(), ".ai-review", "history");

function isValidId(id: string): boolean {
  return /^\d+-[a-z0-9]+$/.test(id);
}

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
    if (!isValidId(id)) return null;
    try {
      const raw = readFileSync(join(this.dir, `${id}.json`), "utf8");
      return JSON.parse(raw) as StoredReview;
    } catch {
      return null;
    }
  }

  list(opts: { limit?: number; diffSource?: string } = {}): StoredReview[] {
    let files: string[];
    try {
      files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    } catch {
      return [];
    }
    files.sort().reverse();

    let reviews = files.flatMap((f) => {
      try {
        return [JSON.parse(readFileSync(join(this.dir, f), "utf8")) as StoredReview];
      } catch {
        return [];
      }
    });

    if (opts.diffSource !== undefined) {
      reviews = reviews.filter((r) => r.diffSource === opts.diffSource);
    }
    if (opts.limit && opts.limit > 0) {
      reviews = reviews.slice(0, opts.limit);
    }
    return reviews;
  }

  delete(id: string): boolean {
    if (!isValidId(id)) return false;
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

  pruneOlderThan(days: number): number {
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const all = this.list();
    let deleted = 0;
    for (const review of all) {
      const reviewMs = Date.parse(review.generatedAt);
      if (!isNaN(reviewMs) && reviewMs < cutoffMs) {
        if (this.delete(review.id)) deleted++;
      }
    }
    return deleted;
  }

  search(query: string, opts: { limit?: number } = {}): StoredReview[] {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    if (terms.length === 0) return [];

    const all = this.list();
    const matches = all.filter((r) => {
      const haystack = [r.diffSource, r.summary, r.model, ...r.comments.map((c) => c.message)]
        .join(" ")
        .toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });

    return opts.limit !== undefined ? matches.slice(0, opts.limit) : matches;
  }
}
