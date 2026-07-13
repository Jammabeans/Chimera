"use server";

import { generateStatefulToolTaskFromSeed } from "@/repair_lab/environments/stateful_tools";
import {
  runOpenAiStatefulToolTask,
  type OpenAiStatefulToolsRunResult,
} from "@/repair_lab/runners/openaiStatefulToolsRunner";

const ALLOWED_SEEDS = [0, 1, 2, 3] as const;

export interface RepairLabSmokeActionState {
  selectedSeed: number;
  status: "idle" | "validation_error" | "ok" | "error";
  message: string;
  runResult: OpenAiStatefulToolsRunResult | null;
}

function toFormStringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function parseSelectedSeed(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return ALLOWED_SEEDS.includes(parsed as (typeof ALLOWED_SEEDS)[number]) ? parsed : null;
}

export async function runRepairLabSmokeAction(
  _previousState: RepairLabSmokeActionState,
  formData: FormData,
): Promise<RepairLabSmokeActionState> {
  const selectedSeedInput = toFormStringValue(formData.get("seed"));
  const selectedSeed = parseSelectedSeed(selectedSeedInput);

  if (selectedSeed === null) {
    return {
      selectedSeed: 0,
      status: "validation_error",
      message: "Invalid seed. Allowed values are 0, 1, 2, or 3.",
      runResult: null,
    };
  }

  try {
    const task = generateStatefulToolTaskFromSeed(selectedSeed);
    const runResult = await runOpenAiStatefulToolTask(task);

    return {
      selectedSeed,
      status: "ok",
      message: "",
      runResult,
    };
  } catch {
    return {
      selectedSeed,
      status: "error",
      message: "Unexpected server error while running smoke test. Check server logs and retry.",
      runResult: null,
    };
  }
}

