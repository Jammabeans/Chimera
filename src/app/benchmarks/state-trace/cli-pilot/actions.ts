"use server";

import {
  extractPromptFromStateTraceGeneratedInstance,
  runStateTraceCliGenerate,
  runStateTraceCliScore,
} from "@/core/runner/runStateTraceCachedCliPilot";

export interface GenerateCliPilotState {
  seed: string;
  stepCount: string;
  status: "idle" | "ok" | "error";
  error: string;
  generatedPrompt: string;
  generatedInstanceJson: string;
}

export interface ScoreCliPilotState {
  responseText: string;
  status: "idle" | "ok" | "error";
  error: string;
  scoreResultJson: string;
}

function toFormStringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function parsePositiveInteger(rawValue: string): number | null {
  if (!/^[0-9]+$/.test(rawValue.trim())) {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function generateStateTraceInstanceAction(
  _previousState: GenerateCliPilotState,
  formData: FormData,
): Promise<GenerateCliPilotState> {
  const seedInput = toFormStringValue(formData.get("seed")).trim();
  const stepCountInput = toFormStringValue(formData.get("stepCount")).trim();

  const seed = parsePositiveInteger(seedInput);
  const stepCount = parsePositiveInteger(stepCountInput);

  if (seed === null || stepCount === null) {
    return {
      seed: seedInput,
      stepCount: stepCountInput,
      status: "error",
      error: "Seed and step count must be positive integers.",
      generatedPrompt: "",
      generatedInstanceJson: "",
    };
  }

  const generateResult = runStateTraceCliGenerate({ seed, stepCount });
  if (!generateResult.ok) {
    return {
      seed: seedInput,
      stepCount: stepCountInput,
      status: "error",
      error: generateResult.message,
      generatedPrompt: "",
      generatedInstanceJson: "",
    };
  }

  const generatedPayload = generateResult.data;
  const instancePayload =
    typeof generatedPayload === "object" && generatedPayload !== null && "instance" in generatedPayload
      ? (generatedPayload as Record<string, unknown>).instance
      : generatedPayload;

  return {
    seed: seedInput,
    stepCount: stepCountInput,
    status: "ok",
    error: "",
    generatedPrompt: extractPromptFromStateTraceGeneratedInstance(generatedPayload),
    generatedInstanceJson: JSON.stringify(instancePayload),
  };
}

export async function scoreStateTraceResponseAction(
  _previousState: ScoreCliPilotState,
  formData: FormData,
): Promise<ScoreCliPilotState> {
  const responseText = toFormStringValue(formData.get("responseText"));
  const generatedInstanceJson = toFormStringValue(formData.get("generatedInstanceJson"));

  if (generatedInstanceJson.trim().length === 0) {
    return {
      responseText,
      status: "error",
      error: "No generated instance is present. Generate an instance first.",
      scoreResultJson: "",
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
    };
  }

  const scoreResult = runStateTraceCliScore({
    instance: parsedInstance,
    response: responseText,
  });

  if (!scoreResult.ok) {
    return {
      responseText,
      status: "error",
      error: scoreResult.message,
      scoreResultJson: "",
    };
  }

  return {
    responseText,
    status: "ok",
    error: "",
    scoreResultJson: JSON.stringify(scoreResult.data),
  };
}

