import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { RuntimeBenchmarkJsonArtifact } from "@/types/runtimeBenchmarkJsonContract";

import {
  RUNTIME_BENCHMARK_JSON_FILENAME,
  type RuntimeBenchmarkJsonScoringMode,
} from "@/types/runtimeBenchmarkJsonContract";

import { getBenchmarkById } from "./getBenchmarkById";
import { getCacheInspection } from "./getCacheInspection";

type RuntimeBenchmarkCacheStateStatus =
  | "benchmark-not-found"
  | "runtime-json-missing"
  | "runtime-json-invalid"
  | "runtime-json-valid";

export interface RuntimeBenchmarkCacheState {
  benchmarkId: string;
  runtimeJsonPath: string;
  status: RuntimeBenchmarkCacheStateStatus;
  found: boolean;
  valid: boolean;
  validationErrors: string[];
  artifact: RuntimeBenchmarkJsonArtifact | null;
}

const SUPPORTED_SCORING_MODE: RuntimeBenchmarkJsonScoringMode = "exact-text";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRequiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  return typeof value === "string" ? value.trim() : "";
}

function validateRuntimeArtifactTopLevel(parsed: unknown): string[] {
  if (!isRecord(parsed)) {
    return ["Runtime benchmark artifact root must be a JSON object."];
  }

  const errors: string[] = [];

  if (getRequiredString(parsed, "benchmarkId").length === 0) {
    errors.push("benchmarkId is required.");
  }

  if (getRequiredString(parsed, "benchmarkName").length === 0) {
    errors.push("benchmarkName is required.");
  }

  if (!Array.isArray(parsed.cases)) {
    errors.push("cases must be an array.");
  }

  if (parsed.scoringMode !== SUPPORTED_SCORING_MODE) {
    errors.push('scoringMode must be "exact-text".');
  }

  return errors;
}

function getRuntimeJsonPathForBenchmark(benchmarkId: string): string {
  const cacheItem = getCacheInspection().find((item) => item.benchmarkId === benchmarkId);
  const cachePath = cacheItem?.localCachePath ?? `benchmarks-cache/${benchmarkId}`;
  return `${cachePath}/${RUNTIME_BENCHMARK_JSON_FILENAME}`;
}

export function getRuntimeBenchmarkJsonFromCache(benchmarkId: string): RuntimeBenchmarkCacheState {
  const benchmark = getBenchmarkById(benchmarkId);
  const runtimeJsonPath = getRuntimeJsonPathForBenchmark(benchmarkId);

  if (!benchmark) {
    return {
      benchmarkId,
      runtimeJsonPath,
      status: "benchmark-not-found",
      found: false,
      valid: false,
      validationErrors: ["Benchmark does not exist in registry."],
      artifact: null,
    };
  }

  const runtimeJsonAbsolutePath = resolve(process.cwd(), runtimeJsonPath);

  if (!existsSync(runtimeJsonAbsolutePath)) {
    return {
      benchmarkId,
      runtimeJsonPath,
      status: "runtime-json-missing",
      found: false,
      valid: false,
      validationErrors: ["runtime-benchmark.json was not found in benchmark cache root."],
      artifact: null,
    };
  }

  let parsed: unknown;

  try {
    const runtimeJsonContent = readFileSync(runtimeJsonAbsolutePath, "utf8");
    parsed = JSON.parse(runtimeJsonContent);
  } catch {
    return {
      benchmarkId,
      runtimeJsonPath,
      status: "runtime-json-invalid",
      found: true,
      valid: false,
      validationErrors: ["runtime-benchmark.json is not valid JSON."],
      artifact: null,
    };
  }

  const validationErrors = validateRuntimeArtifactTopLevel(parsed);

  if (validationErrors.length > 0) {
    return {
      benchmarkId,
      runtimeJsonPath,
      status: "runtime-json-invalid",
      found: true,
      valid: false,
      validationErrors,
      artifact: null,
    };
  }

  return {
    benchmarkId,
    runtimeJsonPath,
    status: "runtime-json-valid",
    found: true,
    valid: true,
    validationErrors: [],
    artifact: parsed as RuntimeBenchmarkJsonArtifact,
  };
}

