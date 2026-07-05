import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const STATE_TRACE_BENCHMARK_ID = "state-trace" as const;
const STATE_TRACE_CONTRACT_VERSION = "1" as const;
const STATE_TRACE_CACHE_REPO_PATH = "benchmarks-cache/state-trace" as const;
const STATE_TRACE_CLI_ENTRYPOINT = "dist/chimera-cli.js" as const;

export type StateTraceCliCommand = "generate" | "score";

export type StateTraceCliErrorCode =
  | "cache-repo-missing"
  | "cli-entrypoint-missing"
  | "process-spawn-failed"
  | "process-exit-nonzero"
  | "empty-stdout"
  | "invalid-json-output";

export interface StateTraceCliFailure {
  ok: false;
  benchmarkId: typeof STATE_TRACE_BENCHMARK_ID;
  command: StateTraceCliCommand;
  errorCode: StateTraceCliErrorCode;
  message: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface StateTraceCliSuccess<TData = unknown> {
  ok: true;
  benchmarkId: typeof STATE_TRACE_BENCHMARK_ID;
  command: StateTraceCliCommand;
  data: TData;
  stdout: string;
}

export type StateTraceCliResult<TData = unknown> = StateTraceCliSuccess<TData> | StateTraceCliFailure;

export interface StateTraceCliGenerateInput {
  seed: number;
  stepCount: number;
}

export interface StateTraceCliScoreInput {
  instance: unknown;
  response: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toReadableProcessMessage(stdout: string, stderr: string): string {
  const stderrText = stderr.trim();
  if (stderrText.length > 0) {
    return stderrText;
  }

  const stdoutText = stdout.trim();
  if (stdoutText.length > 0) {
    return stdoutText;
  }

  return "Command failed with no output.";
}

function runStateTraceCachedCliCommand<TData>(command: StateTraceCliCommand, payload: unknown): StateTraceCliResult<TData> {
  const cacheRepoAbsolutePath = resolve(process.cwd(), STATE_TRACE_CACHE_REPO_PATH);
  const cliEntrypointAbsolutePath = resolve(cacheRepoAbsolutePath, STATE_TRACE_CLI_ENTRYPOINT);

  if (!existsSync(cacheRepoAbsolutePath)) {
    return {
      ok: false,
      benchmarkId: STATE_TRACE_BENCHMARK_ID,
      command,
      errorCode: "cache-repo-missing",
      message: `Cached benchmark repo is missing at ${STATE_TRACE_CACHE_REPO_PATH}. Run sync first.`,
      exitCode: null,
      stdout: "",
      stderr: "",
    };
  }

  if (!existsSync(cliEntrypointAbsolutePath)) {
    return {
      ok: false,
      benchmarkId: STATE_TRACE_BENCHMARK_ID,
      command,
      errorCode: "cli-entrypoint-missing",
      message: `CLI entrypoint is missing at ${STATE_TRACE_CACHE_REPO_PATH}/${STATE_TRACE_CLI_ENTRYPOINT}. Build the cached benchmark repo before using this pilot route.`,
      exitCode: null,
      stdout: "",
      stderr: "",
    };
  }

  const inputJson = JSON.stringify(payload);

  const commandResult = spawnSync("node", [cliEntrypointAbsolutePath, command], {
    cwd: cacheRepoAbsolutePath,
    input: inputJson,
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024,
  });

  const stdout = commandResult.stdout ?? "";
  const stderr = commandResult.stderr ?? "";

  if (commandResult.error) {
    return {
      ok: false,
      benchmarkId: STATE_TRACE_BENCHMARK_ID,
      command,
      errorCode: "process-spawn-failed",
      message: `Failed to run benchmark CLI: ${commandResult.error.message}`,
      exitCode: commandResult.status,
      stdout,
      stderr,
    };
  }

  if (commandResult.status !== 0) {
    return {
      ok: false,
      benchmarkId: STATE_TRACE_BENCHMARK_ID,
      command,
      errorCode: "process-exit-nonzero",
      message: `Benchmark CLI exited with non-zero status (${commandResult.status}) for command \"${command}\": ${toReadableProcessMessage(
        stdout,
        stderr,
      )}. stdin payload: ${inputJson}`,
      exitCode: commandResult.status,
      stdout,
      stderr,
    };
  }

  const trimmedStdout = stdout.trim();
  if (trimmedStdout.length === 0) {
    return {
      ok: false,
      benchmarkId: STATE_TRACE_BENCHMARK_ID,
      command,
      errorCode: "empty-stdout",
      message: "Benchmark CLI returned empty stdout. Expected JSON payload.",
      exitCode: commandResult.status,
      stdout,
      stderr,
    };
  }

  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(trimmedStdout);
  } catch {
    return {
      ok: false,
      benchmarkId: STATE_TRACE_BENCHMARK_ID,
      command,
      errorCode: "invalid-json-output",
      message: "Benchmark CLI returned invalid JSON on stdout.",
      exitCode: commandResult.status,
      stdout,
      stderr,
    };
  }

  return {
    ok: true,
    benchmarkId: STATE_TRACE_BENCHMARK_ID,
    command,
    data: parsedOutput as TData,
    stdout,
  };
}

export function runStateTraceCliGenerate(input: StateTraceCliGenerateInput): StateTraceCliResult {
  return runStateTraceCachedCliCommand("generate", {
    benchmarkId: STATE_TRACE_BENCHMARK_ID,
    contractVersion: STATE_TRACE_CONTRACT_VERSION,
    seed: String(input.seed),
    params: {
      stepCount: input.stepCount,
    },
  });
}

export function runStateTraceCliScore(input: StateTraceCliScoreInput): StateTraceCliResult {
  return runStateTraceCachedCliCommand("score", {
    benchmarkId: STATE_TRACE_BENCHMARK_ID,
    contractVersion: STATE_TRACE_CONTRACT_VERSION,
    instance: input.instance,
    response: {
      text: input.response,
    },
  });
}

export function extractPromptFromStateTraceGeneratedInstance(value: unknown): string {
  if (!isRecord(value)) {
    return "";
  }

  const directPromptFields = ["prompt", "promptText", "question", "input"] as const;
  for (const field of directPromptFields) {
    const fieldValue = value[field];
    if (typeof fieldValue === "string" && fieldValue.trim().length > 0) {
      return fieldValue;
    }
  }

  const nestedInstance = value.instance;
  if (isRecord(nestedInstance)) {
    for (const field of directPromptFields) {
      const fieldValue = nestedInstance[field];
      if (typeof fieldValue === "string" && fieldValue.trim().length > 0) {
        return fieldValue;
      }
    }
  }

  return "";
}

