import { describe, expect, it, vi } from "vitest";

import { generateStatefulToolTaskFromSeed } from "../environments/stateful_tools";
import {
  ROLLBACK_REPORT_STALENESS_V1_CASES,
  ROLLBACK_REPORT_STALENESS_V1_SUITE_ID,
  materializeRollbackReportStalenessV1Suite,
  validateRollbackReportStalenessV1TaskSnapshot,
} from "./rollbackReportStalenessV1Suite";

describe("rollback-report-staleness-v1 suite composition", () => {
  it("uses expected suite id and exact case counts by role/stratum", () => {
    expect(ROLLBACK_REPORT_STALENESS_V1_SUITE_ID).toBe("rollback-report-staleness-v1");
    expect(ROLLBACK_REPORT_STALENESS_V1_CASES).toHaveLength(22);

    const roleCounts = ROLLBACK_REPORT_STALENESS_V1_CASES.reduce(
      (acc, suiteCase) => {
        acc[suiteCase.role] += 1;
        return acc;
      },
      { regression: 0, discovery: 0, held_out: 0 },
    );
    expect(roleCounts).toEqual({ regression: 3, discovery: 7, held_out: 12 });

    const stratumCounts = ROLLBACK_REPORT_STALENESS_V1_CASES.reduce(
      (acc, suiteCase) => {
        acc[suiteCase.stratum] += 1;
        return acc;
      },
      {
        state_regression: 0,
        manual_discovery: 0,
        generated_discovery: 0,
        held_out_surface_or_numeric: 0,
        held_out_contextual: 0,
      },
    );

    expect(stratumCounts).toEqual({
      state_regression: 3,
      manual_discovery: 1,
      generated_discovery: 6,
      held_out_surface_or_numeric: 6,
      held_out_contextual: 6,
    });
  });

  it("has unique case ids, unique seeds, and only declared 0-3 seeds", () => {
    const caseIds = ROLLBACK_REPORT_STALENESS_V1_CASES.map((suiteCase) => suiteCase.caseId);
    const seeds = ROLLBACK_REPORT_STALENESS_V1_CASES.map((suiteCase) => suiteCase.seed);

    expect(new Set(caseIds).size).toBe(caseIds.length);
    expect(new Set(seeds).size).toBe(seeds.length);

    const seedsZeroToThree = ROLLBACK_REPORT_STALENESS_V1_CASES
      .filter((suiteCase) => suiteCase.seed >= 0 && suiteCase.seed <= 3)
      .map((suiteCase) => suiteCase.caseId)
      .sort();

    expect(seedsZeroToThree).toEqual([
      "discovery-manual-seed-3",
      "regression-seed-0",
      "regression-seed-1",
      "regression-seed-2",
    ]);
  });

  it("keeps held-out roles isolated from discovery/regression roles", () => {
    const heldOutCases = ROLLBACK_REPORT_STALENESS_V1_CASES.filter(
      (suiteCase) =>
        suiteCase.stratum === "held_out_surface_or_numeric" || suiteCase.stratum === "held_out_contextual",
    );

    expect(heldOutCases).toHaveLength(12);
    expect(heldOutCases.every((suiteCase) => suiteCase.role === "held_out")).toBe(true);
  });
});

describe("rollback-report-staleness-v1 materialization", () => {
  it("materializes all 22 tasks and matches expected snapshots", () => {
    const materialized = materializeRollbackReportStalenessV1Suite();
    expect(materialized).toHaveLength(22);

    for (const materializedCase of materialized) {
      validateRollbackReportStalenessV1TaskSnapshot(
        materializedCase.caseId,
        materializedCase.expectedSnapshot,
        materializedCase.task,
      );

      const regenerated = generateStatefulToolTaskFromSeed(materializedCase.seed);
      expect(materializedCase.task).toEqual(regenerated);
    }
  });

  it("preserves frozen seed 3 manual discovery metadata", () => {
    const seed3Case = materializeRollbackReportStalenessV1Suite().find(
      (suiteCase) => suiteCase.caseId === "discovery-manual-seed-3",
    );

    expect(seed3Case).toBeDefined();
    if (!seed3Case) {
      throw new Error("missing seed 3 case");
    }

    expect(seed3Case.seed).toBe(3);
    expect(seed3Case.task.taskId).toBe("task-rollback-report-3");
    expect(seed3Case.task.generation.source).toBe("manual");
    expect(seed3Case.task.generation.generatorVersion).toBe("manual_frozen_discovery_seed3_v1");
    expect(seed3Case.task.generation.factors).toEqual({
      targetSku: "SKU_Z",
      targetInitialInventory: 9,
      reservationQuantity: 4,
      reservationId: "res-3-D",
      irrelevantSkuCount: 0,
      irrelevantInventory: {},
      instructionTemplate: "manual_frozen_discovery_seed3_v1",
    });
  });

  it("ensures all held-out tasks are rollback_with_final_state_report", () => {
    const heldOutCases = materializeRollbackReportStalenessV1Suite().filter(
      (suiteCase) => suiteCase.role === "held_out",
    );

    expect(heldOutCases).toHaveLength(12);
    expect(
      heldOutCases.every(
        (suiteCase) => suiteCase.task.goal.goalType === "rollback_with_final_state_report",
      ),
    ).toBe(true);
  });
});

describe("rollback-report-staleness-v1 drift detection and immutability", () => {
  it("throws a precise mismatch error when snapshot/task drift occurs", () => {
    const generated = generateStatefulToolTaskFromSeed(4);
    const drifted = JSON.parse(JSON.stringify(generated)) as typeof generated;
    drifted.generation.factors.irrelevantInventory.SKU_MUTATED = 999;

    const expectedSnapshot = {
      taskId: generated.taskId,
      seed: generated.seed,
      goalType: generated.goal.goalType,
      generationSource: generated.generation.source,
      generationVersion: generated.generation.generatorVersion,
      factors: JSON.parse(JSON.stringify(generated.generation.factors)),
      targetExpectedFinalInventory: generated.expectedFinalInventory[generated.goal.sku],
      expectedReservation: {
        reservationId: generated.expectedReservationId,
        sku: generated.goal.sku,
        quantity: generated.goal.quantity,
        status: generated.expectedReservations[generated.expectedReservationId].status,
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory:
        generated.goal.goalType === "rollback_with_final_state_report"
          ? generated.goal.reportRequirement.expectedAvailableInventory
          : null,
    } as const;

    expect(() =>
      validateRollbackReportStalenessV1TaskSnapshot("held-out-b-seed-4", expectedSnapshot, drifted),
    ).toThrowError(/suite case held-out-b-seed-4 metadata mismatch: irrelevantInventory/);
  });

  it("returns defensive copies so mutations do not leak into future materialization or manifest", () => {
    const first = materializeRollbackReportStalenessV1Suite();
    const firstCase = first.find((suiteCase) => suiteCase.caseId === "held-out-b-seed-4");
    expect(firstCase).toBeDefined();
    if (!firstCase) {
      throw new Error("missing held-out-b-seed-4");
    }

    firstCase.task.generation.factors.irrelevantInventory.SKU_LEAK = 1;
    firstCase.expectedSnapshot.factors.irrelevantInventory.SKU_SNAPSHOT_LEAK = 2;

    const second = materializeRollbackReportStalenessV1Suite();
    const secondCase = second.find((suiteCase) => suiteCase.caseId === "held-out-b-seed-4");
    expect(secondCase).toBeDefined();
    if (!secondCase) {
      throw new Error("missing held-out-b-seed-4 on rematerialization");
    }

    expect(secondCase.task.generation.factors.irrelevantInventory).toEqual({
      SKU_I_551_2: 13,
      SKU_I_564_1: 21,
    });
    expect(secondCase.expectedSnapshot.factors.irrelevantInventory).toEqual({
      SKU_I_551_2: 13,
      SKU_I_564_1: 21,
    });

    const manifestCase = ROLLBACK_REPORT_STALENESS_V1_CASES.find(
      (suiteCase) => suiteCase.caseId === "held-out-b-seed-4",
    );
    expect(manifestCase?.expectedSnapshot.factors.irrelevantInventory).toEqual({
      SKU_I_551_2: 13,
      SKU_I_564_1: 21,
    });
  });

  it("does not perform model/API calls during materialization", () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    (globalThis as { fetch?: typeof globalThis.fetch }).fetch = fetchSpy as typeof globalThis.fetch;
    try {
      const materialized = materializeRollbackReportStalenessV1Suite();
      expect(materialized).toHaveLength(22);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      (globalThis as { fetch?: typeof globalThis.fetch }).fetch = originalFetch;
    }
  });
});

