export type BenchmarkWeaknessCategory =
  | "state-trace"
  | "rewrite-chain"
  | "decoy-navigation"
  | "other";

export type BenchmarkTrustMode = "allowlisted" | "review-required";

export type BenchmarkStatus = "example" | "active" | "disabled";

export type BenchmarkSyncMode = "manual";

export interface BenchmarkMetadata {
  id: string;
  name: string;
  description: string;
  weaknessCategory: BenchmarkWeaknessCategory;
}

export interface BenchmarkRegistryEntry extends BenchmarkMetadata {
  approvedRepoUrl: string;
  defaultRef: string;
  entrypoint: string;
  syncMode: BenchmarkSyncMode;
  trustMode: BenchmarkTrustMode;
  status: BenchmarkStatus;
}
