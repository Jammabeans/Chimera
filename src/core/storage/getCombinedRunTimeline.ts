import {
  type ManualRunHistoryEntry,
  readManualRunHistory,
} from "@/core/storage/manualRunHistory";
import {
  type ModelRunHistoryEntry,
  readModelRunHistory,
} from "@/core/storage/modelRunHistory";

export type CombinedRunType = "manual" | "model";

interface CombinedRunTimelineBaseEntry {
  runType: CombinedRunType;
  timestamp: string;
  benchmarkId: string;
  benchmarkName: string;
  caseId: string;
  caseTitle: string;
  expectedAnswer: string;
  correct: boolean;
  score: number;
}

export interface CombinedManualRunTimelineEntry extends CombinedRunTimelineBaseEntry {
  runType: "manual";
  submittedAnswer: string;
  scoringMode: string;
}

export interface CombinedModelRunTimelineEntry extends CombinedRunTimelineBaseEntry {
  runType: "model";
  providerId: string;
  modelId: string;
  outputText: string;
  durationMs: number;
}

export type CombinedRunTimelineEntry = CombinedManualRunTimelineEntry | CombinedModelRunTimelineEntry;

interface CombinedRunTimelineState {
  entries: CombinedRunTimelineEntry[];
  warnings: string[];
}

function normalizeManualEntry(entry: ManualRunHistoryEntry): CombinedManualRunTimelineEntry {
  return {
    runType: "manual",
    timestamp: entry.timestamp,
    benchmarkId: entry.benchmarkId,
    benchmarkName: entry.benchmarkName,
    caseId: entry.caseId,
    caseTitle: entry.caseTitle,
    expectedAnswer: entry.expectedAnswer,
    correct: entry.correct,
    score: entry.score,
    submittedAnswer: entry.submittedAnswer,
    scoringMode: entry.scoringMode,
  };
}

function normalizeModelEntry(entry: ModelRunHistoryEntry): CombinedModelRunTimelineEntry {
  return {
    runType: "model",
    timestamp: entry.timestamp,
    benchmarkId: entry.benchmarkId,
    benchmarkName: entry.benchmarkName,
    caseId: entry.caseId,
    caseTitle: entry.caseTitle,
    expectedAnswer: entry.expectedAnswer,
    correct: entry.correct,
    score: entry.score,
    providerId: entry.providerId,
    modelId: entry.modelId,
    outputText: entry.outputText,
    durationMs: entry.durationMs,
  };
}

function byMostRecentTimestamp(a: CombinedRunTimelineEntry, b: CombinedRunTimelineEntry): number {
  const timestampA = Date.parse(a.timestamp);
  const timestampB = Date.parse(b.timestamp);

  if (Number.isNaN(timestampA) && Number.isNaN(timestampB)) {
    return 0;
  }

  if (Number.isNaN(timestampA)) {
    return 1;
  }

  if (Number.isNaN(timestampB)) {
    return -1;
  }

  return timestampB - timestampA;
}

export function getCombinedRunTimeline(): CombinedRunTimelineState {
  const manualHistory = readManualRunHistory();
  const modelHistory = readModelRunHistory();

  const warnings = [manualHistory.warning, modelHistory.warning].filter(
    (item): item is string => Boolean(item),
  );

  const entries = [
    ...manualHistory.entries.map(normalizeManualEntry),
    ...modelHistory.entries.map(normalizeModelEntry),
  ].sort(byMostRecentTimestamp);

  return {
    entries,
    warnings,
  };
}

