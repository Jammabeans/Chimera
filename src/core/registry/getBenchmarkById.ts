import type { BenchmarkRegistryEntry } from "@/types/benchmark";

import { getRegisteredBenchmarks } from "./getRegisteredBenchmarks";

export function getBenchmarkById(id: string): BenchmarkRegistryEntry | undefined {
  return getRegisteredBenchmarks().find((benchmark) => benchmark.id === id);
}

