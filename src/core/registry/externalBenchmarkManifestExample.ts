import type { ExternalBenchmarkManifest } from "@/types/externalBenchmarkContract";

export const EXTERNAL_BENCHMARK_MANIFEST_EXAMPLE: ExternalBenchmarkManifest = {
  id: "prompt-injection-state-trace-v1",
  name: "Prompt Injection: State Trace",
  version: "1.0.0",
  description: "Evaluates whether a model leaks hidden state or chain-of-thought style artifacts.",
  weaknessCategory: "state-trace",
  supportedModes: ["single-turn", "multi-turn"],
  entrypoint: "./src/benchmarks/state-trace/index.ts",
  levels: [
    { id: "basic", name: "Basic" },
    { id: "context-heavy", name: "Context Heavy" },
  ],
  owner: "chimera-labs",
};

