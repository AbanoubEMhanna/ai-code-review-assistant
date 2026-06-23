import { describe, expect, it, vi, afterEach } from "vitest";
import { computeTopFiles, printTopFiles, printTopFilesJson } from "./output.js";
import type { StoredReview } from "./history-store.js";
import type { ReviewComment } from "@ai-review/shared";

function makeReview(comments: ReviewComment[]): StoredReview {
  return {
    id: "test-id",
    generatedAt: new Date().toISOString(),
    model: "test-model",
    diffSource: "staged changes",
    summary: "Test review",
    comments,
    stats: {
      high: comments.filter((c) => c.severity === "high").length,
      medium: comments.filter((c) => c.severity === "medium").length,
      low: comments.filter((c) => c.severity === "low").length,
      info: comments.filter((c) => c.severity === "info").length,
      total: comments.length,
    },
  };
}

function makeComment(file: string, severity: ReviewComment["severity"]): ReviewComment {
  return { file, severity, category: "bug", message: "test issue" };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("computeTopFiles()", () => {
  it("returns empty array when no reviews", () => {
    expect(computeTopFiles([], 10)).toEqual([]);
  });

  it("returns empty array when reviews have no comments", () => {
    expect(computeTopFiles([makeReview([])], 10)).toEqual([]);
  });

  it("counts issues per file correctly", () => {
    const review = makeReview([
      makeComment("src/a.ts", "high"),
      makeComment("src/a.ts", "medium"),
      makeComment("src/b.ts", "low"),
    ]);
    const result = computeTopFiles([review], 10);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ file: "src/a.ts", total: 2, high: 1, medium: 1 });
    expect(result[1]).toMatchObject({ file: "src/b.ts", total: 1, low: 1 });
  });

  it("aggregates across multiple reviews", () => {
    const r1 = makeReview([makeComment("src/auth.ts", "high")]);
    const r2 = makeReview([
      makeComment("src/auth.ts", "medium"),
      makeComment("src/utils.ts", "low"),
    ]);
    const result = computeTopFiles([r1, r2], 10);
    const auth = result.find((e) => e.file === "src/auth.ts");
    expect(auth).toMatchObject({ total: 2, high: 1, medium: 1 });
    const utils = result.find((e) => e.file === "src/utils.ts");
    expect(utils).toMatchObject({ total: 1, low: 1 });
  });

  it("sorts by total descending", () => {
    const review = makeReview([
      makeComment("few.ts", "low"),
      makeComment("many.ts", "high"),
      makeComment("many.ts", "medium"),
      makeComment("many.ts", "low"),
    ]);
    const result = computeTopFiles([review], 10);
    expect(result[0]?.file).toBe("many.ts");
    expect(result[1]?.file).toBe("few.ts");
  });

  it("breaks ties alphabetically", () => {
    const review = makeReview([makeComment("z.ts", "low"), makeComment("a.ts", "low")]);
    const result = computeTopFiles([review], 10);
    expect(result[0]?.file).toBe("a.ts");
    expect(result[1]?.file).toBe("z.ts");
  });

  it("respects limit", () => {
    const comments = Array.from({ length: 5 }, (_, i) => makeComment(`src/file${i}.ts`, "low"));
    expect(computeTopFiles([makeReview(comments)], 3)).toHaveLength(3);
  });

  it("includes all severity counters in each entry", () => {
    const review = makeReview([
      makeComment("src/x.ts", "high"),
      makeComment("src/x.ts", "medium"),
      makeComment("src/x.ts", "low"),
      makeComment("src/x.ts", "info"),
    ]);
    const result = computeTopFiles([review], 10);
    expect(result[0]).toMatchObject({ total: 4, high: 1, medium: 1, low: 1, info: 1 });
  });
});

describe("printTopFilesJson()", () => {
  it("writes valid JSON array to stdout", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });

    const review = makeReview([makeComment("src/a.ts", "high")]);
    const entries = computeTopFiles([review], 10);
    printTopFilesJson(entries);

    expect(written).toHaveLength(1);
    const parsed = JSON.parse(written[0] ?? "") as unknown;
    expect(Array.isArray(parsed)).toBe(true);
    expect((parsed as Array<{ file: string }>)[0]?.file).toBe("src/a.ts");
  });

  it("output ends with newline", () => {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk));
      return true;
    });
    printTopFilesJson([]);
    expect(written[0] ?? "").toMatch(/\n$/);
  });
});

describe("printTopFiles()", () => {
  it("prints 'no history' message when entries are empty", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => lines.push(args.join(" ")));
    printTopFiles([]);
    expect(lines.join("\n")).toContain("No review history");
  });

  it("prints file names and issue counts", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => lines.push(args.join(" ")));

    const review = makeReview([
      makeComment("src/auth.ts", "high"),
      makeComment("src/auth.ts", "high"),
      makeComment("src/utils.ts", "low"),
    ]);
    printTopFiles(computeTopFiles([review], 10));

    const joined = lines.join("\n");
    expect(joined).toContain("src/auth.ts");
    expect(joined).toContain("src/utils.ts");
    expect(joined).toContain("2");
  });

  it("uses singular 'issue' for a single item", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => lines.push(args.join(" ")));

    const review = makeReview([makeComment("single.ts", "low")]);
    printTopFiles(computeTopFiles([review], 10));

    const joined = lines.join("\n");
    expect(joined).toMatch(/\bissue\b/);
    expect(joined).not.toMatch(/\bissues\b/);
  });
});
