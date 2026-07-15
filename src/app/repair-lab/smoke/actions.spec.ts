import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RollbackReportStalenessV1DiscoveryEvaluationResult } from "../../../repair_lab/experiments/evaluateRollbackReportStalenessV1Discovery";

const { evaluateRollbackReportStalenessV1DiscoveryMock } = vi.hoisted(() => ({
  evaluateRollbackReportStalenessV1DiscoveryMock: vi.fn(),
}));

vi.mock("@/repair_lab/environments/stateful_tools", () => ({
  generateStatefulToolTaskFromSeed: vi.fn(),
}));

vi.mock("@/repair_lab/runners/openaiStatefulToolsRunner", () => ({
  runOpenAiStatefulToolTask: vi.fn(),
}));

vi.mock("@/repair_lab/experiments/evaluateRollbackReportStalenessV1Discovery", () => ({
  evaluateRollbackReportStalenessV1Discovery: evaluateRollbackReportStalenessV1DiscoveryMock,
}));

import {
  runRollbackReportStalenessV1DiscoveryBaselineAction,
} from "./actions";

const EXPECTED_REPETITIONS = 3;

function createMockEvaluationResult(): RollbackReportStalenessV1DiscoveryEvaluationResult {
  return {
    suiteId: "rollback-report-staleness-v1",
    repetitions: 3,
    executions: [
      {
        suiteId: "rollback-report-staleness-v1",
        caseId: "rollback-report-staleness-v1-discovery-seed-3",
        seed: 3,
        role: "discovery",
        stratum: "low_inventory_pressure",
        repetition: 1,
        runnerResult: {
          status: "completed",
          baselineConfig: {
            provider: "openai",
            model: "gpt-4o-mini-2024-07-18",
            temperature: 0,
            maxToolCallRounds: 6,
          },
          task: {
            taskId: "stateful-tools-seed-3",
            seed: 3,
            generation: {},
          },
          systemPrompt: "mock system prompt",
          taskInstruction: "mock task instruction",
          modelTurns: [],
          dispatchedToolCalls: [],
          finalModelText: "mock model output",
          simulatorFinalState: {
            inventory: {},
            reservations: {},
            version: 0,
          },
          simulatorTrace: [],
          verifierResult: {
            passed: true,
            failureCodes: [],
            evidence: [],
            observedStateSummary: {
              inventory: {},
              activeReservationIds: [],
              cancelledReservationIds: [],
              version: 0,
            },
          },
          terminationReason: "completed_without_tool_calls",
          requestCount: 1,
          toolCallRounds: 0,
          requestLatenciesMs: [10],
          totalLatencyMs: 10,
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
          },
          error: null,
        },
      },
    ],
    summary: {
      totalExecutions: 1,
      verifierPassCount: 1,
      verifierFailCount: 0,
      verifierFailureCodeCounts: {},
    },
  } as unknown as RollbackReportStalenessV1DiscoveryEvaluationResult;
}

describe("runRollbackReportStalenessV1DiscoveryBaselineAction", () => {
  beforeEach(() => {
    evaluateRollbackReportStalenessV1DiscoveryMock.mockReset();
  });

  it("invokes evaluator with repetitions fixed to 3 and returns full success envelope", async () => {
    const evaluation = createMockEvaluationResult();
    evaluateRollbackReportStalenessV1DiscoveryMock.mockResolvedValueOnce(evaluation);

    const result = await runRollbackReportStalenessV1DiscoveryBaselineAction();

    expect(evaluateRollbackReportStalenessV1DiscoveryMock).toHaveBeenCalledTimes(1);
    expect(evaluateRollbackReportStalenessV1DiscoveryMock).toHaveBeenCalledWith({
      repetitions: EXPECTED_REPETITIONS,
    });
    expect(result).toEqual({
      status: "ok",
      evaluation,
    });
  });

  it("does not accept or forward arbitrary client-provided execution controls", async () => {
    const evaluation = createMockEvaluationResult();
    evaluateRollbackReportStalenessV1DiscoveryMock.mockResolvedValueOnce(evaluation);

    const callWithUnexpectedArgs =
      runRollbackReportStalenessV1DiscoveryBaselineAction as unknown as (...args: unknown[]) => Promise<unknown>;

    await callWithUnexpectedArgs({
      seed: 999,
      role: "held_out",
      model: "other-model",
      provider: "other-provider",
      repetitions: 999,
      suite: "other-suite",
      temperature: 1,
    });

    expect(evaluateRollbackReportStalenessV1DiscoveryMock).toHaveBeenCalledTimes(1);
    expect(evaluateRollbackReportStalenessV1DiscoveryMock).toHaveBeenCalledWith({
      repetitions: EXPECTED_REPETITIONS,
    });
  });

  it("returns a safe serializable error envelope when evaluator throws", async () => {
    evaluateRollbackReportStalenessV1DiscoveryMock.mockRejectedValueOnce(new Error("sensitive raw failure detail"));

    const result = await runRollbackReportStalenessV1DiscoveryBaselineAction();

    expect(evaluateRollbackReportStalenessV1DiscoveryMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: "error",
      message:
        "Unexpected server error while running rollback-report-staleness-v1 discovery baseline. Check server logs and retry.",
    });
    expect(JSON.stringify(result)).not.toContain("sensitive raw failure detail");
  });

  it("performs no fetch/network call from this action boundary when evaluator is mocked", async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    (globalThis as { fetch?: typeof globalThis.fetch }).fetch = fetchSpy as typeof globalThis.fetch;

    try {
      evaluateRollbackReportStalenessV1DiscoveryMock.mockResolvedValueOnce(createMockEvaluationResult());
      await runRollbackReportStalenessV1DiscoveryBaselineAction();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(evaluateRollbackReportStalenessV1DiscoveryMock).toHaveBeenCalledWith({
        repetitions: EXPECTED_REPETITIONS,
      });
    } finally {
      (globalThis as { fetch?: typeof globalThis.fetch }).fetch = originalFetch;
    }
  });
});

