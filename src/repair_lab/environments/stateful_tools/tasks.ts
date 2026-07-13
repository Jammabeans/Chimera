import { InventoryBySku, StatefulToolTask } from "./types";

function ensureValidSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0) {
    throw new Error("seed must be a non-negative integer");
  }
}

function cloneInventory(inventory: InventoryBySku): InventoryBySku {
  return JSON.parse(JSON.stringify(inventory)) as InventoryBySku;
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
    };
  },
];

export function generateStatefulToolTaskFromSeed(seed: number): StatefulToolTask {
  ensureValidSeed(seed);
  const index = seed < templates.length ? seed : seed % 3;
  const task = templates[index](seed);
  return {
    ...task,
    initialInventory: cloneInventory(task.initialInventory),
    expectedFinalInventory: cloneInventory(task.expectedFinalInventory),
    expectedReservations: JSON.parse(
      JSON.stringify(task.expectedReservations),
    ) as StatefulToolTask["expectedReservations"],
  };
}

