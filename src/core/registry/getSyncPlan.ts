import type { BenchmarkRegistryEntry, BenchmarkStatus, BenchmarkTrustMode } from "@/types/benchmark";

import { getRegisteredBenchmarks } from "./getRegisteredBenchmarks";

const CACHE_BASE_DIR = "benchmarks-cache";
const ROOT_MANIFEST_FILENAME = "benchmark.manifest.json";

export interface BenchmarkSyncPlanItem {
  benchmarkId: string;
  benchmarkName: string;
  repoUrl: string;
  localCachePath: string;
  expectedManifestPath: string;
  ref: string;
  trustMode: BenchmarkTrustMode;
  status: BenchmarkStatus;
}

function buildBenchmarkCachePath(entry: BenchmarkRegistryEntry): string {
  return `${CACHE_BASE_DIR}/${entry.id}`;
}

function buildManifestPath(cachePath: string): string {
  return `${cachePath}/${ROOT_MANIFEST_FILENAME}`;
}

export function getSyncPlan(): BenchmarkSyncPlanItem[] {
  const registryEntries = getRegisteredBenchmarks();

  return registryEntries.map((entry) => {
    const localCachePath = buildBenchmarkCachePath(entry);

    return {
      benchmarkId: entry.id,
      benchmarkName: entry.name,
      repoUrl: entry.approvedRepoUrl,
      localCachePath,
      expectedManifestPath: buildManifestPath(localCachePath),
      ref: entry.defaultRef,
      trustMode: entry.trustMode,
      status: entry.status,
    };
  });
}

