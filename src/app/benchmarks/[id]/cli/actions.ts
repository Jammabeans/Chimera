"use server";

import {
  parseBenchmarkCliDescribeMetadata,
  runBenchmarkCliAnalyze,
  runBenchmarkCliDescribe,
  runBenchmarkCliGenerate,
  runBenchmarkCliScore,
  type BenchmarkCliDescribeField,
} from "@/core/runner/runBenchmarkCachedCli";

export interface GenericCliGenerateState {
  benchmarkId: string;
  status: "idle" | "ok" | "error";
  error: string;
  generatedPrompt: string;
  generatedInstanceJson: string;
  generatedResultJson: string;
}

export interface GenericCliScoreState {
  responseText: string;
  status: "idle" | "ok" | "error";
  error: string;
  scoreResultJson: string;
  analysisStatus: "idle" | "ok" | "error";
  analysisResultJson: string;
  analysisError: string;
}

function toFormStringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function toFieldFormName(fieldName: string): string {
  return `generateField__${fieldName}`;
}

function extractPromptFromGeneratePayload(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }

  const record = payload as Record<string, unknown>;
  const instance = record.instance;
  if (typeof instance !== "object" || instance === null) {
    return "";
  }

  const instanceRecord = instance as Record<string, unknown>;
  const instancePrompt = instanceRecord.prompt;
  if (typeof instancePrompt === "string" && instancePrompt.trim().length > 0) {
    return instancePrompt;
  }

  return "";
}

function extractInstancePayload(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  if ("instance" in record) {
    return record.instance;
  }

  return payload;
}

function parseIntegerValue(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!/^-?[0-9]+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}

function buildGeneratePayloadFromFields(params: {
  formData: FormData;
  fields: BenchmarkCliDescribeField[];
}): { ok: true; payload: { seed: string; params: Record<string, unknown> } } | { ok: false; message: string } {
  let seed = "";
  const generateParams: Record<string, unknown> = {};

  for (const field of params.fields) {
    const formName = toFieldFormName(field.name);
    const rawValue = toFormStringValue(params.formData.get(formName));

    if (field.type === "boolean") {
      const checked = rawValue === "on" || rawValue === "true";

      if (!checked && field.required && field.defaultValue === undefined) {
        return {
          ok: false,
          message: `Required boolean field "${field.name}" must be enabled.`,
        };
      }

      if (!checked && field.defaultValue !== undefined) {
        if (field.name === "seed") {
          seed = String(field.defaultValue);
        } else {
          generateParams[field.name] = Boolean(field.defaultValue);
        }
      } else {
        if (field.name === "seed") {
          seed = String(checked);
        } else {
          generateParams[field.name] = checked;
        }
      }

      continue;
    }

    const trimmedValue = rawValue.trim();
    if (trimmedValue.length === 0) {
      if (field.defaultValue !== undefined) {
        if (field.name === "seed") {
          seed = String(field.defaultValue);
        } else {
          generateParams[field.name] = field.defaultValue;
        }
        continue;
      }

      if (field.required) {
        return {
          ok: false,
          message: `Required field "${field.name}" is missing.`,
        };
      }

      continue;
    }

    if (field.type === "string") {
      if (field.name === "seed") {
        seed = trimmedValue;
      } else {
        generateParams[field.name] = trimmedValue;
      }
      continue;
    }

    if (field.type === "integer") {
      const parsedInteger = parseIntegerValue(trimmedValue);
      if (parsedInteger === null) {
        return {
          ok: false,
          message: `Field "${field.name}" must be a valid integer.`,
        };
      }

      if (field.min !== null && parsedInteger < field.min) {
        return {
          ok: false,
          message: `Field "${field.name}" must be >= ${field.min}.`,
        };
      }

      if (field.max !== null && parsedInteger > field.max) {
        return {
          ok: false,
          message: `Field "${field.name}" must be <= ${field.max}.`,
        };
      }

      if (field.name === "seed") {
        seed = String(parsedInteger);
      } else {
        generateParams[field.name] = parsedInteger;
      }
      continue;
    }

    if (field.type === "select") {
      if (field.options.length > 0 && !field.options.some((option) => option.value === trimmedValue)) {
        return {
          ok: false,
          message: `Field "${field.name}" has unsupported selection value.`,
        };
      }

      if (field.name === "seed") {
        seed = trimmedValue;
      } else {
        generateParams[field.name] = trimmedValue;
      }
      continue;
    }
  }

  return {
    ok: true,
    payload: {
      seed,
      params: generateParams,
    },
  };
}

export async function generateBenchmarkCliInstanceAction(
  _previousState: GenericCliGenerateState,
  formData: FormData,
): Promise<GenericCliGenerateState> {
  const benchmarkId = toFormStringValue(formData.get("benchmarkId")).trim();

  const describeResult = runBenchmarkCliDescribe(benchmarkId);
  if (!describeResult.ok) {
    return {
      benchmarkId,
      status: "error",
      error: describeResult.message,
      generatedPrompt: "",
      generatedInstanceJson: "",
      generatedResultJson: "",
    };
  }

  const describeMetadata = parseBenchmarkCliDescribeMetadata(benchmarkId, describeResult.data);
  if (!describeMetadata.supportsGenerate) {
    return {
      benchmarkId,
      status: "error",
      error: "This benchmark CLI does not advertise support for the generate command.",
      generatedPrompt: "",
      generatedInstanceJson: "",
      generatedResultJson: "",
    };
  }

  const generatePayloadResult = buildGeneratePayloadFromFields({
    formData,
    fields: describeMetadata.generateFields,
  });

  if (!generatePayloadResult.ok) {
    return {
      benchmarkId,
      status: "error",
      error: generatePayloadResult.message,
      generatedPrompt: "",
      generatedInstanceJson: "",
      generatedResultJson: "",
    };
  }

  const generateResult = runBenchmarkCliGenerate(benchmarkId, generatePayloadResult.payload);
  if (!generateResult.ok) {
    return {
      benchmarkId,
      status: "error",
      error: generateResult.message,
      generatedPrompt: "",
      generatedInstanceJson: "",
      generatedResultJson: "",
    };
  }

  return {
    benchmarkId,
    status: "ok",
    error: "",
    generatedPrompt: extractPromptFromGeneratePayload(generateResult.data),
    generatedInstanceJson: JSON.stringify(extractInstancePayload(generateResult.data)),
    generatedResultJson: JSON.stringify(generateResult.data),
  };
}

export async function scoreBenchmarkCliResponseAction(
  _previousState: GenericCliScoreState,
  formData: FormData,
): Promise<GenericCliScoreState> {
  const benchmarkId = toFormStringValue(formData.get("benchmarkId")).trim();
  const responseText = toFormStringValue(formData.get("responseText"));
  const generatedInstanceJson = toFormStringValue(formData.get("generatedInstanceJson"));

  if (generatedInstanceJson.trim().length === 0) {
    return {
      responseText,
      status: "error",
      error: "No generated instance is present. Generate an instance first.",
      scoreResultJson: "",
      analysisStatus: "idle",
      analysisResultJson: "",
      analysisError: "",
    };
  }

  let parsedInstance: unknown;
  try {
    parsedInstance = JSON.parse(generatedInstanceJson);
  } catch {
    return {
      responseText,
      status: "error",
      error: "Generated instance JSON is invalid. Generate a fresh instance and retry.",
      scoreResultJson: "",
      analysisStatus: "idle",
      analysisResultJson: "",
      analysisError: "",
    };
  }

  const scoreResult = runBenchmarkCliScore(benchmarkId, {
    instance: parsedInstance,
    responseText,
  });

  if (!scoreResult.ok) {
    return {
      responseText,
      status: "error",
      error: scoreResult.message,
      scoreResultJson: "",
      analysisStatus: "idle",
      analysisResultJson: "",
      analysisError: "",
    };
  }

  const describeResult = runBenchmarkCliDescribe(benchmarkId);
  const describeMetadata = describeResult.ok
    ? parseBenchmarkCliDescribeMetadata(benchmarkId, describeResult.data)
    : null;
  const shouldRunAnalyze = describeMetadata?.supportsAnalyze ?? false;

  if (!shouldRunAnalyze) {
    return {
      responseText,
      status: "ok",
      error: "",
      scoreResultJson: JSON.stringify(scoreResult.data),
      analysisStatus: "idle",
      analysisResultJson: "",
      analysisError: "",
    };
  }

  const analyzeResult = runBenchmarkCliAnalyze(benchmarkId, {
    instance: parsedInstance,
    responseText,
  });

  if (!analyzeResult.ok) {
    return {
      responseText,
      status: "ok",
      error: "",
      scoreResultJson: JSON.stringify(scoreResult.data),
      analysisStatus: "error",
      analysisResultJson: "",
      analysisError: analyzeResult.message,
    };
  }

  return {
    responseText,
    status: "ok",
    error: "",
    scoreResultJson: JSON.stringify(scoreResult.data),
    analysisStatus: "ok",
    analysisResultJson: JSON.stringify(analyzeResult.data),
    analysisError: "",
  };
}
