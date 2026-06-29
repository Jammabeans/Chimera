import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const MODEL_RUN_HISTORY_PATH = "data/model-run-history.json" as const;

const MAX_HISTORY_ITEMS = 2000;

export interface ModelRunHistoryEntry {
  timestamp: string;
  benchmarkId: string;
  benchmarkName: string;
  caseId: string;
  caseTitle: string;
  providerId: string;
  modelId: string;
  prompt: string;
  outputText: string;
  expectedAnswer: string;
  correct: boolean;
  score: number;
  durationMs: number;
}

interface ModelRunHistoryReadResult {
  entries: ModelRunHistoryEntry[];
  warning: string | null;
}

interface ModelRunHistoryAppendResult {
  ok: boolean;
  warning: string | null;
}

function toAbsoluteHistoryPath(): string {
  return resolve(process.cwd(), MODEL_RUN_HISTORY_PATH);
}

function ensureHistoryFileExists(): void {
  const absolutePath = toAbsoluteHistoryPath();
  const historyDir = dirname(absolutePath);

  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }

  if (!existsSync(absolutePath)) {
    writeFileSync(absolutePath, "[]\n", "utf8");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toHistoryEntry(value: unknown): ModelRunHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.timestamp !== "string" ||
    typeof value.benchmarkId !== "string" ||
    typeof value.benchmarkName !== "string" ||
    typeof value.caseId !== "string" ||
    typeof value.caseTitle !== "string" ||
    typeof value.providerId !== "string" ||
    typeof value.modelId !== "string" ||
    typeof value.prompt !== "string" ||
    typeof value.outputText !== "string" ||
    typeof value.expectedAnswer !== "string" ||
    typeof value.correct !== "boolean" ||
    typeof value.score !== "number" ||
    typeof value.durationMs !== "number"
  ) {
    return null;
  }

  return {
    timestamp: value.timestamp,
    benchmarkId: value.benchmarkId,
    benchmarkName: value.benchmarkName,
    caseId: value.caseId,
    caseTitle: value.caseTitle,
    providerId: value.providerId,
    modelId: value.modelId,
    prompt: value.prompt,
    outputText: value.outputText,
    expectedAnswer: value.expectedAnswer,
    correct: value.correct,
    score: value.score,
    durationMs: value.durationMs,
  };
}

function byMostRecentTimestamp(a: ModelRunHistoryEntry, b: ModelRunHistoryEntry): number {
  return Date.parse(b.timestamp) - Date.parse(a.timestamp);
}

export function readModelRunHistory(): ModelRunHistoryReadResult {
  try {
    ensureHistoryFileExists();
    const raw = readFileSync(toAbsoluteHistoryPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return {
        entries: [],
        warning: "Model run history file was not an array. Showing no model run history.",
      };
    }

    const entries = parsed
      .map((item) => toHistoryEntry(item))
      .filter((item): item is ModelRunHistoryEntry => item !== null)
      .sort(byMostRecentTimestamp);

    return {
      entries,
      warning: null,
    };
  } catch {
    return {
      entries: [],
      warning: "Model run history could not be read. Showing no model run history.",
    };
  }
}

export function readRecentModelRunsForBenchmark(benchmarkId: string, limit = 5): ModelRunHistoryReadResult {
  const result = readModelRunHistory();

  return {
    entries: result.entries.filter((entry) => entry.benchmarkId === benchmarkId).slice(0, limit),
    warning: result.warning,
  };
}

export function appendModelRunHistory(entry: ModelRunHistoryEntry): ModelRunHistoryAppendResult {
  try {
    ensureHistoryFileExists();

    const readResult = readModelRunHistory();
    const nextEntries = [entry, ...readResult.entries].slice(0, MAX_HISTORY_ITEMS);

    writeFileSync(toAbsoluteHistoryPath(), `${JSON.stringify(nextEntries, null, 2)}\n`, "utf8");

    return {
      ok: true,
      warning: readResult.warning,
    };
  } catch {
    return {
      ok: false,
      warning: "Model run history could not be written. Model run result is still shown.",
    };
  }
}

