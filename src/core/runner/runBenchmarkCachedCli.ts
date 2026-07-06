import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { getBenchmarkById } from "@/core/registry/getBenchmarkById";

const BENCHMARK_CLI_CONTRACT_VERSION = "1" as const;
const CACHE_BASE_DIR = "benchmarks-cache" as const;
const CLI_ENTRYPOINT_CANDIDATES = ["dist/chimera-cli.js", "chimera-cli.js"] as const;

export type BenchmarkCliCommand = "describe" | "generate" | "score" | "analyze";

export type BenchmarkCliErrorCode =
  | "benchmark-id-invalid"
  | "benchmark-not-found"
  | "cache-repo-missing"
  | "cli-entrypoint-missing"
  | "process-spawn-failed"
  | "process-exit-nonzero"
  | "empty-stdout"
  | "invalid-json-output";

export interface BenchmarkCliFailure {
  ok: false;
  benchmarkId: string;
  command: BenchmarkCliCommand;
  errorCode: BenchmarkCliErrorCode;
  message: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  cacheRepoPath: string;
  cliEntrypointPath: string | null;
}

export interface BenchmarkCliSuccess<TData = unknown> {
  ok: true;
  benchmarkId: string;
  command: BenchmarkCliCommand;
  data: TData;
  stdout: string;
  cacheRepoPath: string;
  cliEntrypointPath: string;
}

export type BenchmarkCliResult<TData = unknown> = BenchmarkCliSuccess<TData> | BenchmarkCliFailure;

export interface BenchmarkCliScoreInput {
  instance: unknown;
  responseText: string;
}

export type BenchmarkCliAnalyzeInput = BenchmarkCliScoreInput;

export type BenchmarkCliDescribeFieldType = "string" | "integer" | "select" | "boolean";

export interface BenchmarkCliDescribeSelectOption {
  value: string;
  label: string;
}

export interface BenchmarkCliDescribeField {
  name: string;
  type: BenchmarkCliDescribeFieldType;
  required: boolean;
  description: string;
  defaultValue: unknown;
  min: number | null;
  max: number | null;
  options: BenchmarkCliDescribeSelectOption[];
}

export interface BenchmarkCliDescribeMetadata {
  benchmarkId: string;
  contractVersion: string;
  displayName: string;
  description: string;
  supportsDescribe: boolean;
  supportsGenerate: boolean;
  supportsScore: boolean;
  supportsAnalyze: boolean;
  generateFields: BenchmarkCliDescribeField[];
  raw: unknown;
}

interface BenchmarkCliDescribeRoot {
  displayName: string;
  description: string;
  contractVersion: string;
  commands: string[];
  generateRecord: Record<string, unknown> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSafeBenchmarkId(value: string): string {
  return value.trim();
}

function isSafeBenchmarkId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
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

function getCacheRepoPath(benchmarkId: string): string {
  return `${CACHE_BASE_DIR}/${benchmarkId}`;
}

function getCliEntrypoint(cacheRepoAbsolutePath: string, cacheRepoPath: string): {
  absolutePath: string;
  relativePath: string;
} | null {
  for (const candidate of CLI_ENTRYPOINT_CANDIDATES) {
    const absolutePath = resolve(cacheRepoAbsolutePath, candidate);
    if (existsSync(absolutePath)) {
      return {
        absolutePath,
        relativePath: `${cacheRepoPath}/${candidate}`,
      };
    }
  }

  return null;
}

function createEnvelope(benchmarkId: string): { benchmarkId: string; contractVersion: string } {
  return {
    benchmarkId,
    contractVersion: BENCHMARK_CLI_CONTRACT_VERSION,
  };
}

export function runBenchmarkCliCommand<TData>(
  benchmarkIdInput: string,
  command: BenchmarkCliCommand,
  payload: unknown,
): BenchmarkCliResult<TData> {
  const benchmarkId = toSafeBenchmarkId(benchmarkIdInput);
  const cacheRepoPath = getCacheRepoPath(benchmarkId);
  const cacheRepoAbsolutePath = resolve(process.cwd(), cacheRepoPath);

  if (!isSafeBenchmarkId(benchmarkId)) {
    return {
      ok: false,
      benchmarkId,
      command,
      errorCode: "benchmark-id-invalid",
      message: "Benchmark id format is invalid.",
      exitCode: null,
      stdout: "",
      stderr: "",
      cacheRepoPath,
      cliEntrypointPath: null,
    };
  }

  if (!getBenchmarkById(benchmarkId)) {
    return {
      ok: false,
      benchmarkId,
      command,
      errorCode: "benchmark-not-found",
      message: "Benchmark id is not present in registry.",
      exitCode: null,
      stdout: "",
      stderr: "",
      cacheRepoPath,
      cliEntrypointPath: null,
    };
  }

  if (!existsSync(cacheRepoAbsolutePath)) {
    return {
      ok: false,
      benchmarkId,
      command,
      errorCode: "cache-repo-missing",
      message: `Cached benchmark repo is missing at ${cacheRepoPath}. Run sync first.`,
      exitCode: null,
      stdout: "",
      stderr: "",
      cacheRepoPath,
      cliEntrypointPath: null,
    };
  }

  const cliEntrypoint = getCliEntrypoint(cacheRepoAbsolutePath, cacheRepoPath);
  if (!cliEntrypoint) {
    return {
      ok: false,
      benchmarkId,
      command,
      errorCode: "cli-entrypoint-missing",
      message:
        `Benchmark CLI entrypoint is missing in ${cacheRepoPath}. ` +
        `Expected one of: ${CLI_ENTRYPOINT_CANDIDATES.map((candidate) => `${cacheRepoPath}/${candidate}`).join(", ")}.`,
      exitCode: null,
      stdout: "",
      stderr: "",
      cacheRepoPath,
      cliEntrypointPath: null,
    };
  }

  const inputJson = JSON.stringify(payload);
  const commandResult = spawnSync("node", [cliEntrypoint.absolutePath, command], {
    cwd: cacheRepoAbsolutePath,
    input: inputJson,
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024,
  });

  const stdout = commandResult.stdout ?? "";
  const stderr = commandResult.stderr ?? "";
  const invokedCommand = `node ${cliEntrypoint.relativePath.replace(`${cacheRepoPath}/`, "")} ${command}`;

  if (commandResult.error) {
    return {
      ok: false,
      benchmarkId,
      command,
      errorCode: "process-spawn-failed",
      message: `Failed to run benchmark CLI: ${commandResult.error.message}`,
      exitCode: commandResult.status,
      stdout,
      stderr,
      cacheRepoPath,
      cliEntrypointPath: cliEntrypoint.relativePath,
    };
  }

  if (commandResult.status !== 0) {
    return {
      ok: false,
      benchmarkId,
      command,
      errorCode: "process-exit-nonzero",
      message:
        `Benchmark CLI exited with non-zero status (${commandResult.status}) for command "${command}". ` +
        `Invoked: ${invokedCommand}. Output: ${toReadableProcessMessage(stdout, stderr)}. stdin payload: ${inputJson}`,
      exitCode: commandResult.status,
      stdout,
      stderr,
      cacheRepoPath,
      cliEntrypointPath: cliEntrypoint.relativePath,
    };
  }

  const trimmedStdout = stdout.trim();
  if (trimmedStdout.length === 0) {
    return {
      ok: false,
      benchmarkId,
      command,
      errorCode: "empty-stdout",
      message: `Benchmark CLI returned empty stdout for command "${command}". Expected JSON payload.`,
      exitCode: commandResult.status,
      stdout,
      stderr,
      cacheRepoPath,
      cliEntrypointPath: cliEntrypoint.relativePath,
    };
  }

  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(trimmedStdout);
  } catch {
    return {
      ok: false,
      benchmarkId,
      command,
      errorCode: "invalid-json-output",
      message: `Benchmark CLI returned invalid JSON on stdout for command "${command}".`,
      exitCode: commandResult.status,
      stdout,
      stderr,
      cacheRepoPath,
      cliEntrypointPath: cliEntrypoint.relativePath,
    };
  }

  return {
    ok: true,
    benchmarkId,
    command,
    data: parsedOutput as TData,
    stdout,
    cacheRepoPath,
    cliEntrypointPath: cliEntrypoint.relativePath,
  };
}

function parseDescribeRoot(rawDescribe: unknown): BenchmarkCliDescribeRoot {
  const root = isRecord(rawDescribe) ? rawDescribe : {};
  const commands = Array.isArray(root.commands)
    ? root.commands.filter((item): item is string => typeof item === "string")
    : [];
  const topLevelGenerate = isRecord(root.generate) ? root.generate : null;

  return {
    displayName: typeof root.displayName === "string" ? root.displayName : "",
    description: typeof root.description === "string" ? root.description : "",
    contractVersion: typeof root.contractVersion === "string" ? root.contractVersion : BENCHMARK_CLI_CONTRACT_VERSION,
    commands,
    generateRecord: topLevelGenerate,
  };
}

function extractSupportedCommandSet(commands: string[]): Set<BenchmarkCliCommand> {
  const supported = new Set<BenchmarkCliCommand>();

  const knownCommands: BenchmarkCliCommand[] = ["describe", "generate", "score", "analyze"];
  for (const commandName of commands) {
    if (knownCommands.includes(commandName as BenchmarkCliCommand)) {
      supported.add(commandName as BenchmarkCliCommand);
    }
  }

  return supported;
}

function toIntegerOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (!Number.isInteger(value)) {
    return null;
  }

  return value;
}

function normalizeDescribeGenerateField(field: unknown): BenchmarkCliDescribeField | null {
  if (!isRecord(field)) {
    return null;
  }

  const name = typeof field.name === "string" ? field.name.trim() : "";
  const fieldType = typeof field.type === "string" ? field.type.trim() : "";
  const required = typeof field.required === "boolean" ? field.required : false;
  const description = typeof field.description === "string" ? field.description.trim() : "";

  const validFieldTypes: BenchmarkCliDescribeFieldType[] = ["string", "integer", "select", "boolean"];
  if (name.length === 0 || !validFieldTypes.includes(fieldType as BenchmarkCliDescribeFieldType)) {
    return null;
  }

  const options: BenchmarkCliDescribeSelectOption[] = [];
  if (fieldType === "select" && Array.isArray(field.options)) {
    for (const option of field.options) {
      if (!isRecord(option)) {
        continue;
      }

      const value = typeof option.value === "string" ? option.value : "";
      if (value.length === 0) {
        continue;
      }

      const label = typeof option.label === "string" && option.label.trim().length > 0 ? option.label : value;
      options.push({ value, label });
    }
  }

  return {
    name,
    type: fieldType as BenchmarkCliDescribeFieldType,
    required,
    description,
    defaultValue: field.default,
    min: toIntegerOrNull(field.min),
    max: toIntegerOrNull(field.max),
    options,
  };
}

export function parseBenchmarkCliDescribeMetadata(benchmarkId: string, rawDescribe: unknown): BenchmarkCliDescribeMetadata {
  const resolvedBenchmarkId = benchmarkId.trim();
  const describeRoot = parseDescribeRoot(rawDescribe);
  const supportedCommands = extractSupportedCommandSet(describeRoot.commands);
  const generateRecord = describeRoot.generateRecord;
  const generateFieldsSource = Array.isArray(generateRecord?.fields) ? generateRecord.fields : [];

  const generateFields = generateFieldsSource
    .map((field) => normalizeDescribeGenerateField(field))
    .filter((field): field is BenchmarkCliDescribeField => field !== null);

  return {
    benchmarkId: resolvedBenchmarkId,
    contractVersion: describeRoot.contractVersion,
    displayName: describeRoot.displayName,
    description: describeRoot.description,
    supportsDescribe: supportedCommands.has("describe"),
    supportsGenerate: supportedCommands.has("generate"),
    supportsScore: supportedCommands.has("score"),
    supportsAnalyze: supportedCommands.has("analyze"),
    generateFields,
    raw: rawDescribe,
  };
}

export function runBenchmarkCliDescribe(benchmarkId: string): BenchmarkCliResult {
  return runBenchmarkCliCommand(benchmarkId, "describe", createEnvelope(benchmarkId));
}

export function runBenchmarkCliGenerate(benchmarkId: string, inputPayload: Record<string, unknown>): BenchmarkCliResult {
  const inputSeed = inputPayload.seed;
  const seed = typeof inputSeed === "string" ? inputSeed : String(inputSeed ?? "");

  const params = isRecord(inputPayload.params) ? { ...inputPayload.params } : {};

  return runBenchmarkCliCommand(benchmarkId, "generate", {
    ...createEnvelope(benchmarkId),
    seed,
    params,
  });
}

export function runBenchmarkCliScore(benchmarkId: string, input: BenchmarkCliScoreInput): BenchmarkCliResult {
  return runBenchmarkCliCommand(benchmarkId, "score", {
    ...createEnvelope(benchmarkId),
    instance: input.instance,
    response: {
      text: input.responseText,
    },
  });
}

export function runBenchmarkCliAnalyze(benchmarkId: string, input: BenchmarkCliAnalyzeInput): BenchmarkCliResult {
  return runBenchmarkCliCommand(benchmarkId, "analyze", {
    ...createEnvelope(benchmarkId),
    instance: input.instance,
    response: {
      text: input.responseText,
    },
  });
}
