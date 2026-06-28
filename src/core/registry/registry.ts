import type { BenchmarkRegistryEntry } from "@/types/benchmark";

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function validateRegistryEntry(entry: BenchmarkRegistryEntry): void {
  const requiredStringFields: Array<keyof BenchmarkRegistryEntry> = [
    "id",
    "name",
    "description",
    "repoUrl",
    "defaultRef",
    "entrypoint",
  ];

  for (const field of requiredStringFields) {
    if (!isNonEmptyString(entry[field])) {
      throw new Error(`Invalid benchmark registry entry: '${entry.id}' has empty '${field}'.`);
    }
  }
}

function validateRegistry(entries: readonly BenchmarkRegistryEntry[]): readonly BenchmarkRegistryEntry[] {
  for (const entry of entries) {
    validateRegistryEntry(entry);
  }

  return entries;
}

export const LOCAL_BENCHMARK_REGISTRY: readonly BenchmarkRegistryEntry[] = validateRegistry([
  {
    id: "state-trace",
    name: "State Trace",
    description: "Tracks hidden or long-horizon state consistency across a multi-turn interaction.",
    weaknessCategory: "state-trace",
    repoUrl: "https://github.com/chimera-benchmarks/state-trace",
    defaultRef: "main",
    entrypoint: "benchmarks/state-trace/index.ts",
    trustMode: "allowlisted",
    status: "example",
  },
  {
    id: "rewrite-chain",
    name: "Rewrite Chain",
    description: "Measures whether iterative rewrites preserve constraints while improving quality.",
    weaknessCategory: "rewrite-chain",
    repoUrl: "https://github.com/chimera-benchmarks/rewrite-chain",
    defaultRef: "main",
    entrypoint: "benchmarks/rewrite-chain/index.ts",
    trustMode: "review-required",
    status: "example",
  },
  {
    id: "decoy-nav",
    name: "Decoy Navigation",
    description: "Evaluates resilience against distractor instructions and decoy objective shifts.",
    weaknessCategory: "decoy-navigation",
    repoUrl: "https://github.com/chimera-benchmarks/decoy-nav",
    defaultRef: "main",
    entrypoint: "benchmarks/decoy-nav/index.ts",
    trustMode: "allowlisted",
    status: "example",
  },
]);
