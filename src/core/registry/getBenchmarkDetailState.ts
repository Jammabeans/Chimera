import type { BenchmarkRegistryEntry } from "@/types/benchmark";

import type { BenchmarkCacheStatus, BenchmarkManifestPreview } from "./getCacheInspection";

import { getBenchmarkById } from "./getBenchmarkById";
import { getBenchmarkReadiness } from "./getBenchmarkReadiness";
import { getCacheInspection } from "./getCacheInspection";

export interface BenchmarkDetailState {
  benchmark: BenchmarkRegistryEntry;
  cacheStatus: BenchmarkCacheStatus;
  manifestValid: boolean;
  ready: boolean;
  readinessMessage: string;
  manifestPreview: BenchmarkManifestPreview | null;
}

export function getBenchmarkDetailState(id: string): BenchmarkDetailState | undefined {
  const benchmark = getBenchmarkById(id);

  if (!benchmark) {
    return undefined;
  }

  const cacheItem = getCacheInspection().find((item) => item.benchmarkId === id);
  const readinessItem = getBenchmarkReadiness().benchmarks.find((item) => item.benchmarkId === id);

  const cacheStatus = cacheItem?.status ?? "cache-missing";
  const manifestValid = cacheItem?.status === "manifest-valid";
  const ready = readinessItem?.ready ?? manifestValid;
  const readinessMessage =
    readinessItem?.readinessMessage ??
    (manifestValid
      ? "Registry entry, cache directory, and root manifest are present and valid."
      : "Cache/manifest state is not ready.");

  return {
    benchmark,
    cacheStatus,
    manifestValid,
    ready,
    readinessMessage,
    manifestPreview: cacheItem?.manifestPreview ?? null,
  };
}
