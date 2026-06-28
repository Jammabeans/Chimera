import type { BenchmarkWeaknessCategory } from "@/types/benchmark";

export type ExternalBenchmarkSupportedMode = "single-turn" | "multi-turn";

export interface ExternalBenchmarkLevelManifest {
  id: string;
  name: string;
}

export interface ExternalBenchmarkManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  weaknessCategory: BenchmarkWeaknessCategory;
  supportedModes: ExternalBenchmarkSupportedMode[];
  entrypoint: string;
  levels: ExternalBenchmarkLevelManifest[];
  owner: string;
}
