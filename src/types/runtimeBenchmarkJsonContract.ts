/**
 * Static runtime benchmark JSON contract (v1).
 *
 * This contract is for on-disk JSON artifacts (runtime-benchmark.json),
 * and is intentionally separate from the in-memory runtime module contract.
 */

export const RUNTIME_BENCHMARK_JSON_FILENAME = "runtime-benchmark.json" as const;

export type RuntimeBenchmarkJsonScoringMode = "exact-text";

export type RuntimeBenchmarkJsonCaseMetadataValue = string | number | boolean | null;

export type RuntimeBenchmarkJsonCaseMetadata = Record<string, RuntimeBenchmarkJsonCaseMetadataValue>;

export interface RuntimeBenchmarkJsonCase {
  id: string;
  levelId: string;
  title: string;
  prompt: string;
  expectedAnswer: string;
  metadata?: RuntimeBenchmarkJsonCaseMetadata;
}

export interface RuntimeBenchmarkJsonArtifact {
  benchmarkId: string;
  benchmarkName: string;
  scoringMode: RuntimeBenchmarkJsonScoringMode;
  cases: RuntimeBenchmarkJsonCase[];
}

