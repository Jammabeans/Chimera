import type { StatefulToolTask, VerificationCode } from "../environments/stateful_tools";
import { materializeRollbackReportStalenessV1Suite, type RollbackReportStalenessV1MaterializedCase } from "./rollbackReportStalenessV1Suite";
import { ROLLBACK_REPORT_STALENESS_V1_SUITE_ID } from "./rollbackReportStalenessV1Suite";
import {
  runOpenAiStatefulToolTask,
  type OpenAiStatefulToolsRunResult,
} from "../runners/openaiStatefulToolsRunner";

export type RollbackReportStalenessV1DiscoveryRunner = (
  task: StatefulToolTask,
) => Promise<OpenAiStatefulToolsRunResult>;

export interface EvaluateRollbackReportStalenessV1DiscoveryParams {
  repetitions: number;
  runner?: RollbackReportStalenessV1DiscoveryRunner;
}

export interface RollbackReportStalenessV1DiscoveryExecutionRecord {
  suiteId: typeof ROLLBACK_REPORT_STALENESS_V1_SUITE_ID;
  caseId: string;
  seed: number;
  role: "discovery";
  stratum: RollbackReportStalenessV1MaterializedCase["stratum"];
  repetition: number;
  runnerResult: OpenAiStatefulToolsRunResult;
}

export interface RollbackReportStalenessV1DiscoverySummary {
  totalExecutions: number;
  verifierPassCount: number;
  verifierFailCount: number;
  verifierFailureCodeCounts: Partial<Record<VerificationCode, number>>;
}

export interface RollbackReportStalenessV1DiscoveryEvaluationResult {
  suiteId: typeof ROLLBACK_REPORT_STALENESS_V1_SUITE_ID;
  repetitions: number;
  executions: RollbackReportStalenessV1DiscoveryExecutionRecord[];
  summary: RollbackReportStalenessV1DiscoverySummary;
}

function assertPositiveFiniteIntegerRepetitions(repetitions: number): void {
  if (!Number.isFinite(repetitions) || !Number.isInteger(repetitions) || repetitions <= 0) {
    throw new Error(`Invalid repetitions: ${String(repetitions)}. repetitions must be a positive finite integer.`);
  }
}

export function assertDiscoveryCaseRoleForDispatch(suiteCase: RollbackReportStalenessV1MaterializedCase): asserts suiteCase is RollbackReportStalenessV1MaterializedCase & { role: "discovery" } {
  if (suiteCase.role === "discovery") {
    return;
  }

  if (suiteCase.role === "held_out") {
    throw new Error(
      `Rollback report discovery evaluator refused to dispatch held_out case ${suiteCase.caseId}. held_out cases are never executable by this evaluator.`,
    );
  }

  throw new Error(
    `Rollback report discovery evaluator refused to dispatch regression case ${suiteCase.caseId}. regression cases are never executable by this evaluator.`,
  );
}

function toSummary(
  executions: RollbackReportStalenessV1DiscoveryExecutionRecord[],
): RollbackReportStalenessV1DiscoverySummary {
  const verifierPassCount = executions.reduce(
    (count, execution) => count + (execution.runnerResult.verifierResult.passed ? 1 : 0),
    0,
  );
  const verifierFailureCodeCounts: Partial<Record<VerificationCode, number>> = {};

  for (const execution of executions) {
    if (execution.runnerResult.verifierResult.passed) {
      continue;
    }

    for (const failureCode of execution.runnerResult.verifierResult.failureCodes) {
      verifierFailureCodeCounts[failureCode] = (verifierFailureCodeCounts[failureCode] ?? 0) + 1;
    }
  }

  return {
    totalExecutions: executions.length,
    verifierPassCount,
    verifierFailCount: executions.length - verifierPassCount,
    verifierFailureCodeCounts,
  };
}

export async function evaluateRollbackReportStalenessV1Discovery(
  params: EvaluateRollbackReportStalenessV1DiscoveryParams,
): Promise<RollbackReportStalenessV1DiscoveryEvaluationResult> {
  assertPositiveFiniteIntegerRepetitions(params.repetitions);

  const runner = params.runner ?? runOpenAiStatefulToolTask;
  const suite = materializeRollbackReportStalenessV1Suite();
  const executions: RollbackReportStalenessV1DiscoveryExecutionRecord[] = [];

  for (const suiteCase of suite) {
    if (suiteCase.role !== "discovery") {
      continue;
    }

    for (let repetition = 1; repetition <= params.repetitions; repetition += 1) {
      assertDiscoveryCaseRoleForDispatch(suiteCase);
      const runnerResult = await runner(suiteCase.task);
      executions.push({
        suiteId: ROLLBACK_REPORT_STALENESS_V1_SUITE_ID,
        caseId: suiteCase.caseId,
        seed: suiteCase.seed,
        role: suiteCase.role,
        stratum: suiteCase.stratum,
        repetition,
        runnerResult,
      });
    }
  }

  return {
    suiteId: ROLLBACK_REPORT_STALENESS_V1_SUITE_ID,
    repetitions: params.repetitions,
    executions,
    summary: toSummary(executions),
  };
}

