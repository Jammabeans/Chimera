import type { BenchmarkCacheStatus } from "./getCacheInspection";

import { getCacheInspection } from "./getCacheInspection";

export interface BenchmarkReadinessItem {
  benchmarkId: string;
  benchmarkName: string;
  existsInRegistry: true;
  cacheStatus: BenchmarkCacheStatus;
  manifestValid: boolean;
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

export function getBenchmarkReadiness(): BenchmarkReadinessReport {
  const inspection = getCacheInspection();

  const benchmarks = inspection.map((item): BenchmarkReadinessItem => {
    const manifestValid = item.status === "manifest-valid";
    const ready = manifestValid;

    return {
      benchmarkId: item.benchmarkId,
      benchmarkName: item.benchmarkName,
      existsInRegistry: true,
      cacheStatus: item.status,
      manifestValid,
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

