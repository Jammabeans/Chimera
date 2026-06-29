import type {
  ProviderExecutionMetadata,
  ProviderExecutionRawMetadata,
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/types/providerExecutionContract";

export const OPENAI_PROVIDER_ID = "openai" as const;

const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses" as const;

export interface OpenAiProviderExecutionSuccess {
  ok: true;
  response: ProviderExecutionResponse;
  metadata: ProviderExecutionMetadata;
}

export interface OpenAiProviderExecutionFailure {
  ok: false;
  errorMessage: string;
  metadata: ProviderExecutionMetadata;
}

export type OpenAiProviderExecutionResult = OpenAiProviderExecutionSuccess | OpenAiProviderExecutionFailure;

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

  if (typeof payload.id === "string") {
    metadata.providerRequestId = payload.id;
  }

  if (typeof payload.model === "string") {
    metadata.providerModel = payload.model;
  }

  if (typeof payload.status === "string") {
    metadata.providerStatus = payload.status;
  }

  if (isRecord(payload.usage)) {
    metadata.usage = payload.usage as ProviderExecutionRawMetadata;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function extractErrorMessage(payload: unknown): string {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return "OpenAI request failed.";
}

function extractOutputText(payload: unknown): string {
  if (!isRecord(payload)) {
    return "";
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (Array.isArray(payload.output)) {
    const chunks: string[] = [];

    for (const outputItem of payload.output) {
      if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
        continue;
      }

      for (const contentItem of outputItem.content) {
        if (!isRecord(contentItem)) {
          continue;
        }

        if (contentItem.type === "output_text" && typeof contentItem.text === "string") {
          chunks.push(contentItem.text);
        }
      }
    }

    if (chunks.length > 0) {
      return chunks.join("\n").trim();
    }
  }

  return "";
}

export async function runOpenAiProviderExecution(
  request: ProviderExecutionRequest,
): Promise<OpenAiProviderExecutionResult> {
  const startedAtMs = Date.now();
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";

  if (request.providerId !== OPENAI_PROVIDER_ID) {
    return {
      ok: false,
      errorMessage: `Unsupported provider id: ${request.providerId}.`,
      metadata: toExecutionMetadata(request, startedAtMs),
    };
  }

  if (apiKey.length === 0) {
    return {
      ok: false,
      errorMessage: "OPENAI_API_KEY is missing. Set it in your environment before running model execution.",
      metadata: toExecutionMetadata(request, startedAtMs),
    };
  }

  try {
    const response = await fetch(OPENAI_RESPONSES_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.modelId,
        input: request.prompt,
      }),
      cache: "no-store",
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage = extractErrorMessage(payload);

      return {
        ok: false,
        errorMessage: `OpenAI API error (${response.status}): ${errorMessage}`,
        metadata: toExecutionMetadata(request, startedAtMs),
      };
    }

    const outputText = extractOutputText(payload);

    if (outputText.trim().length === 0) {
      return {
        ok: false,
        errorMessage: "OpenAI returned no usable text output.",
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
      errorMessage: "OpenAI request failed due to a network or server error.",
      metadata: toExecutionMetadata(request, startedAtMs),
    };
  }
}

