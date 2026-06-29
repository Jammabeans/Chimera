import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const MANUAL_RUN_HISTORY_PATH = "data/manual-run-history.json" as const;

const MAX_HISTORY_ITEMS = 2000;

export interface ManualRunHistoryEntry {
  timestamp: string;
  benchmarkId: string;
  benchmarkName: string;
  caseId: string;
  caseTitle: string;
  submittedAnswer: string;
  expectedAnswer: string;
  correct: boolean;
  score: number;
  scoringMode: string;
}

interface ManualRunHistoryReadResult {
  entries: ManualRunHistoryEntry[];
  warning: string | null;
}

interface ManualRunHistoryAppendResult {
  ok: boolean;
  warning: string | null;
}

function toAbsoluteHistoryPath(): string {
  return resolve(process.cwd(), MANUAL_RUN_HISTORY_PATH);
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

function toHistoryEntry(value: unknown): ManualRunHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.timestamp !== "string" ||
    typeof value.benchmarkId !== "string" ||
    typeof value.benchmarkName !== "string" ||
    typeof value.caseId !== "string" ||
    typeof value.caseTitle !== "string" ||
    typeof value.submittedAnswer !== "string" ||
    typeof value.expectedAnswer !== "string" ||
    typeof value.correct !== "boolean" ||
    typeof value.score !== "number" ||
    typeof value.scoringMode !== "string"
  ) {
    return null;
  }

  return {
    timestamp: value.timestamp,
    benchmarkId: value.benchmarkId,
    benchmarkName: value.benchmarkName,
    caseId: value.caseId,
    caseTitle: value.caseTitle,
    submittedAnswer: value.submittedAnswer,
    expectedAnswer: value.expectedAnswer,
    correct: value.correct,
    score: value.score,
    scoringMode: value.scoringMode,
  };
}

function byMostRecentTimestamp(a: ManualRunHistoryEntry, b: ManualRunHistoryEntry): number {
  return Date.parse(b.timestamp) - Date.parse(a.timestamp);
}

export function readManualRunHistory(): ManualRunHistoryReadResult {
  try {
    ensureHistoryFileExists();
    const raw = readFileSync(toAbsoluteHistoryPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return {
        entries: [],
        warning: "Manual run history file was not an array. Showing no history.",
      };
    }

    const entries = parsed
      .map((item) => toHistoryEntry(item))
      .filter((item): item is ManualRunHistoryEntry => item !== null)
      .sort(byMostRecentTimestamp);

    return {
      entries,
      warning: null,
    };
  } catch {
    return {
      entries: [],
      warning: "Manual run history could not be read. Showing no history.",
    };
  }
}

export function readRecentManualRunsForBenchmark(
  benchmarkId: string,
  limit = 5,
): ManualRunHistoryReadResult {
  const result = readManualRunHistory();

  return {
    entries: result.entries.filter((entry) => entry.benchmarkId === benchmarkId).slice(0, limit),
    warning: result.warning,
  };
}

export function appendManualRunHistory(entry: ManualRunHistoryEntry): ManualRunHistoryAppendResult {
  try {
    ensureHistoryFileExists();

    const readResult = readManualRunHistory();
    const nextEntries = [entry, ...readResult.entries].slice(0, MAX_HISTORY_ITEMS);

    writeFileSync(toAbsoluteHistoryPath(), `${JSON.stringify(nextEntries, null, 2)}\n`, "utf8");

    return {
      ok: true,
      warning: readResult.warning,
    };
  } catch {
    return {
      ok: false,
      warning: "Manual run history could not be written. Score result is still shown.",
    };
  }
}

