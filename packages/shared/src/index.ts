export type ReviewSeverity = "high" | "medium" | "low" | "info";

export interface ReviewComment {
  file: string;
  line?: number;
  severity: ReviewSeverity;
  category: "bug" | "security" | "performance" | "maintainability" | "style";
  message: string;
  suggestion?: string;
}

export interface ReviewReport {
  generatedAt: string;
  model: string;
  diffSource: string;
  summary: string;
  comments: ReviewComment[];
  stats: {
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  /** sha256 of provider+model+diff, used to skip redundant AI calls for an unchanged diff. */
  diffHash?: string;
}

export interface ReviewOptions {
  model: string;
  host: string;
  provider: "ollama" | "lmstudio" | "anthropic";
  maxTokens?: number;
  apiKey?: string;
}
