import type {
  ProviderExecutionMetadata,
  ProviderExecutionRequest,
  ProviderExecutionResponse,
  ScoredModelRunResult,
} from "@/types/providerExecutionContract";

export const PROVIDER_EXECUTION_REQUEST_EXAMPLE: ProviderExecutionRequest = {
  benchmarkId: "state-trace",
  caseId: "case-basic-1",
  prompt: "Reply with one word: north",
  providerId: "openai",
  modelId: "gpt-4o-mini",
};

export const PROVIDER_EXECUTION_RESPONSE_EXAMPLE: ProviderExecutionResponse = {
  outputText: "north",
  rawResponseMetadata: {
    providerRequestId: "req_example_001",
    finishReason: "stop",
    usage: {
      promptTokens: 8,
      completionTokens: 1,
      totalTokens: 9,
    },
  },
};

export const PROVIDER_EXECUTION_METADATA_EXAMPLE: ProviderExecutionMetadata = {
  timestamp: "2026-06-29T00:00:00.000Z",
  durationMs: 142,
  providerId: "openai",
  modelId: "gpt-4o-mini",
};

export const SCORED_MODEL_RUN_RESULT_EXAMPLE: ScoredModelRunResult = {
  benchmarkId: "state-trace",
  caseId: "case-basic-1",
  prompt: "Reply with one word: north",
  outputText: "north",
  expectedAnswer: "north",
  correct: true,
  score: 1,
  metadata: PROVIDER_EXECUTION_METADATA_EXAMPLE,
};

