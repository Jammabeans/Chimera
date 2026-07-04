import type { BenchmarkCacheStatus } from "./getCacheInspection";

import { getCacheInspection } from "./getCacheInspection";
import { getRuntimeBenchmarkJsonFromCache } from "./getRuntimeBenchmarkJsonFromCache";

import { OLLAMA_PROVIDER_ID } from "@/core/providers/ollamaProvider";

const SUPPORTED_PROVIDER_IDS = [OLLAMA_PROVIDER_ID] as const;

export interface BenchmarkReadinessItem {
  benchmarkId: string;
  benchmarkName: string;
  existsInRegistry: true;
  cacheStatus: BenchmarkCacheStatus;
  cacheExists: boolean;
  manifestExists: boolean;
  manifestValid: boolean;
  runtimeBenchmarkArtifactExists: boolean;
  runtimeBenchmarkArtifactValid: boolean;
  requiredOpenAiConfigPresent: boolean;
  ollamaProviderSupported: boolean;
  manualRunReady: boolean;
  openAiRunReady: boolean;
  ollamaRunReady: boolean;
  manualRunReadinessReason: string;
  openAiRunReadinessReason: string;
  ollamaRunReadinessReason: string;
  ready: boolean;
  readinessLabel: "Ready" | "Not ready";
  readinessMessage: string;
}

export interface BenchmarkReadinessSummary {
  totalCount: number;
  readyCount: number;
  notReadyCount: number;
}

export interface BenchmarkReadinessReport {
  summary: BenchmarkReadinessSummary;
  benchmarks: BenchmarkReadinessItem[];
}

function getReadinessMessage(status: BenchmarkCacheStatus, validationErrors: string[]): string {
  if (status === "manifest-valid") {
    return "Registry entry, cache directory, and root manifest are present and valid.";
  }

  if (status === "cache-missing") {
    return "Registry entry exists, but cache directory is missing.";
  }

  if (status === "manifest-missing") {
    return "Cache directory exists, but root benchmark.manifest.json is missing.";
  }

  const firstError = validationErrors[0];
  if (firstError) {
    return `Manifest exists but is invalid: ${firstError}`;
  }

  return "Manifest exists but is invalid.";
}

function getManualRunReadinessReason(params: {
  runtimeStatus: "benchmark-not-found" | "runtime-json-missing" | "runtime-json-invalid" | "runtime-json-valid";
  runtimeValidationErrors: string[];
}): string {
  const { runtimeStatus, runtimeValidationErrors } = params;

  if (runtimeStatus === "runtime-json-valid") {
    return "Runtime benchmark artifact exists and is valid.";
  }

  if (runtimeStatus === "runtime-json-missing") {
    return "runtime-benchmark.json is missing from benchmark cache root.";
  }

  if (runtimeStatus === "runtime-json-invalid") {
    const firstError = runtimeValidationErrors[0];
    return firstError
      ? `runtime-benchmark.json is invalid: ${firstError}`
      : "runtime-benchmark.json is invalid.";
  }

  return "Benchmark is not present in registry.";
}

function getOpenAiRunReadinessReason(params: {
  manualRunReady: boolean;
  manualRunReadinessReason: string;
  requiredOpenAiConfigPresent: boolean;
}): string {
  const { manualRunReady, manualRunReadinessReason, requiredOpenAiConfigPresent } = params;

  if (!manualRunReady) {
    return `Manual run is not ready: ${manualRunReadinessReason}`;
  }

  if (!requiredOpenAiConfigPresent) {
    return "OPENAI_API_KEY is missing in server environment.";
  }

  return "Runtime benchmark artifact is valid and required OpenAI config is present.";
}

function getOllamaRunReadinessReason(params: {
  manualRunReady: boolean;
  manualRunReadinessReason: string;
  ollamaProviderSupported: boolean;
}): string {
  const { manualRunReady, manualRunReadinessReason, ollamaProviderSupported } = params;

  if (!manualRunReady) {
    return `Manual run is not ready: ${manualRunReadinessReason}`;
  }

  if (!ollamaProviderSupported) {
    return "Ollama provider path is not supported by the app.";
  }

  return "Runtime benchmark artifact is valid and Ollama provider path is supported (no live endpoint probe required).";
}

export function getBenchmarkReadiness(): BenchmarkReadinessReport {
  const inspection = getCacheInspection();
  const requiredOpenAiConfigPresent = (process.env.OPENAI_API_KEY?.trim() ?? "").length > 0;
  const ollamaProviderSupported = SUPPORTED_PROVIDER_IDS.includes(OLLAMA_PROVIDER_ID);

  const benchmarks = inspection.map((item): BenchmarkReadinessItem => {
    const cacheExists = item.status !== "cache-missing";
    const manifestExists = item.status !== "cache-missing" && item.status !== "manifest-missing";
    const manifestValid = item.status === "manifest-valid";
    const runtimeState = getRuntimeBenchmarkJsonFromCache(item.benchmarkId);
    const runtimeBenchmarkArtifactExists = runtimeState.found;
    const runtimeBenchmarkArtifactValid = runtimeState.valid;

    const manualRunReady = runtimeBenchmarkArtifactExists && runtimeBenchmarkArtifactValid;

    const manualRunReadinessReason = getManualRunReadinessReason({
      runtimeStatus: runtimeState.status,
      runtimeValidationErrors: runtimeState.validationErrors,
    });

    const openAiRunReady = manualRunReady && requiredOpenAiConfigPresent;
    const openAiRunReadinessReason = getOpenAiRunReadinessReason({
      manualRunReady,
      manualRunReadinessReason,
      requiredOpenAiConfigPresent,
    });

    const ollamaRunReady = manualRunReady && ollamaProviderSupported;
    const ollamaRunReadinessReason = getOllamaRunReadinessReason({
      manualRunReady,
      manualRunReadinessReason,
      ollamaProviderSupported,
    });

    const ready = manualRunReady;

    return {
      benchmarkId: item.benchmarkId,
      benchmarkName: item.benchmarkName,
      existsInRegistry: true,
      cacheStatus: item.status,
      cacheExists,
      manifestExists,
      manifestValid,
      runtimeBenchmarkArtifactExists,
      runtimeBenchmarkArtifactValid,
      requiredOpenAiConfigPresent,
      ollamaProviderSupported,
      manualRunReady,
      openAiRunReady,
      ollamaRunReady,
      manualRunReadinessReason,
      openAiRunReadinessReason,
      ollamaRunReadinessReason,
      ready,
      readinessLabel: ready ? "Ready" : "Not ready",
      readinessMessage: getReadinessMessage(item.status, item.validationErrors),
    };
  });

  const readyCount = benchmarks.filter((item) => item.ready).length;
  const totalCount = benchmarks.length;

  return {
    summary: {
      totalCount,
      readyCount,
      notReadyCount: totalCount - readyCount,
    },
    benchmarks,
  };
}

