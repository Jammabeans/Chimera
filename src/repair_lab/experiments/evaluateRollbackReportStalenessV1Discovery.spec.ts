import { describe, expect, it, vi } from "vitest";

import { generateStatefulToolTaskFromSeed, type StatefulToolTask, type VerificationCode } from "../environments/stateful_tools";
import type { OpenAiStatefulToolsRunResult } from "../runners/openaiStatefulToolsRunner";
import {
  assertDiscoveryCaseRoleForDispatch,
  evaluateRollbackReportStalenessV1Discovery,
  type RollbackReportStalenessV1DiscoveryRunner,
} from "./evaluateRollbackReportStalenessV1Discovery";
import {
  materializeRollbackReportStalenessV1Suite,
  ROLLBACK_REPORT_STALENESS_V1_SUITE_ID,
} from "./rollbackReportStalenessV1Suite";

function createMockRunResult(params: {
  task: StatefulToolTask;
  passed: boolean;
  failureCodes?: VerificationCode[];
  terminationReason?: string;
}): OpenAiStatefulToolsRunResult {
  return {
    status: "completed",
    baselineConfig: {
      provider: "openai",
      model: "mock-model",
      temperature: 0,
      maxToolCallRounds: 6,
    },
    task: {
      taskId: params.task.taskId,
      seed: params.task.seed,
      generation: JSON.parse(JSON.stringify(params.task.generation)) as StatefulToolTask["generation"],
    },
    systemPrompt: "mock system prompt",
    taskInstruction: "mock task instruction",
    modelTurns: [],
    dispatchedToolCalls: [],
    finalModelText: null,
    simulatorFinalState: {
      inventory: JSON.parse(JSON.stringify(params.task.expectedFinalInventory)) as StatefulToolTask["expectedFinalInventory"],
      reservations: {},
      version: 0,
    },
    simulatorTrace: [],
    verifierResult: {
      passed: params.passed,
      failureCodes: params.failureCodes ?? [],
      evidence: [],
      observedStateSummary: {
        inventory: JSON.parse(JSON.stringify(params.task.expectedFinalInventory)) as StatefulToolTask["expectedFinalInventory"],
        activeReservationIds: [],
        cancelledReservationIds: [],
        version: 0,
      },
    },
    terminationReason: params.terminationReason ?? "mock_termination_reason",
    requestCount: 0,
    toolCallRounds: 0,
    requestLatenciesMs: [],
    totalLatencyMs: 0,
    usage: {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
    },
    error: null,
  };
}

describe("evaluateRollbackReportStalenessV1Discovery", () => {
  it("dispatches only frozen discovery cases with deterministic order and 1-based repetition", async () => {
    const suite = materializeRollbackReportStalenessV1Suite();
    const discoveryCases = suite.filter((suiteCase) => suiteCase.role === "discovery");

    const callRecords: Array<{ taskId: string; seed: number }> = [];
    const mockRunner: RollbackReportStalenessV1DiscoveryRunner = vi.fn(async (task) => {
      callRecords.push({ taskId: task.taskId, seed: task.seed });
      return createMockRunResult({ task, passed: true });
    });

    const result = await evaluateRollbackReportStalenessV1Discovery({
      repetitions: 3,
      runner: mockRunner,
    });

    expect(result.suiteId).toBe(ROLLBACK_REPORT_STALENESS_V1_SUITE_ID);
    expect(callRecords).toHaveLength(21);
    expect(result.executions).toHaveLength(21);

    const expectedOrderedPairs = discoveryCases.flatMap((suiteCase) => [
      { taskId: suiteCase.task.taskId, seed: suiteCase.seed, repetition: 1 },
      { taskId: suiteCase.task.taskId, seed: suiteCase.seed, repetition: 2 },
      { taskId: suiteCase.task.taskId, seed: suiteCase.seed, repetition: 3 },
    ]);

    expect(
      result.executions.map((execution) => ({
        taskId: execution.runnerResult.task.taskId,
        seed: execution.seed,
        repetition: execution.repetition,
      })),
    ).toEqual(expectedOrderedPairs);

    expect(callRecords).toEqual(
      expectedOrderedPairs.map((entry) => ({
        taskId: entry.taskId,
        seed: entry.seed,
      })),
    );

    const calledSeeds = new Set(callRecords.map((entry) => entry.seed));
    const nonDiscoverySeeds = suite
      .filter((suiteCase) => suiteCase.role !== "discovery")
      .map((suiteCase) => suiteCase.seed);
    expect(nonDiscoverySeeds.some((seed) => calledSeeds.has(seed))).toBe(false);

    expect(new Set(result.executions.map((execution) => execution.role))).toEqual(new Set(["discovery"]));
  });

  it("retains full runner results on each execution record", async () => {
    const resultByTaskId = new Map<string, OpenAiStatefulToolsRunResult>();
    const mockRunner: RollbackReportStalenessV1DiscoveryRunner = vi.fn(async (task) => {
      const runnerResult = createMockRunResult({ task, passed: true, terminationReason: `mock-${task.taskId}` });
      resultByTaskId.set(task.taskId, runnerResult);
      return runnerResult;
    });

    const evaluation = await evaluateRollbackReportStalenessV1Discovery({
      repetitions: 1,
      runner: mockRunner,
    });

    for (const execution of evaluation.executions) {
      const expectedRunnerResult = resultByTaskId.get(execution.runnerResult.task.taskId);
      expect(expectedRunnerResult).toBeDefined();
      expect(execution.runnerResult).toBe(expectedRunnerResult);
    }
  });

  it("computes aggregate pass/fail counts and failure-code counts from verifier results", async () => {
    const suite = materializeRollbackReportStalenessV1Suite().filter((suiteCase) => suiteCase.role === "discovery");
    const planByTaskId = new Map<string, { passed: boolean; failureCodes: VerificationCode[] }>([
      [suite[0].task.taskId, { passed: true, failureCodes: [] }],
      [suite[1].task.taskId, { passed: false, failureCodes: ["final_report_inventory_mismatch"] }],
      [
        suite[2].task.taskId,
        {
          passed: false,
          failureCodes: ["required_tool_sequence_mismatch", "final_report_inventory_mismatch"],
        },
      ],
      [suite[3].task.taskId, { passed: true, failureCodes: [] }],
      [suite[4].task.taskId, { passed: false, failureCodes: ["final_report_missing"] }],
      [suite[5].task.taskId, { passed: true, failureCodes: [] }],
      [suite[6].task.taskId, { passed: false, failureCodes: ["final_report_inventory_mismatch"] }],
    ]);

    const mockRunner: RollbackReportStalenessV1DiscoveryRunner = vi.fn(async (task) => {
      const planned = planByTaskId.get(task.taskId);
      if (!planned) {
        throw new Error(`missing plan for ${task.taskId}`);
      }

      return createMockRunResult({
        task,
        passed: planned.passed,
        failureCodes: planned.failureCodes,
      });
    });

    const evaluation = await evaluateRollbackReportStalenessV1Discovery({
      repetitions: 1,
      runner: mockRunner,
    });

    expect(evaluation.summary.totalExecutions).toBe(7);
    expect(evaluation.summary.verifierPassCount).toBe(3);
    expect(evaluation.summary.verifierFailCount).toBe(4);
    expect(evaluation.summary.verifierFailureCodeCounts).toEqual({
      final_report_inventory_mismatch: 3,
      required_tool_sequence_mismatch: 1,
      final_report_missing: 1,
    });
  });

  it("throws on invalid repetitions before calling runner", async () => {
    const mockRunner: RollbackReportStalenessV1DiscoveryRunner = vi.fn(async (task) => {
      return createMockRunResult({ task, passed: true });
    });

    await expect(
      evaluateRollbackReportStalenessV1Discovery({ repetitions: 0, runner: mockRunner }),
    ).rejects.toThrowError(/repetitions must be a positive finite integer/);
    await expect(
      evaluateRollbackReportStalenessV1Discovery({ repetitions: -1, runner: mockRunner }),
    ).rejects.toThrowError(/repetitions must be a positive finite integer/);
    await expect(
      evaluateRollbackReportStalenessV1Discovery({ repetitions: 1.5, runner: mockRunner }),
    ).rejects.toThrowError(/repetitions must be a positive finite integer/);
    await expect(
      evaluateRollbackReportStalenessV1Discovery({ repetitions: Number.NaN, runner: mockRunner }),
    ).rejects.toThrowError(/repetitions must be a positive finite integer/);
    await expect(
      evaluateRollbackReportStalenessV1Discovery({ repetitions: Number.POSITIVE_INFINITY, runner: mockRunner }),
    ).rejects.toThrowError(/repetitions must be a positive finite integer/);

    expect(mockRunner).not.toHaveBeenCalled();
  });

  it("role isolation guard throws clear errors for held_out and regression cases", () => {
    const suite = materializeRollbackReportStalenessV1Suite();
    const heldOutCase = suite.find((suiteCase) => suiteCase.role === "held_out");
    const regressionCase = suite.find((suiteCase) => suiteCase.role === "regression");

    expect(heldOutCase).toBeDefined();
    expect(regressionCase).toBeDefined();
    if (!heldOutCase || !regressionCase) {
      throw new Error("expected held_out and regression cases in suite");
    }

    expect(() => assertDiscoveryCaseRoleForDispatch(heldOutCase)).toThrowError(
      /refused to dispatch held_out case/,
    );
    expect(() => assertDiscoveryCaseRoleForDispatch(regressionCase)).toThrowError(
      /refused to dispatch regression case/,
    );
  });

  it("uses injected runner only and performs no fetch/network calls", async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    (globalThis as { fetch?: typeof globalThis.fetch }).fetch = fetchSpy as typeof globalThis.fetch;

    const mockRunner: RollbackReportStalenessV1DiscoveryRunner = vi.fn(async (task) => {
      return createMockRunResult({ task, passed: true });
    });

    try {
      const evaluation = await evaluateRollbackReportStalenessV1Discovery({
        repetitions: 1,
        runner: mockRunner,
      });
      expect(evaluation.executions).toHaveLength(7);
      expect(mockRunner).toHaveBeenCalledTimes(7);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      (globalThis as { fetch?: typeof globalThis.fetch }).fetch = originalFetch;
    }
  });

  it("reference-only sanity: discovery executions align with frozen seeds [3,6,10,22,26,38,66]", async () => {
    const mockRunner: RollbackReportStalenessV1DiscoveryRunner = vi.fn(async (task) => {
      return createMockRunResult({ task, passed: true });
    });

    const evaluation = await evaluateRollbackReportStalenessV1Discovery({
      repetitions: 1,
      runner: mockRunner,
    });

    expect(evaluation.executions.map((execution) => execution.seed)).toEqual([3, 6, 10, 22, 26, 38, 66]);
  });

  it("mock result factory sanity", () => {
    const task = generateStatefulToolTaskFromSeed(3);
    const runResult = createMockRunResult({
      task,
      passed: false,
      failureCodes: ["final_report_inventory_mismatch"],
    });

    expect(runResult.task.taskId).toBe(task.taskId);
    expect(runResult.verifierResult.passed).toBe(false);
    expect(runResult.verifierResult.failureCodes).toEqual(["final_report_inventory_mismatch"]);
  });
});

