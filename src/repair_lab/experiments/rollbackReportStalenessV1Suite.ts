import {
  type ReservationStatus,
  generateStatefulToolTaskFromSeed,
  type StatefulTaskGenerationFactors,
  type StatefulTaskGenerationMetadata,
  type StatefulToolTask,
} from "../environments/stateful_tools";

export const ROLLBACK_REPORT_STALENESS_V1_SUITE_ID = "rollback-report-staleness-v1" as const;

export type RollbackReportSuiteRole = "regression" | "discovery" | "held_out";

export type RollbackReportSuiteStratum =
  | "state_regression"
  | "manual_discovery"
  | "generated_discovery"
  | "held_out_surface_or_numeric"
  | "held_out_contextual";

export interface RollbackReportStalenessV1ExpectedSnapshot {
  taskId: string;
  seed: number;
  goalType: StatefulToolTask["goal"]["goalType"];
  generationSource: StatefulTaskGenerationMetadata["source"];
  generationVersion: string;
  factors: StatefulTaskGenerationFactors;
  targetExpectedFinalInventory: number;
  expectedReservation: {
    reservationId: string;
    sku: string;
    quantity: number;
    status: ReservationStatus;
  };
  requiresFinalStateReport: boolean;
  reportExpectedAvailableInventory: number | null;
}

export interface RollbackReportStalenessV1ManifestCase {
  caseId: string;
  seed: number;
  role: RollbackReportSuiteRole;
  stratum: RollbackReportSuiteStratum;
  expectedSnapshot: RollbackReportStalenessV1ExpectedSnapshot;
}

export interface RollbackReportStalenessV1MaterializedCase {
  caseId: string;
  role: RollbackReportSuiteRole;
  stratum: RollbackReportSuiteStratum;
  seed: number;
  expectedSnapshot: RollbackReportStalenessV1ExpectedSnapshot;
  task: StatefulToolTask;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }

  return JSON.stringify(String(value));
}

function toMismatchError(caseId: string, field: string, expected: unknown, actual: unknown): Error {
  return new Error(
    `suite case ${caseId} metadata mismatch: ${field} (expected ${stableJson(expected)}, actual ${stableJson(actual)})`,
  );
}

function assertField(
  caseId: string,
  field: string,
  expected: unknown,
  actual: unknown,
): void {
  if (stableJson(expected) !== stableJson(actual)) {
    throw toMismatchError(caseId, field, expected, actual);
  }
}

function createSnapshot(params: {
  taskId: string;
  seed: number;
  goalType: StatefulToolTask["goal"]["goalType"];
  generationSource: StatefulTaskGenerationMetadata["source"];
  generationVersion: string;
  factors: StatefulTaskGenerationFactors;
  targetExpectedFinalInventory: number;
  expectedReservation: {
    reservationId: string;
    sku: string;
    quantity: number;
    status: ReservationStatus;
  };
  requiresFinalStateReport: boolean;
  reportExpectedAvailableInventory: number | null;
}): RollbackReportStalenessV1ExpectedSnapshot {
  return {
    taskId: params.taskId,
    seed: params.seed,
    goalType: params.goalType,
    generationSource: params.generationSource,
    generationVersion: params.generationVersion,
    factors: deepClone(params.factors),
    targetExpectedFinalInventory: params.targetExpectedFinalInventory,
    expectedReservation: deepClone(params.expectedReservation),
    requiresFinalStateReport: params.requiresFinalStateReport,
    reportExpectedAvailableInventory: params.reportExpectedAvailableInventory,
  };
}

function createManifestCase(params: {
  caseId: string;
  seed: number;
  role: RollbackReportSuiteRole;
  stratum: RollbackReportSuiteStratum;
  expectedSnapshot: RollbackReportStalenessV1ExpectedSnapshot;
}): RollbackReportStalenessV1ManifestCase {
  return {
    caseId: params.caseId,
    seed: params.seed,
    role: params.role,
    stratum: params.stratum,
    expectedSnapshot: deepClone(params.expectedSnapshot),
  };
}

export const ROLLBACK_REPORT_STALENESS_V1_CASES: readonly RollbackReportStalenessV1ManifestCase[] = [
  createManifestCase({
    caseId: "regression-seed-0",
    seed: 0,
    role: "regression",
    stratum: "state_regression",
    expectedSnapshot: createSnapshot({
      taskId: "task-success-0",
      seed: 0,
      goalType: "successful_reservation",
      generationSource: "manual",
      generationVersion: "manual_seed_0_v1",
      factors: {
        targetSku: "SKU_A",
        targetInitialInventory: 8,
        reservationQuantity: 3,
        reservationId: "res-0-A",
        irrelevantSkuCount: 1,
        irrelevantInventory: { SKU_B: 3 },
        instructionTemplate: "manual_seed_0_v1",
      },
      targetExpectedFinalInventory: 5,
      expectedReservation: {
        reservationId: "res-0-A",
        sku: "SKU_A",
        quantity: 3,
        status: "active",
      },
      requiresFinalStateReport: false,
      reportExpectedAvailableInventory: null,
    }),
  }),
  createManifestCase({
    caseId: "regression-seed-1",
    seed: 1,
    role: "regression",
    stratum: "state_regression",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-1",
      seed: 1,
      goalType: "reservation_then_cancellation",
      generationSource: "manual",
      generationVersion: "manual_seed_1_v1",
      factors: {
        targetSku: "SKU_R",
        targetInitialInventory: 5,
        reservationQuantity: 2,
        reservationId: "res-1-B",
        irrelevantSkuCount: 1,
        irrelevantInventory: { SKU_X: 2 },
        instructionTemplate: "manual_seed_1_v1",
      },
      targetExpectedFinalInventory: 5,
      expectedReservation: {
        reservationId: "res-1-B",
        sku: "SKU_R",
        quantity: 2,
        status: "cancelled",
      },
      requiresFinalStateReport: false,
      reportExpectedAvailableInventory: null,
    }),
  }),
  createManifestCase({
    caseId: "regression-seed-2",
    seed: 2,
    role: "regression",
    stratum: "state_regression",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-strict-2",
      seed: 2,
      goalType: "reservation_then_cancellation",
      generationSource: "manual",
      generationVersion: "manual_seed_2_v1",
      factors: {
        targetSku: "SKU_Z",
        targetInitialInventory: 9,
        reservationQuantity: 4,
        reservationId: "res-2-C",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "manual_seed_2_v1",
      },
      targetExpectedFinalInventory: 9,
      expectedReservation: {
        reservationId: "res-2-C",
        sku: "SKU_Z",
        quantity: 4,
        status: "cancelled",
      },
      requiresFinalStateReport: false,
      reportExpectedAvailableInventory: null,
    }),
  }),
  createManifestCase({
    caseId: "discovery-manual-seed-3",
    seed: 3,
    role: "discovery",
    stratum: "manual_discovery",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-3",
      seed: 3,
      goalType: "rollback_with_final_state_report",
      generationSource: "manual",
      generationVersion: "manual_frozen_discovery_seed3_v1",
      factors: {
        targetSku: "SKU_Z",
        targetInitialInventory: 9,
        reservationQuantity: 4,
        reservationId: "res-3-D",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "manual_frozen_discovery_seed3_v1",
      },
      targetExpectedFinalInventory: 9,
      expectedReservation: {
        reservationId: "res-3-D",
        sku: "SKU_Z",
        quantity: 4,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 9,
    }),
  }),
  createManifestCase({
    caseId: "discovery-generated-seed-6",
    seed: 6,
    role: "discovery",
    stratum: "generated_discovery",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-6",
      seed: 6,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_123",
        targetInitialInventory: 14,
        reservationQuantity: 10,
        reservationId: "res-6-P",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 14,
      expectedReservation: {
        reservationId: "res-6-P",
        sku: "SKU_T_123",
        quantity: 10,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 14,
    }),
  }),
  createManifestCase({
    caseId: "discovery-generated-seed-10",
    seed: 10,
    role: "discovery",
    stratum: "generated_discovery",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-10",
      seed: 10,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_351",
        targetInitialInventory: 14,
        reservationQuantity: 11,
        reservationId: "res-10-P",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 14,
      expectedReservation: {
        reservationId: "res-10-P",
        sku: "SKU_T_351",
        quantity: 11,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 14,
    }),
  }),
  createManifestCase({
    caseId: "discovery-generated-seed-22",
    seed: 22,
    role: "discovery",
    stratum: "generated_discovery",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-22",
      seed: 22,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_427",
        targetInitialInventory: 9,
        reservationQuantity: 2,
        reservationId: "res-22-P",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 9,
      expectedReservation: {
        reservationId: "res-22-P",
        sku: "SKU_T_427",
        quantity: 2,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 9,
    }),
  }),
  createManifestCase({
    caseId: "discovery-generated-seed-26",
    seed: 26,
    role: "discovery",
    stratum: "generated_discovery",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-26",
      seed: 26,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_551",
        targetInitialInventory: 9,
        reservationQuantity: 6,
        reservationId: "res-26-P",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 9,
      expectedReservation: {
        reservationId: "res-26-P",
        sku: "SKU_T_551",
        quantity: 6,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 9,
    }),
  }),
  createManifestCase({
    caseId: "discovery-generated-seed-38",
    seed: 38,
    role: "discovery",
    stratum: "generated_discovery",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-38",
      seed: 38,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_627",
        targetInitialInventory: 4,
        reservationQuantity: 1,
        reservationId: "res-38-P",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 4,
      expectedReservation: {
        reservationId: "res-38-P",
        sku: "SKU_T_627",
        quantity: 1,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 4,
    }),
  }),
  createManifestCase({
    caseId: "discovery-generated-seed-66",
    seed: 66,
    role: "discovery",
    stratum: "generated_discovery",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-66",
      seed: 66,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_991",
        targetInitialInventory: 14,
        reservationQuantity: 5,
        reservationId: "res-66-P",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 14,
      expectedReservation: {
        reservationId: "res-66-P",
        sku: "SKU_T_991",
        quantity: 5,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 14,
    }),
  }),
  createManifestCase({
    caseId: "held-out-a-seed-14",
    seed: 14,
    role: "held_out",
    stratum: "held_out_surface_or_numeric",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-14",
      seed: 14,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_275",
        targetInitialInventory: 4,
        reservationQuantity: 2,
        reservationId: "res-14-P",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 4,
      expectedReservation: {
        reservationId: "res-14-P",
        sku: "SKU_T_275",
        quantity: 2,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 4,
    }),
  }),
  createManifestCase({
    caseId: "held-out-a-seed-18",
    seed: 18,
    role: "held_out",
    stratum: "held_out_surface_or_numeric",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-18",
      seed: 18,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_399",
        targetInitialInventory: 4,
        reservationQuantity: 3,
        reservationId: "res-18-P",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 4,
      expectedReservation: {
        reservationId: "res-18-P",
        sku: "SKU_T_399",
        quantity: 3,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 4,
    }),
  }),
  createManifestCase({
    caseId: "held-out-a-seed-30",
    seed: 30,
    role: "held_out",
    stratum: "held_out_surface_or_numeric",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-30",
      seed: 30,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_475",
        targetInitialInventory: 14,
        reservationQuantity: 12,
        reservationId: "res-30-P",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 14,
      expectedReservation: {
        reservationId: "res-30-P",
        sku: "SKU_T_475",
        quantity: 12,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 14,
    }),
  }),
  createManifestCase({
    caseId: "held-out-a-seed-46",
    seed: 46,
    role: "held_out",
    stratum: "held_out_surface_or_numeric",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-46",
      seed: 46,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_779",
        targetInitialInventory: 9,
        reservationQuantity: 2,
        reservationId: "res-46-P",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 9,
      expectedReservation: {
        reservationId: "res-46-P",
        sku: "SKU_T_779",
        quantity: 2,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 9,
    }),
  }),
  createManifestCase({
    caseId: "held-out-a-seed-50",
    seed: 50,
    role: "held_out",
    stratum: "held_out_surface_or_numeric",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-50",
      seed: 50,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_903",
        targetInitialInventory: 9,
        reservationQuantity: 6,
        reservationId: "res-50-P",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 9,
      expectedReservation: {
        reservationId: "res-50-P",
        sku: "SKU_T_903",
        quantity: 6,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 9,
    }),
  }),
  createManifestCase({
    caseId: "held-out-a-seed-54",
    seed: 54,
    role: "held_out",
    stratum: "held_out_surface_or_numeric",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-54",
      seed: 54,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_827",
        targetInitialInventory: 14,
        reservationQuantity: 1,
        reservationId: "res-54-P",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 14,
      expectedReservation: {
        reservationId: "res-54-P",
        sku: "SKU_T_827",
        quantity: 1,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 14,
    }),
  }),
  createManifestCase({
    caseId: "held-out-b-seed-5",
    seed: 5,
    role: "held_out",
    stratum: "held_out_contextual",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-5",
      seed: 5,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_180",
        targetInitialInventory: 14,
        reservationQuantity: 8,
        reservationId: "res-5-P",
        irrelevantSkuCount: 1,
        irrelevantInventory: {
          SKU_I_579_1: 2,
        },
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 14,
      expectedReservation: {
        reservationId: "res-5-P",
        sku: "SKU_T_180",
        quantity: 8,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 14,
    }),
  }),
  createManifestCase({
    caseId: "held-out-b-seed-17",
    seed: 17,
    role: "held_out",
    stratum: "held_out_contextual",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-17",
      seed: 17,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_456",
        targetInitialInventory: 4,
        reservationQuantity: 3,
        reservationId: "res-17-P",
        irrelevantSkuCount: 1,
        irrelevantInventory: {
          SKU_I_707_1: 22,
        },
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 4,
      expectedReservation: {
        reservationId: "res-17-P",
        sku: "SKU_T_456",
        quantity: 3,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 4,
    }),
  }),
  createManifestCase({
    caseId: "held-out-b-seed-4",
    seed: 4,
    role: "held_out",
    stratum: "held_out_contextual",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-4",
      seed: 4,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_161",
        targetInitialInventory: 4,
        reservationQuantity: 1,
        reservationId: "res-4-P",
        irrelevantSkuCount: 2,
        irrelevantInventory: {
          SKU_I_551_2: 13,
          SKU_I_564_1: 21,
        },
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 4,
      expectedReservation: {
        reservationId: "res-4-P",
        sku: "SKU_T_161",
        quantity: 1,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 4,
    }),
  }),
  createManifestCase({
    caseId: "held-out-b-seed-12",
    seed: 12,
    role: "held_out",
    stratum: "held_out_contextual",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-12",
      seed: 12,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_313",
        targetInitialInventory: 9,
        reservationQuantity: 8,
        reservationId: "res-12-P",
        irrelevantSkuCount: 2,
        irrelevantInventory: {
          SKU_I_859_2: 16,
          SKU_I_996_1: 21,
        },
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 9,
      expectedReservation: {
        reservationId: "res-12-P",
        sku: "SKU_T_313",
        quantity: 8,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 9,
    }),
  }),
  createManifestCase({
    caseId: "held-out-b-seed-7",
    seed: 7,
    role: "held_out",
    stratum: "held_out_contextual",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-7",
      seed: 7,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_142",
        targetInitialInventory: 9,
        reservationQuantity: 1,
        reservationId: "res-7-P",
        irrelevantSkuCount: 3,
        irrelevantInventory: {
          SKU_I_419_3: 9,
          SKU_I_549_1: 4,
          SKU_I_772_2: 7,
        },
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 9,
      expectedReservation: {
        reservationId: "res-7-P",
        sku: "SKU_T_142",
        quantity: 1,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 9,
    }),
  }),
  createManifestCase({
    caseId: "held-out-b-seed-15",
    seed: 15,
    role: "held_out",
    stratum: "held_out_contextual",
    expectedSnapshot: createSnapshot({
      taskId: "task-rollback-report-parametric-15",
      seed: 15,
      goalType: "rollback_with_final_state_report",
      generationSource: "parametric",
      generationVersion: "rollback_report_parametric_v1",
      factors: {
        targetSku: "SKU_T_294",
        targetInitialInventory: 14,
        reservationQuantity: 13,
        reservationId: "res-15-P",
        irrelevantSkuCount: 3,
        irrelevantInventory: {
          SKU_I_180_2: 9,
          SKU_I_351_3: 25,
          SKU_I_877_1: 20,
        },
        instructionTemplate: "canonical_v1",
      },
      targetExpectedFinalInventory: 14,
      expectedReservation: {
        reservationId: "res-15-P",
        sku: "SKU_T_294",
        quantity: 13,
        status: "cancelled",
      },
      requiresFinalStateReport: true,
      reportExpectedAvailableInventory: 14,
    }),
  }),
] as const;

export function validateRollbackReportStalenessV1TaskSnapshot(
  caseId: string,
  expectedSnapshot: RollbackReportStalenessV1ExpectedSnapshot,
  task: StatefulToolTask,
): void {
  assertField(caseId, "taskId", expectedSnapshot.taskId, task.taskId);
  assertField(caseId, "seed", expectedSnapshot.seed, task.seed);
  assertField(caseId, "goalType", expectedSnapshot.goalType, task.goal.goalType);
  assertField(caseId, "generationSource", expectedSnapshot.generationSource, task.generation.source);
  assertField(caseId, "generationVersion", expectedSnapshot.generationVersion, task.generation.generatorVersion);

  assertField(
    caseId,
    "targetSku",
    expectedSnapshot.factors.targetSku,
    task.generation.factors.targetSku,
  );
  assertField(
    caseId,
    "targetInitialInventory",
    expectedSnapshot.factors.targetInitialInventory,
    task.generation.factors.targetInitialInventory,
  );
  assertField(
    caseId,
    "reservationQuantity",
    expectedSnapshot.factors.reservationQuantity,
    task.generation.factors.reservationQuantity,
  );
  assertField(
    caseId,
    "reservationId",
    expectedSnapshot.factors.reservationId,
    task.generation.factors.reservationId,
  );
  assertField(
    caseId,
    "irrelevantSkuCount",
    expectedSnapshot.factors.irrelevantSkuCount,
    task.generation.factors.irrelevantSkuCount,
  );
  assertField(
    caseId,
    "irrelevantInventory",
    expectedSnapshot.factors.irrelevantInventory,
    task.generation.factors.irrelevantInventory,
  );
  assertField(
    caseId,
    "instructionTemplate",
    expectedSnapshot.factors.instructionTemplate,
    task.generation.factors.instructionTemplate,
  );

  assertField(
    caseId,
    "task.initialInventory[targetSku]",
    expectedSnapshot.factors.targetInitialInventory,
    task.initialInventory[expectedSnapshot.factors.targetSku],
  );
  assertField(
    caseId,
    "task.expectedFinalInventory[targetSku]",
    expectedSnapshot.targetExpectedFinalInventory,
    task.expectedFinalInventory[expectedSnapshot.factors.targetSku],
  );

  assertField(caseId, "task.expectedReservationId", expectedSnapshot.expectedReservation.reservationId, task.expectedReservationId);

  assertField(caseId, "goal.sku", expectedSnapshot.expectedReservation.sku, task.goal.sku);
  assertField(caseId, "goal.quantity", expectedSnapshot.expectedReservation.quantity, task.goal.quantity);
  assertField(
    caseId,
    "goal.expectedReservationId",
    expectedSnapshot.expectedReservation.reservationId,
    task.goal.expectedReservationId,
  );

  const reservationIds = Object.keys(task.expectedReservations).sort();
  assertField(caseId, "expectedReservations.keys", [expectedSnapshot.expectedReservation.reservationId], reservationIds);

  const expectedReservationRecord = task.expectedReservations[expectedSnapshot.expectedReservation.reservationId];
  assertField(caseId, "expectedReservation.sku", expectedSnapshot.expectedReservation.sku, expectedReservationRecord?.sku);
  assertField(
    caseId,
    "expectedReservation.quantity",
    expectedSnapshot.expectedReservation.quantity,
    expectedReservationRecord?.quantity,
  );
  assertField(
    caseId,
    "expectedReservation.status",
    expectedSnapshot.expectedReservation.status,
    expectedReservationRecord?.status,
  );

  if (expectedSnapshot.requiresFinalStateReport) {
    if (task.goal.goalType !== "rollback_with_final_state_report") {
      throw toMismatchError(caseId, "reportRequirement", "present", "missing");
    }

    assertField(
      caseId,
      "reportRequirement.expectedReservationId",
      expectedSnapshot.expectedReservation.reservationId,
      task.goal.reportRequirement.expectedReservationId,
    );
    assertField(
      caseId,
      "reportRequirement.expectedReservationStatus",
      expectedSnapshot.expectedReservation.status,
      task.goal.reportRequirement.expectedReservationStatus,
    );
    assertField(
      caseId,
      "reportRequirement.expectedAvailableInventory",
      expectedSnapshot.reportExpectedAvailableInventory,
      task.goal.reportRequirement.expectedAvailableInventory,
    );
    assertField(
      caseId,
      "reportRequirement.expectedAvailableInventoryMatchesTargetInitial",
      expectedSnapshot.factors.targetInitialInventory,
      task.goal.reportRequirement.expectedAvailableInventory,
    );
  }
}

export function materializeRollbackReportStalenessV1Suite(): RollbackReportStalenessV1MaterializedCase[] {
  return ROLLBACK_REPORT_STALENESS_V1_CASES.map((suiteCase) => {
    assertField(suiteCase.caseId, "manifest.seed", suiteCase.expectedSnapshot.seed, suiteCase.seed);

    const materializedTask = generateStatefulToolTaskFromSeed(suiteCase.seed);
    validateRollbackReportStalenessV1TaskSnapshot(
      suiteCase.caseId,
      suiteCase.expectedSnapshot,
      materializedTask,
    );

    return {
      caseId: suiteCase.caseId,
      role: suiteCase.role,
      stratum: suiteCase.stratum,
      seed: suiteCase.seed,
      expectedSnapshot: deepClone(suiteCase.expectedSnapshot),
      task: deepClone(materializedTask),
    };
  });
}

