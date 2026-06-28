import type {
  BenchmarkRegistryEntry,
  BenchmarkStatus,
  BenchmarkSyncMode,
  BenchmarkTrustMode,
  BenchmarkWeaknessCategory,
} from "@/types/benchmark";

import rawRegistry from "../../../data/benchmark-registry.json";

const BENCHMARK_WEAKNESS_CATEGORIES: readonly BenchmarkWeaknessCategory[] = [
  "state-trace",
  "rewrite-chain",
  "decoy-navigation",
  "other",
];

const BENCHMARK_TRUST_MODES: readonly BenchmarkTrustMode[] = ["allowlisted", "review-required"];

const BENCHMARK_STATUSES: readonly BenchmarkStatus[] = ["example", "active", "disabled"];

const BENCHMARK_SYNC_MODES: readonly BenchmarkSyncMode[] = ["manual"];

const REQUIRED_FIELDS: Array<keyof BenchmarkRegistryEntry> = [
  "id",
  "name",
  "description",
  "weaknessCategory",
  "approvedRepoUrl",
  "defaultRef",
  "entrypoint",
  "syncMode",
  "trustMode",
  "status",
];

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface RegistryEntryDiagnostics {
  index: number;
  id: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  rawEntry: unknown;
}

export interface RegistryDiagnosticsSummary {
  totalCount: number;
  validCount: number;
  invalidCount: number;
  entries: RegistryEntryDiagnostics[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(entry: Record<string, unknown>, field: keyof BenchmarkRegistryEntry): string {
  const value = entry[field];
  return typeof value === "string" ? value.trim() : "";
}

function validateEntryShape(entry: Record<string, unknown>, diagnostics: RegistryEntryDiagnostics): void {
  for (const field of REQUIRED_FIELDS) {
    if (getString(entry, field).length === 0) {
      diagnostics.errors.push(`Missing or empty required field: '${field}'.`);
    }
  }

  const id = getString(entry, "id");
  if (id.length > 0 && !ID_PATTERN.test(id)) {
    diagnostics.errors.push("Invalid 'id' format. Use lowercase letters, numbers, and hyphens only.");
  }

  const approvedRepoUrl = getString(entry, "approvedRepoUrl");
  if (approvedRepoUrl.length > 0) {
    try {
      const parsedUrl = new URL(approvedRepoUrl);
      if (!parsedUrl.protocol.startsWith("http")) {
        diagnostics.errors.push("Invalid 'approvedRepoUrl': URL protocol must be http/https.");
      }
    } catch {
      diagnostics.errors.push("Invalid 'approvedRepoUrl': must be a valid URL.");
    }
  }

  const weaknessCategory = getString(entry, "weaknessCategory");
  if (weaknessCategory.length > 0 && !BENCHMARK_WEAKNESS_CATEGORIES.includes(weaknessCategory as BenchmarkWeaknessCategory)) {
    diagnostics.errors.push("Unsupported 'weaknessCategory'.");
  }

  const trustMode = getString(entry, "trustMode");
  if (trustMode.length > 0 && !BENCHMARK_TRUST_MODES.includes(trustMode as BenchmarkTrustMode)) {
    diagnostics.errors.push("Unsupported 'trustMode'.");
  }

  const status = getString(entry, "status");
  if (status.length > 0 && !BENCHMARK_STATUSES.includes(status as BenchmarkStatus)) {
    diagnostics.errors.push("Unsupported 'status'.");
  }

  const syncMode = getString(entry, "syncMode");
  if (syncMode.length > 0 && !BENCHMARK_SYNC_MODES.includes(syncMode as BenchmarkSyncMode)) {
    diagnostics.errors.push("Unsupported 'syncMode'.");
  }
}

export function getRegistryDiagnostics(): RegistryDiagnosticsSummary {
  if (!Array.isArray(rawRegistry)) {
    return {
      totalCount: 1,
      validCount: 0,
      invalidCount: 1,
      entries: [
        {
          index: -1,
          id: "(registry)",
          valid: false,
          errors: ["Registry root is invalid: expected a JSON array."],
          warnings: [],
          rawEntry: rawRegistry,
        },
      ],
    };
  }

  const entries: RegistryEntryDiagnostics[] = rawRegistry.map((rawEntry, index) => {
    const diagnostics: RegistryEntryDiagnostics = {
      index,
      id: `#${index}`,
      valid: false,
      errors: [],
      warnings: [],
      rawEntry,
    };

    if (!isRecord(rawEntry)) {
      diagnostics.errors.push("Invalid entry type: expected an object.");
      return diagnostics;
    }

    const id = getString(rawEntry, "id");
    diagnostics.id = id.length > 0 ? id : `#${index}`;

    validateEntryShape(rawEntry, diagnostics);

    diagnostics.valid = diagnostics.errors.length === 0;
    return diagnostics;
  });

  const idCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.id.startsWith("#")) {
      continue;
    }
    idCounts.set(entry.id, (idCounts.get(entry.id) ?? 0) + 1);
  }

  for (const entry of entries) {
    if (entry.id.startsWith("#")) {
      continue;
    }

    if ((idCounts.get(entry.id) ?? 0) > 1) {
      entry.errors.push(`Duplicate id detected: '${entry.id}'.`);
      entry.valid = false;
    }
  }

  const validCount = entries.filter((entry) => entry.valid).length;

  return {
    totalCount: entries.length,
    validCount,
    invalidCount: entries.length - validCount,
    entries,
  };
}

