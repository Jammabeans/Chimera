/**
 * Provider/model execution contract (v1).
 *
 * This contract is used by Chimera Core to describe how a benchmark prompt is
 * sent to a model provider and how the result is returned/scored.
 *
 * Scope notes for v1:
 * - types/docs only
 * - no provider SDK/API calls
 * - no environment variable handling
 * - no provider UI wiring
 */

export type BenchmarkProviderId = string;

export type BenchmarkModelId = string;

export type ProviderExecutionRawMetadataValue =
  | string
  | number
  | boolean
  | null
  | ProviderExecutionRawMetadata
  | ProviderExecutionRawMetadata[];

export interface ProviderExecutionRawMetadata {
  [key: string]: ProviderExecutionRawMetadataValue;
}

export interface ProviderExecutionRequest {
  benchmarkId: string;
  caseId: string;
  prompt: string;
  providerId: BenchmarkProviderId;
  modelId: BenchmarkModelId;
}

export interface ProviderExecutionResponse {
  outputText: string;
  rawResponseMetadata?: ProviderExecutionRawMetadata;
}

export interface ProviderExecutionMetadata {
  timestamp: string;
  durationMs: number;
  providerId: BenchmarkProviderId;
  modelId: BenchmarkModelId;
}

export interface ScoredModelRunResult {
  benchmarkId: string;
  caseId: string;
  prompt: string;
  outputText: string;
  expectedAnswer: string;
  correct: boolean;
  score: number;
  metadata: ProviderExecutionMetadata;
}

