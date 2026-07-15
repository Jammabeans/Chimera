import {
  InventoryBySku,
  StatefulTaskGenerationMetadata,
  StatefulToolTask,
} from "./types";

const MAX_UINT32_SEED = 0xffffffff;

function ensureValidSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_UINT32_SEED) {
    throw new Error("seed must be an integer in [0, 4294967295]");
  }
}

function cloneInventory(inventory: InventoryBySku): InventoryBySku {
  return JSON.parse(JSON.stringify(inventory)) as InventoryBySku;
}

function cloneGeneration(
  generation: StatefulTaskGenerationMetadata,
): StatefulTaskGenerationMetadata {
  return JSON.parse(JSON.stringify(generation)) as StatefulTaskGenerationMetadata;
}

function buildIrrelevantInventory(
  inventory: InventoryBySku,
  targetSku: string,
): InventoryBySku {
  const irrelevantEntries = Object.entries(inventory)
    .filter(([sku]) => sku !== targetSku)
    .sort(([a], [b]) => a.localeCompare(b));

  return Object.fromEntries(irrelevantEntries) as InventoryBySku;
}

function withQuantity(
  inventory: InventoryBySku,
  sku: string,
  nextQuantity: number,
): InventoryBySku {
  return {
    ...cloneInventory(inventory),
    [sku]: nextQuantity,
  };
}

const PARAMETRIC_ROLLBACK_REPORT_GENERATOR_VERSION = "rollback_report_parametric_v1";

function createDeterministicIntPrng(seed: number): () => number {
  let state = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
}

function nextIntInclusive(nextU32: () => number, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error("invalid nextIntInclusive bounds");
  }

  const span = max - min + 1;
  return min + (nextU32() % span);
}

function buildRollbackWithFinalStateReportDescription(
  sku: string,
  quantity: number,
  reservationId: string,
): string {
  return `Reserve ${quantity} units of ${sku} using reservation ID ${reservationId}. After reserving, call get_inventory for ${sku} to inspect interim available inventory. Cancel reservation ${reservationId}. After cancellation, provide final answer as strict JSON only (no markdown, prose, or code fence) with keys reservation_id, reservation_status, available_inventory.`;
}

function buildManualGenerationMetadata(
  seed: number,
  factors: StatefulTaskGenerationMetadata["factors"],
): StatefulTaskGenerationMetadata {
  const generatorVersion =
    seed === 3 ? "manual_frozen_discovery_seed3_v1" : `manual_seed_${seed}_v1`;
  return {
    source: "manual",
    generatorVersion,
    factors,
  };
}

function generateParametricRollbackReportTask(seed: number): StatefulToolTask {
  const nextU32 = createDeterministicIntPrng(seed);

  const targetInitialInventory = nextIntInclusive(nextU32, 4, 18);
  const reservationQuantity = nextIntInclusive(nextU32, 1, targetInitialInventory - 1);
  const irrelevantSkuCount = nextIntInclusive(nextU32, 0, 3);

  const targetSku = `SKU_T_${nextIntInclusive(nextU32, 100, 999)}`;
  const expectedReservationId = `res-${seed}-P`;
  const instructionTemplate = "canonical_v1";

  const initialInventory: InventoryBySku = {
    [targetSku]: targetInitialInventory,
  };

  const irrelevantSkus: string[] = [];
  for (let index = 0; index < irrelevantSkuCount; index += 1) {
    let candidate = `SKU_I_${nextIntInclusive(nextU32, 100, 999)}_${index + 1}`;
    while (candidate === targetSku || irrelevantSkus.includes(candidate)) {
      candidate = `SKU_I_${nextIntInclusive(nextU32, 100, 999)}_${index + 1}`;
    }
    irrelevantSkus.push(candidate);
  }

  irrelevantSkus.sort();
  for (const sku of irrelevantSkus) {
    initialInventory[sku] = nextIntInclusive(nextU32, 1, 25);
  }

  const irrelevantInventory = buildIrrelevantInventory(initialInventory, targetSku);
  const irrelevantSkuCountFromInventory = Object.keys(irrelevantInventory).length;

  const expectedFinalInventory = cloneInventory(initialInventory);

  return {
    taskId: `task-rollback-report-parametric-${seed}`,
    seed,
    initialInventory,
    expectedFinalInventory,
    expectedReservations: {
      [expectedReservationId]: {
        sku: targetSku,
        quantity: reservationQuantity,
        status: "cancelled",
      },
    },
    goal: {
      goalType: "rollback_with_final_state_report",
      sku: targetSku,
      quantity: reservationQuantity,
      expectedReservationId,
      reportRequirement: {
        format: "strict_json",
        requiredToolSequence: ["reserve_item", "get_inventory", "cancel_reservation"],
        expectedReservationId,
        expectedReservationStatus: "cancelled",
        expectedAvailableInventory: targetInitialInventory,
      },
    },
    description: buildRollbackWithFinalStateReportDescription(
      targetSku,
      reservationQuantity,
      expectedReservationId,
    ),
    expectedReservationId,
    generation: {
      source: "parametric",
      generatorVersion: PARAMETRIC_ROLLBACK_REPORT_GENERATOR_VERSION,
      factors: {
        targetSku,
        targetInitialInventory,
        reservationQuantity,
        reservationId: expectedReservationId,
        irrelevantSkuCount: irrelevantSkuCountFromInventory,
        irrelevantInventory,
        instructionTemplate,
      },
    },
  };
}

const templates: Array<(seed: number) => StatefulToolTask> = [
  (seed) => {
    const initialInventory = { SKU_A: 8, SKU_B: 3 };
    const quantity = 3;
    const expectedReservationId = `res-${seed}-A`;
    const expectedFinalInventory = withQuantity(
      initialInventory,
      "SKU_A",
      initialInventory.SKU_A - quantity,
    );
    return {
      taskId: `task-success-${seed}`,
      seed,
      initialInventory,
      expectedFinalInventory,
      expectedReservations: {
        [expectedReservationId]: {
          sku: "SKU_A",
          quantity,
          status: "active",
        },
      },
      goal: {
        goalType: "successful_reservation",
        sku: "SKU_A",
        quantity,
        expectedReservationId,
      },
      description: "Reserve SKU_A successfully with sufficient inventory",
      expectedReservationId,
      generation: buildManualGenerationMetadata(seed, {
        targetSku: "SKU_A",
        targetInitialInventory: initialInventory.SKU_A,
        reservationQuantity: quantity,
        reservationId: expectedReservationId,
        irrelevantSkuCount: 1,
        irrelevantInventory: {
          SKU_B: initialInventory.SKU_B,
        },
        instructionTemplate: "manual_seed_0_v1",
      }),
    };
  },
  (seed) => {
    const initialInventory = { SKU_R: 5, SKU_X: 2 };
    const quantity = 2;
    const expectedReservationId = `res-${seed}-B`;
    const expectedFinalInventory = cloneInventory(initialInventory);
    return {
      taskId: `task-rollback-${seed}`,
      seed,
      initialInventory,
      expectedFinalInventory,
      expectedReservations: {
        [expectedReservationId]: {
          sku: "SKU_R",
          quantity,
          status: "cancelled",
        },
      },
      goal: {
        goalType: "reservation_then_cancellation",
        sku: "SKU_R",
        quantity,
        expectedReservationId,
      },
      description: "Reserve then cancel to restore SKU_R inventory",
      expectedReservationId,
      generation: buildManualGenerationMetadata(seed, {
        targetSku: "SKU_R",
        targetInitialInventory: initialInventory.SKU_R,
        reservationQuantity: quantity,
        reservationId: expectedReservationId,
        irrelevantSkuCount: 1,
        irrelevantInventory: {
          SKU_X: initialInventory.SKU_X,
        },
        instructionTemplate: "manual_seed_1_v1",
      }),
    };
  },
  (seed) => {
    const initialInventory = { SKU_Z: 9 };
    const quantity = 4;
    const expectedReservationId = `res-${seed}-C`;
    const expectedFinalInventory = cloneInventory(initialInventory);
    return {
      taskId: `task-rollback-strict-${seed}`,
      seed,
      initialInventory,
      expectedFinalInventory,
      expectedReservations: {
        [expectedReservationId]: {
          sku: "SKU_Z",
          quantity,
          status: "cancelled",
        },
      },
      goal: {
        goalType: "reservation_then_cancellation",
        sku: "SKU_Z",
        quantity,
        expectedReservationId,
      },
      description:
        "Rollback-critical task: reservation must be cancelled and inventory fully restored",
      expectedReservationId,
      generation: buildManualGenerationMetadata(seed, {
        targetSku: "SKU_Z",
        targetInitialInventory: initialInventory.SKU_Z,
        reservationQuantity: quantity,
        reservationId: expectedReservationId,
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "manual_seed_2_v1",
      }),
    };
  },
  () => {
    const seed = 3;
    const initialInventory = { SKU_Z: 9 };
    const quantity = 4;
    const expectedReservationId = "res-3-D";
    const expectedFinalInventory = cloneInventory(initialInventory);
    return {
      taskId: "task-rollback-report-3",
      seed,
      initialInventory,
      expectedFinalInventory,
      expectedReservations: {
        [expectedReservationId]: {
          sku: "SKU_Z",
          quantity,
          status: "cancelled",
        },
      },
      goal: {
        goalType: "rollback_with_final_state_report",
        sku: "SKU_Z",
        quantity,
        expectedReservationId,
        reportRequirement: {
          format: "strict_json",
          requiredToolSequence: ["reserve_item", "get_inventory", "cancel_reservation"],
          expectedReservationId,
          expectedReservationStatus: "cancelled",
          expectedAvailableInventory: expectedFinalInventory.SKU_Z,
        },
      },
      description:
        "Reserve 4 units of SKU_Z using reservation ID res-3-D. After reserving, call get_inventory for SKU_Z to inspect interim available inventory. Cancel reservation res-3-D. After cancellation, provide final answer as strict JSON only (no markdown, prose, or code fence) with keys reservation_id, reservation_status, available_inventory.",
      expectedReservationId,
      generation: buildManualGenerationMetadata(seed, {
        targetSku: "SKU_Z",
        targetInitialInventory: initialInventory.SKU_Z,
        reservationQuantity: quantity,
        reservationId: expectedReservationId,
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "manual_frozen_discovery_seed3_v1",
      }),
    };
  },
];

export function generateStatefulToolTaskFromSeed(seed: number): StatefulToolTask {
  ensureValidSeed(seed);
  const task = seed < templates.length ? templates[seed](seed) : generateParametricRollbackReportTask(seed);
  return {
    ...task,
    initialInventory: cloneInventory(task.initialInventory),
    expectedFinalInventory: cloneInventory(task.expectedFinalInventory),
    expectedReservations: JSON.parse(
      JSON.stringify(task.expectedReservations),
    ) as StatefulToolTask["expectedReservations"],
    generation: cloneGeneration(task.generation),
  };
}

