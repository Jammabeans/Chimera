import type { RuntimeBenchmarkJsonArtifact } from "@/types/runtimeBenchmarkJsonContract";

export const RUNTIME_BENCHMARK_JSON_ARTIFACT_EXAMPLE: RuntimeBenchmarkJsonArtifact = {
  benchmarkId: "state-trace",
  benchmarkName: "State Trace",
  scoringMode: "exact-text",
  cases: [
    {
      id: "case-basic-1",
      levelId: "basic",
      title: "Directional recall",
      prompt: "Reply with one word: north",
      expectedAnswer: "north",
      metadata: {
        difficulty: "easy",
        deterministic: true,
      },
    },
    {
      id: "case-basic-2",
      levelId: "basic",
      title: "Trust mode recall",
      prompt: "Reply with one word: allowlisted",
      expectedAnswer: "allowlisted",
    },
  ],
};

