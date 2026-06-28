import type { BenchmarkRegistryEntry } from "@/types/benchmark";

import { LOCAL_BENCHMARK_REGISTRY } from "./registry";

export function getRegisteredBenchmarks(): readonly BenchmarkRegistryEntry[] {
  return LOCAL_BENCHMARK_REGISTRY;
}
