export type BenchmarkWeaknessCategory =
  | "state-trace"
  | "rewrite-chain"
  | "decoy-navigation"
  | "other";

export type BenchmarkTrustMode = "allowlisted" | "review-required";

export type BenchmarkStatus = "example" | "active" | "disabled";

export interface BenchmarkMetadata {
  id: string;
  name: string;
  description: string;
  weaknessCategory: BenchmarkWeaknessCategory;
}

export interface BenchmarkRegistryEntry extends BenchmarkMetadata {
  repoUrl: string;
  defaultRef: string;
  entrypoint: string;
  trustMode: BenchmarkTrustMode;
  status: BenchmarkStatus;
}
