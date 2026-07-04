import { OPENAI_PROVIDER_ID, runOpenAiProviderExecution } from "@/core/providers/openaiProvider";
import { OLLAMA_PROVIDER_ID, runOllamaProviderExecution } from "@/core/providers/ollamaProvider";
import type {
  ProviderExecutionMetadata,
  ProviderExecutionRequest,
  ScoredModelRunResult,
} from "@/types/providerExecutionContract";
import type { RuntimeBenchmarkJsonArtifact } from "@/types/runtimeBenchmarkJsonContract";

export interface ExecuteProviderBenchmarkCaseSuccess {
  ok: true;
  benchmarkName: string;
  caseTitle: string;
  scoredResult: ScoredModelRunResult;
}

export interface ExecuteProviderBenchmarkCaseFailure {
  ok: false;
  errorMessage: string;
  metadata: ProviderExecutionMetadata | null;
}

export type ExecuteProviderBenchmarkCaseResult =
  | ExecuteProviderBenchmarkCaseSuccess
  | ExecuteProviderBenchmarkCaseFailure;

export async function executeProviderBenchmarkCase(params: {
  artifact: RuntimeBenchmarkJsonArtifact;
  request: ProviderExecutionRequest;
  ollamaBaseUrl?: string;
}): Promise<ExecuteProviderBenchmarkCaseResult> {
  const { artifact, request, ollamaBaseUrl } = params;

  const benchmarkCase = artifact.cases.find((item) => item.id === request.caseId);
  if (!benchmarkCase) {
    return {
      ok: false,
      errorMessage: "Selected case was not found in runtime benchmark JSON.",
      metadata: null,
    };
  }

  if (artifact.scoringMode !== "exact-text") {
    return {
      ok: false,
      errorMessage: `Unsupported scoring mode: ${artifact.scoringMode}`,
      metadata: null,
    };
  }

  if (request.providerId !== OPENAI_PROVIDER_ID && request.providerId !== OLLAMA_PROVIDER_ID) {
    return {
      ok: false,
      errorMessage: `Unsupported provider id: ${request.providerId}.`,
      metadata: null,
    };
  }

  const executionResult =
    request.providerId === OPENAI_PROVIDER_ID
      ? await runOpenAiProviderExecution(request)
      : await runOllamaProviderExecution(request, ollamaBaseUrl);

  if (!executionResult.ok) {
    return {
      ok: false,
      errorMessage: executionResult.errorMessage,
      metadata: executionResult.metadata,
    };
  }

  const outputText = executionResult.response.outputText;
  const correct = outputText === benchmarkCase.expectedAnswer;

  return {
    ok: true,
    benchmarkName: artifact.benchmarkName,
    caseTitle: benchmarkCase.title,
    scoredResult: {
      benchmarkId: request.benchmarkId,
      caseId: request.caseId,
      prompt: request.prompt,
      outputText,
      expectedAnswer: benchmarkCase.expectedAnswer,
      correct,
      score: correct ? 1 : 0,
      metadata: executionResult.metadata,
    },
  };
}

