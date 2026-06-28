import type { BenchmarkRegistryEntry } from "@/types/benchmark";

import rawRegistry from "../../../data/benchmark-registry.json";

const BENCHMARK_WEAKNESS_CATEGORIES = [
  "state-trace",
  "rewrite-chain",
  "decoy-navigation",
  "other",
] as const;

const BENCHMARK_TRUST_MODES = ["allowlisted", "review-required"] as const;

const BENCHMARK_STATUSES = ["example", "active", "disabled"] as const;

const BENCHMARK_SYNC_MODES = ["manual"] as const;

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRequiredString(entry: Record<string, unknown>, field: string): string {
  const value = entry[field];

  if (typeof value !== "string" || !isNonEmptyString(value)) {
    throw new Error(`Invalid benchmark registry entry: empty or missing '${field}'.`);
  }

  return value;
}

function parseWeaknessCategory(entry: Record<string, unknown>): BenchmarkRegistryEntry["weaknessCategory"] {
  const value = entry.weaknessCategory;

  if (
    typeof value !== "string" ||
    !BENCHMARK_WEAKNESS_CATEGORIES.includes(value as BenchmarkRegistryEntry["weaknessCategory"])
  ) {
    throw new Error("Invalid benchmark registry entry: unsupported 'weaknessCategory'.");
  }

  return value as BenchmarkRegistryEntry["weaknessCategory"];
}

function parseTrustMode(entry: Record<string, unknown>): BenchmarkRegistryEntry["trustMode"] {
  const value = entry.trustMode;

  if (typeof value !== "string" || !BENCHMARK_TRUST_MODES.includes(value as BenchmarkRegistryEntry["trustMode"])) {
    throw new Error("Invalid benchmark registry entry: unsupported 'trustMode'.");
  }

  return value as BenchmarkRegistryEntry["trustMode"];
}

function parseStatus(entry: Record<string, unknown>): BenchmarkRegistryEntry["status"] {
  const value = entry.status;

  if (typeof value !== "string" || !BENCHMARK_STATUSES.includes(value as BenchmarkRegistryEntry["status"])) {
    throw new Error("Invalid benchmark registry entry: unsupported 'status'.");
  }

  return value as BenchmarkRegistryEntry["status"];
}

function parseSyncMode(entry: Record<string, unknown>): BenchmarkRegistryEntry["syncMode"] {
  const value = entry.syncMode;

  if (typeof value !== "string" || !BENCHMARK_SYNC_MODES.includes(value as BenchmarkRegistryEntry["syncMode"])) {
    throw new Error("Invalid benchmark registry entry: unsupported 'syncMode'.");
  }

  return value as BenchmarkRegistryEntry["syncMode"];
}

function validateRegistryEntry(entry: BenchmarkRegistryEntry): void {
  const requiredStringFields: Array<keyof BenchmarkRegistryEntry> = [
    "id",
    "name",
    "description",
    "approvedRepoUrl",
    "defaultRef",
    "entrypoint",
    "syncMode",
  ];

  for (const field of requiredStringFields) {
    if (!isNonEmptyString(entry[field])) {
      throw new Error(`Invalid benchmark registry entry: '${entry.id}' has empty '${field}'.`);
    }
  }
}

function validateRegistry(rawEntries: unknown): readonly BenchmarkRegistryEntry[] {
  if (!Array.isArray(rawEntries)) {
    throw new Error("Invalid benchmark registry: expected a top-level array.");
  }

  const parsedEntries: BenchmarkRegistryEntry[] = rawEntries.map((rawEntry) => {
    if (!isRecord(rawEntry)) {
      throw new Error("Invalid benchmark registry entry: expected an object.");
    }

    const parsedEntry: BenchmarkRegistryEntry = {
      id: parseRequiredString(rawEntry, "id"),
      name: parseRequiredString(rawEntry, "name"),
      description: parseRequiredString(rawEntry, "description"),
      weaknessCategory: parseWeaknessCategory(rawEntry),
      approvedRepoUrl: parseRequiredString(rawEntry, "approvedRepoUrl"),
      defaultRef: parseRequiredString(rawEntry, "defaultRef"),
      entrypoint: parseRequiredString(rawEntry, "entrypoint"),
      syncMode: parseSyncMode(rawEntry),
      trustMode: parseTrustMode(rawEntry),
      status: parseStatus(rawEntry),
    };

    validateRegistryEntry(parsedEntry);

    return parsedEntry;
  });

  const seenIds = new Set<string>();

  for (const entry of parsedEntries) {
    if (seenIds.has(entry.id)) {
      throw new Error(`Invalid benchmark registry: duplicate id '${entry.id}'.`);
    }

    seenIds.add(entry.id);
  }

  return parsedEntries;
}

export const LOCAL_BENCHMARK_REGISTRY: readonly BenchmarkRegistryEntry[] = validateRegistry(rawRegistry);
