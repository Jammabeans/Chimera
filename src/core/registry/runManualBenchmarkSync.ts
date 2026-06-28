import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import { getBenchmarkById } from "./getBenchmarkById";

const CACHE_BASE_DIR = "benchmarks-cache";
const ROOT_MANIFEST_FILENAME = "benchmark.manifest.json";

export type ManualSyncResultStatus = "cloned" | "already-exists" | "rejected" | "failed";

export interface ManualSyncResult {
  benchmarkId: string;
  status: ManualSyncResultStatus;
  message: string;
}

function isSafeBenchmarkId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isPathWithinBase(baseAbsolutePath: string, targetAbsolutePath: string): boolean {
  const relativePath = relative(baseAbsolutePath, targetAbsolutePath);

  if (relativePath.length === 0) {
    return true;
  }

  return !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

function readCloneError(stdout: string | null, stderr: string | null, processError?: Error): string {
  if (processError) {
    return processError.message;
  }

  const stderrMessage = stderr?.trim();
  if (stderrMessage && stderrMessage.length > 0) {
    return stderrMessage;
  }

  const stdoutMessage = stdout?.trim();
  if (stdoutMessage && stdoutMessage.length > 0) {
    return stdoutMessage;
  }

  return "git clone failed with no output.";
}

export function runManualBenchmarkSync(benchmarkId: string): ManualSyncResult {
  const normalizedId = benchmarkId.trim();

  if (!isSafeBenchmarkId(normalizedId)) {
    return {
      benchmarkId: normalizedId,
      status: "rejected",
      message: "Rejected: benchmark id format is invalid.",
    };
  }

  const entry = getBenchmarkById(normalizedId);

  if (!entry) {
    return {
      benchmarkId: normalizedId,
      status: "rejected",
      message: "Rejected: unknown benchmark id.",
    };
  }

  if (entry.syncMode !== "manual") {
    return {
      benchmarkId: normalizedId,
      status: "rejected",
      message: "Rejected: benchmark is not configured for manual sync.",
    };
  }

  if (entry.trustMode !== "allowlisted") {
    return {
      benchmarkId: normalizedId,
      status: "rejected",
      message: `Rejected: trust mode '${entry.trustMode}' is not allowed for v1 manual sync.`,
    };
  }

  const cacheBaseAbsolutePath = resolve(process.cwd(), CACHE_BASE_DIR);
  const targetAbsolutePath = resolve(cacheBaseAbsolutePath, entry.id);

  if (!isPathWithinBase(cacheBaseAbsolutePath, targetAbsolutePath)) {
    return {
      benchmarkId: normalizedId,
      status: "rejected",
      message: "Rejected: resolved cache path is outside cache base directory.",
    };
  }

  if (existsSync(targetAbsolutePath)) {
    return {
      benchmarkId: normalizedId,
      status: "already-exists",
      message: "Skipped: cache directory already exists; fetch/pull is not implemented in v1.",
    };
  }

  mkdirSync(cacheBaseAbsolutePath, { recursive: true });

  const cloneResult = spawnSync(
    "git",
    ["clone", "--branch", entry.defaultRef, "--depth", "1", entry.approvedRepoUrl, targetAbsolutePath],
    {
      encoding: "utf8",
    },
  );

  if (cloneResult.status !== 0) {
    return {
      benchmarkId: normalizedId,
      status: "failed",
      message: `Clone failed: ${readCloneError(cloneResult.stdout, cloneResult.stderr, cloneResult.error)}`,
    };
  }

  return {
    benchmarkId: normalizedId,
    status: "cloned",
    message: `Cloned approved repo into benchmarks-cache/${entry.id}/. Root manifest expected at benchmarks-cache/${entry.id}/${ROOT_MANIFEST_FILENAME}.`,
  };
}

