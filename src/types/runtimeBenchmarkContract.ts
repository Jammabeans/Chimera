import type { ExternalBenchmarkManifest } from "@/types/externalBenchmarkContract";

export type RuntimeBenchmarkCaseMetadataValue = string | number | boolean | null;

export type RuntimeBenchmarkCaseMetadata = Record<string, RuntimeBenchmarkCaseMetadataValue>;

export interface RuntimeBenchmarkCase {
  id: string;
  levelId: string;
  title: string;
  prompt: string;
  metadata?: RuntimeBenchmarkCaseMetadata;
}

export interface RuntimeBenchmarkAnswerSubmission {
  answerText: string;
}

export interface RuntimeBenchmarkScoreResult {
  correct: boolean;
  score: number;
  expectedAnswer: string;
  message: string;
}

export interface RuntimeBenchmarkModule {
  manifest: ExternalBenchmarkManifest;
  cases: RuntimeBenchmarkCase[];
  scoreAnswer: (caseId: string, answerText: string) => RuntimeBenchmarkScoreResult;
}

