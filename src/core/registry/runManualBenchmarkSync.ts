import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import { getBenchmarkById } from "./getBenchmarkById";
import { getCacheInspection } from "./getCacheInspection";
import { getRuntimeBenchmarkJsonFromCache } from "./getRuntimeBenchmarkJsonFromCache";

const CACHE_BASE_DIR = "benchmarks-cache";
const ROOT_MANIFEST_FILENAME = "benchmark.manifest.json";

export type ManualSyncResultStatus = "cloned" | "updated" | "rejected" | "failed";

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

function readGitCommandError(params: {
  command: string;
  stdout: string | null;
  stderr: string | null;
  processError?: Error;
}): string {
  const { command, stdout, stderr, processError } = params;

  if (processError) {
    return `${command}: ${processError.message}`;
  }

  const stderrMessage = stderr?.trim();
  if (stderrMessage && stderrMessage.length > 0) {
    return `${command}: ${stderrMessage}`;
  }

  const stdoutMessage = stdout?.trim();
  if (stdoutMessage && stdoutMessage.length > 0) {
    return `${command}: ${stdoutMessage}`;
  }

  return `${command} failed with no output.`;
}

function getPostSyncStateSummary(benchmarkId: string): string {
  const cacheState = getCacheInspection().find((item) => item.benchmarkId === benchmarkId);
  const runtimeState = getRuntimeBenchmarkJsonFromCache(benchmarkId);

  const cacheStatus = cacheState?.status ?? "cache-missing";

  return `Cache status after sync: ${cacheStatus}. Runtime artifact status: ${runtimeState.status}.`;
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
    const gitRepoCheck = spawnSync("git", ["-C", targetAbsolutePath, "rev-parse", "--is-inside-work-tree"], {
      encoding: "utf8",
    });

    if (gitRepoCheck.status !== 0 || gitRepoCheck.stdout?.trim() !== "true") {
      return {
        benchmarkId: normalizedId,
        status: "failed",
        message:
          "Sync failed: cache directory exists but is not a valid git working tree. Remove it and retry sync to clone fresh.",
      };
    }

    const fetchResult = spawnSync("git", ["-C", targetAbsolutePath, "fetch", "origin", entry.defaultRef, "--depth", "1"], {
      encoding: "utf8",
    });

    if (fetchResult.status !== 0) {
      return {
        benchmarkId: normalizedId,
        status: "failed",
        message: `Update failed: ${readGitCommandError({
          command: `git fetch origin ${entry.defaultRef}`,
          stdout: fetchResult.stdout,
          stderr: fetchResult.stderr,
          processError: fetchResult.error,
        })}`,
      };
    }

    const resetResult = spawnSync("git", ["-C", targetAbsolutePath, "reset", "--hard", "FETCH_HEAD"], {
      encoding: "utf8",
    });

    if (resetResult.status !== 0) {
      return {
        benchmarkId: normalizedId,
        status: "failed",
        message: `Update failed: ${readGitCommandError({
          command: "git reset --hard FETCH_HEAD",
          stdout: resetResult.stdout,
          stderr: resetResult.stderr,
          processError: resetResult.error,
        })}`,
      };
    }

    const cleanResult = spawnSync("git", ["-C", targetAbsolutePath, "clean", "-fd"], {
      encoding: "utf8",
    });

    if (cleanResult.status !== 0) {
      return {
        benchmarkId: normalizedId,
        status: "failed",
        message: `Update failed: ${readGitCommandError({
          command: "git clean -fd",
          stdout: cleanResult.stdout,
          stderr: cleanResult.stderr,
          processError: cleanResult.error,
        })}`,
      };
    }

    return {
      benchmarkId: normalizedId,
      status: "updated",
      message: `Updated existing cache via fetch + hard reset to origin/${entry.defaultRef} (plus clean of untracked files). ${getPostSyncStateSummary(entry.id)}`,
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
    message: `Cloned approved repo into benchmarks-cache/${entry.id}/. Root manifest expected at benchmarks-cache/${entry.id}/${ROOT_MANIFEST_FILENAME}. ${getPostSyncStateSummary(entry.id)}`,
  };
}

