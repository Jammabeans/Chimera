import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { BenchmarkWeaknessCategory } from "@/types/benchmark";
import type {
  ExternalBenchmarkManifest,
  ExternalBenchmarkSupportedMode,
} from "@/types/externalBenchmarkContract";

import { getRegisteredBenchmarks } from "./getRegisteredBenchmarks";

const CACHE_BASE_DIR = "benchmarks-cache";
const ROOT_MANIFEST_FILENAME = "benchmark.manifest.json";

const EXTERNAL_SUPPORTED_MODES: readonly ExternalBenchmarkSupportedMode[] = ["single-turn", "multi-turn"];

const BENCHMARK_WEAKNESS_CATEGORIES: readonly BenchmarkWeaknessCategory[] = [
  "state-trace",
  "rewrite-chain",
  "decoy-navigation",
  "other",
];

export type BenchmarkCacheStatus =
  | "cache-missing"
  | "manifest-missing"
  | "manifest-invalid"
  | "manifest-valid";

export interface BenchmarkCacheInspectionItem {
  benchmarkId: string;
  benchmarkName: string;
  localCachePath: string;
  manifestPath: string;
  status: BenchmarkCacheStatus;
  validationErrors: string[];
  manifestPreview: BenchmarkManifestPreview | null;
}

export interface BenchmarkManifestPreview {
  manifestId: string;
  name: string;
  version: string;
  weaknessCategory: BenchmarkWeaknessCategory;
  supportedModes: ExternalBenchmarkSupportedMode[];
  levelCount: number;
  owner: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRequiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }

  return value.trim();
}

function validateLevel(level: unknown, index: number): string[] {
  if (!isRecord(level)) {
    return [`levels[${index}] must be an object.`];
  }

  const levelId = parseRequiredString(level, "id");
  const levelName = parseRequiredString(level, "name");
  const errors: string[] = [];

  if (levelId.length === 0) {
    errors.push(`levels[${index}].id is required.`);
  }

  if (levelName.length === 0) {
    errors.push(`levels[${index}].name is required.`);
  }

  return errors;
}

function validateExternalManifestShape(manifest: unknown): string[] {
  if (!isRecord(manifest)) {
    return ["Manifest root must be a JSON object."];
  }

  const errors: string[] = [];

  const requiredStringFields: Array<keyof ExternalBenchmarkManifest> = [
    "id",
    "name",
    "version",
    "description",
    "weaknessCategory",
    "entrypoint",
    "owner",
  ];

  for (const field of requiredStringFields) {
    if (parseRequiredString(manifest, field).length === 0) {
      errors.push(`${field} is required.`);
    }
  }

  const weaknessCategory = parseRequiredString(manifest, "weaknessCategory");
  if (weaknessCategory.length > 0 && !BENCHMARK_WEAKNESS_CATEGORIES.includes(weaknessCategory as BenchmarkWeaknessCategory)) {
    errors.push("weaknessCategory is unsupported.");
  }

  const supportedModes = manifest.supportedModes;
  if (!Array.isArray(supportedModes) || supportedModes.length === 0) {
    errors.push("supportedModes must be a non-empty array.");
  } else {
    supportedModes.forEach((mode, index) => {
      if (typeof mode !== "string" || !EXTERNAL_SUPPORTED_MODES.includes(mode as ExternalBenchmarkSupportedMode)) {
        errors.push(`supportedModes[${index}] is unsupported.`);
      }
    });
  }

  const levels = manifest.levels;
  if (!Array.isArray(levels) || levels.length === 0) {
    errors.push("levels must be a non-empty array.");
  } else {
    levels.forEach((level, index) => {
      errors.push(...validateLevel(level, index));
    });
  }

  return errors;
}

function createManifestPreview(manifest: ExternalBenchmarkManifest): BenchmarkManifestPreview {
  return {
    manifestId: manifest.id,
    name: manifest.name,
    version: manifest.version,
    weaknessCategory: manifest.weaknessCategory,
    supportedModes: manifest.supportedModes,
    levelCount: manifest.levels.length,
    owner: manifest.owner,
  };
}

export function getCacheInspection(): BenchmarkCacheInspectionItem[] {
  const registryEntries = getRegisteredBenchmarks();

  return registryEntries.map((entry) => {
    const localCachePath = `${CACHE_BASE_DIR}/${entry.id}`;
    const manifestPath = `${localCachePath}/${ROOT_MANIFEST_FILENAME}`;

    const cacheAbsolutePath = resolve(process.cwd(), localCachePath);
    const manifestAbsolutePath = resolve(process.cwd(), manifestPath);

    if (!existsSync(cacheAbsolutePath)) {
      return {
        benchmarkId: entry.id,
        benchmarkName: entry.name,
        localCachePath,
        manifestPath,
        status: "cache-missing",
        validationErrors: [],
        manifestPreview: null,
      };
    }

    if (!existsSync(manifestAbsolutePath)) {
      return {
        benchmarkId: entry.id,
        benchmarkName: entry.name,
        localCachePath,
        manifestPath,
        status: "manifest-missing",
        validationErrors: [],
        manifestPreview: null,
      };
    }

    let parsedManifest: unknown;

    try {
      const manifestContent = readFileSync(manifestAbsolutePath, "utf8");
      parsedManifest = JSON.parse(manifestContent);
    } catch {
      return {
        benchmarkId: entry.id,
        benchmarkName: entry.name,
        localCachePath,
        manifestPath,
        status: "manifest-invalid",
        validationErrors: ["Manifest is not valid JSON."],
        manifestPreview: null,
      };
    }

    const validationErrors = validateExternalManifestShape(parsedManifest);

    if (validationErrors.length > 0) {
      return {
        benchmarkId: entry.id,
        benchmarkName: entry.name,
        localCachePath,
        manifestPath,
        status: "manifest-invalid",
        validationErrors,
        manifestPreview: null,
      };
    }

    const manifestPreview = createManifestPreview(parsedManifest as ExternalBenchmarkManifest);

    return {
      benchmarkId: entry.id,
      benchmarkName: entry.name,
      localCachePath,
      manifestPath,
      status: "manifest-valid",
      validationErrors: [],
      manifestPreview,
    };
  });
}

