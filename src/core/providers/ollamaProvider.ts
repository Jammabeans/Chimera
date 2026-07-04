import type {
  ProviderExecutionMetadata,
  ProviderExecutionRawMetadata,
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/types/providerExecutionContract";

export const OLLAMA_PROVIDER_ID = "ollama" as const;

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434" as const;

export interface OllamaProviderExecutionSuccess {
  ok: true;
  response: ProviderExecutionResponse;
  metadata: ProviderExecutionMetadata;
}

export interface OllamaProviderExecutionFailure {
  ok: false;
  errorMessage: string;
  metadata: ProviderExecutionMetadata;
}

export type OllamaProviderExecutionResult = OllamaProviderExecutionSuccess | OllamaProviderExecutionFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toExecutionMetadata(request: ProviderExecutionRequest, startedAtMs: number): ProviderExecutionMetadata {
  return {
    timestamp: new Date(startedAtMs).toISOString(),
    durationMs: Date.now() - startedAtMs,
    providerId: request.providerId,
    modelId: request.modelId,
  };
}

function toRawResponseMetadata(payload: unknown): ProviderExecutionRawMetadata | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const metadata: ProviderExecutionRawMetadata = {};

  if (typeof payload.model === "string") {
    metadata.providerModel = payload.model;
  }

  if (typeof payload.created_at === "string") {
    metadata.createdAt = payload.created_at;
  }

  if (typeof payload.done === "boolean") {
    metadata.done = payload.done;
  }

  if (typeof payload.done_reason === "string") {
    metadata.doneReason = payload.done_reason;
  }

  if (typeof payload.total_duration === "number") {
    metadata.totalDuration = payload.total_duration;
  }

  if (typeof payload.eval_count === "number") {
    metadata.evalCount = payload.eval_count;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function toOllamaApiUrl(baseUrlInput?: string): string {
  const normalizedBaseUrl = (baseUrlInput ?? "").trim().replace(/\/+$/, "");
  const baseUrl = normalizedBaseUrl.length > 0 ? normalizedBaseUrl : DEFAULT_OLLAMA_BASE_URL;
  return `${baseUrl}/api/generate`;
}

function extractErrorMessage(payload: unknown): string {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error;
  }

  return "Ollama request failed.";
}

function extractOutputText(payload: unknown): string {
  if (!isRecord(payload)) {
    return "";
  }

  if (typeof payload.response === "string") {
    return payload.response;
  }

  return "";
}

export async function runOllamaProviderExecution(
  request: ProviderExecutionRequest,
  baseUrl?: string,
): Promise<OllamaProviderExecutionResult> {
  const startedAtMs = Date.now();

  if (request.providerId !== OLLAMA_PROVIDER_ID) {
    return {
      ok: false,
      errorMessage: `Unsupported provider id: ${request.providerId}.`,
      metadata: toExecutionMetadata(request, startedAtMs),
    };
  }

  const ollamaApiUrl = toOllamaApiUrl(baseUrl);

  try {
    const response = await fetch(ollamaApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.modelId,
        prompt: request.prompt,
        stream: false,
      }),
      cache: "no-store",
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = extractErrorMessage(payload);

      return {
        ok: false,
        errorMessage: `Ollama API error (${response.status}): ${errorMessage}`,
        metadata: toExecutionMetadata(request, startedAtMs),
      };
    }

    const outputText = extractOutputText(payload);

    if (outputText.length === 0) {
      return {
        ok: false,
        errorMessage: "Ollama returned no usable text output.",
        metadata: toExecutionMetadata(request, startedAtMs),
      };
    }

    return {
      ok: true,
      response: {
        outputText,
        rawResponseMetadata: toRawResponseMetadata(payload),
      },
      metadata: toExecutionMetadata(request, startedAtMs),
    };
  } catch {
    return {
      ok: false,
      errorMessage: "Ollama request failed due to a network or server error.",
      metadata: toExecutionMetadata(request, startedAtMs),
    };
  }
}

