import { describe, expect, it } from "vitest";

import { createStatefulToolSimulator } from "./simulator";
import { generateStatefulToolTaskFromSeed } from "./tasks";
import { verifyStatefulToolTask, verifyStatefulToolTaskExecution } from "./verifier";

describe("stateful-tools deterministic task generation", () => {
  it("accepts uint32 boundary seed 0xffffffff and remains deterministic", () => {
    const boundarySeed = 0xffffffff;
    const first = generateStatefulToolTaskFromSeed(boundarySeed);
    const second = generateStatefulToolTaskFromSeed(boundarySeed);

    expect(first).toEqual(second);
    expect(first.seed).toBe(boundarySeed);
    expect(first.taskId).toBe(`task-rollback-report-parametric-${boundarySeed}`);
  });

  it("rejects non-uint32 seeds", () => {
    expect(() => generateStatefulToolTaskFromSeed(0x100000000)).toThrowError(
      "seed must be an integer in [0, 4294967295]",
    );
    expect(() => generateStatefulToolTaskFromSeed(-1)).toThrowError(
      "seed must be an integer in [0, 4294967295]",
    );
    expect(() => generateStatefulToolTaskFromSeed(3.5)).toThrowError(
      "seed must be an integer in [0, 4294967295]",
    );
    expect(() => generateStatefulToolTaskFromSeed(Number.NaN)).toThrowError(
      "seed must be an integer in [0, 4294967295]",
    );
    expect(() => generateStatefulToolTaskFromSeed(Number.POSITIVE_INFINITY)).toThrowError(
      "seed must be an integer in [0, 4294967295]",
    );
  });

  it("returns structurally identical task for same seed", () => {
    const a = generateStatefulToolTaskFromSeed(1000);
    const b = generateStatefulToolTaskFromSeed(1000);
    expect(a).toEqual(b);
  });

  it("preserves manual seeds 0-3 with stable IDs, goal categories, and manual metadata", () => {
    const seed0 = generateStatefulToolTaskFromSeed(0);
    const seed1 = generateStatefulToolTaskFromSeed(1);
    const seed2 = generateStatefulToolTaskFromSeed(2);
    const seed3 = generateStatefulToolTaskFromSeed(3);

    expect(seed0.taskId).toBe("task-success-0");
    expect(seed1.taskId).toBe("task-rollback-1");
    expect(seed2.taskId).toBe("task-rollback-strict-2");
    expect(seed3.taskId).toBe("task-rollback-report-3");

    expect(seed0.goal.goalType).toBe("successful_reservation");
    expect(seed1.goal.goalType).toBe("reservation_then_cancellation");
    expect(seed2.goal.goalType).toBe("reservation_then_cancellation");
    expect(seed3.goal.goalType).toBe("rollback_with_final_state_report");

    expect(seed0.generation.source).toBe("manual");
    expect(seed1.generation.source).toBe("manual");
    expect(seed2.generation.source).toBe("manual");
    expect(seed3.generation.source).toBe("manual");

    expect(seed0.generation.factors.irrelevantInventory).toEqual({ SKU_B: 3 });
    expect(seed1.generation.factors.irrelevantInventory).toEqual({ SKU_X: 2 });
    expect(seed2.generation.factors.irrelevantInventory).toEqual({});
    expect(seed3.generation.factors.irrelevantInventory).toEqual({});
  });

  it("preserves frozen seed 3 discovery task fields exactly", () => {
    const seed3a = generateStatefulToolTaskFromSeed(3);
    const seed3b = generateStatefulToolTaskFromSeed(3);
    expect(seed3a).toEqual(seed3b);
    expect(seed3a.taskId).toBe("task-rollback-report-3");
    expect(seed3a.goal.goalType).toBe("rollback_with_final_state_report");

    if (seed3a.goal.goalType !== "rollback_with_final_state_report") {
      throw new Error("unexpected seed 3 goal type");
    }

    expect(seed3a.expectedReservationId).toBe("res-3-D");
    expect(seed3a.initialInventory).toEqual({ SKU_Z: 9 });
    expect(seed3a.expectedFinalInventory).toEqual({ SKU_Z: 9 });
    expect(seed3a.goal.sku).toBe("SKU_Z");
    expect(seed3a.goal.quantity).toBe(4);
    expect(seed3a.description).toBe(
      "Reserve 4 units of SKU_Z using reservation ID res-3-D. After reserving, call get_inventory for SKU_Z to inspect interim available inventory. Cancel reservation res-3-D. After cancellation, provide final answer as strict JSON only (no markdown, prose, or code fence) with keys reservation_id, reservation_status, available_inventory.",
    );
    expect(seed3a.goal.reportRequirement).toEqual({
      format: "strict_json",
      requiredToolSequence: ["reserve_item", "get_inventory", "cancel_reservation"],
      expectedReservationId: "res-3-D",
      expectedReservationStatus: "cancelled",
      expectedAvailableInventory: 9,
    });
    expect(seed3a.generation).toEqual({
      source: "manual",
      generatorVersion: "manual_frozen_discovery_seed3_v1",
      factors: {
        targetSku: "SKU_Z",
        targetInitialInventory: 9,
        reservationQuantity: 4,
        reservationId: "res-3-D",
        irrelevantSkuCount: 0,
        irrelevantInventory: {},
        instructionTemplate: "manual_frozen_discovery_seed3_v1",
      },
    });
  });

  it("generates deterministic parametric rollback/report tasks for seeds >= 4", () => {
    const first = generateStatefulToolTaskFromSeed(1000);
    const second = generateStatefulToolTaskFromSeed(1001);

    expect(first.goal.goalType).toBe("rollback_with_final_state_report");
    expect(first.generation.source).toBe("parametric");
    expect(first.generation.generatorVersion).toBe("rollback_report_parametric_v1");

    expect(second.goal.goalType).toBe("rollback_with_final_state_report");
    expect(second.taskId).not.toBe(first.taskId);
    expect(second.expectedReservationId).not.toBe(first.expectedReservationId);
  });

  it("enforces parametric factor constraints across seeds 4-50", () => {
    for (let seed = 4; seed <= 50; seed += 1) {
      const task = generateStatefulToolTaskFromSeed(seed);
      expect(task.goal.goalType).toBe("rollback_with_final_state_report");
      expect(task.generation.source).toBe("parametric");
      expect(task.generation.generatorVersion).toBe("rollback_report_parametric_v1");

      if (task.goal.goalType !== "rollback_with_final_state_report") {
        throw new Error("unexpected task goal type");
      }

      const targetSku = task.goal.sku;
      const targetInitialQuantity = task.initialInventory[targetSku];
      const reservationQuantity = task.goal.quantity;
      const interimQuantity = targetInitialQuantity - reservationQuantity;
      const inventoryKeys = Object.keys(task.initialInventory);
      const irrelevantSkuCount = inventoryKeys.filter((sku) => sku !== targetSku).length;
      const expectedIrrelevantInventory = Object.fromEntries(
        Object.entries(task.initialInventory)
          .filter(([sku]) => sku !== targetSku)
          .sort(([a], [b]) => a.localeCompare(b)),
      );

      expect(Number.isInteger(targetInitialQuantity)).toBe(true);
      expect(targetInitialQuantity).toBeGreaterThan(0);
      expect(Number.isInteger(reservationQuantity)).toBe(true);
      expect(reservationQuantity).toBeGreaterThan(0);
      expect(reservationQuantity).toBeLessThan(targetInitialQuantity);
      expect(interimQuantity).not.toBe(targetInitialQuantity);

      expect(task.expectedFinalInventory[targetSku]).toBe(targetInitialQuantity);
      expect(irrelevantSkuCount).toBeGreaterThanOrEqual(0);
      expect(irrelevantSkuCount).toBeLessThanOrEqual(3);
      expect(task.generation.factors.irrelevantSkuCount).toBe(irrelevantSkuCount);
      expect(task.generation.factors.irrelevantInventory).toEqual(expectedIrrelevantInventory);
      expect(Object.keys(task.generation.factors.irrelevantInventory)).not.toContain(targetSku);
      expect(task.generation.factors.irrelevantSkuCount).toBe(
        Object.keys(task.generation.factors.irrelevantInventory).length,
      );
      expect(task.generation.factors.targetSku).toBe(targetSku);
      expect(task.generation.factors.targetInitialInventory).toBe(targetInitialQuantity);
      expect(task.generation.factors.reservationQuantity).toBe(reservationQuantity);

      expect(task.goal.reportRequirement.format).toBe("strict_json");
      expect(task.goal.reportRequirement.requiredToolSequence).toEqual([
        "reserve_item",
        "get_inventory",
        "cancel_reservation",
      ]);

      expect(new Set(inventoryKeys).size).toBe(inventoryKeys.length);
      expect(inventoryKeys.filter((sku) => sku === targetSku)).toHaveLength(1);
      expect(task.expectedReservations[task.expectedReservationId]?.status).toBe("cancelled");
      expect(task.generation.factors.instructionTemplate).toBe("canonical_v1");
    }
  });

  it("returns cloned generation metadata without aliasing", () => {
    const seed = 50;
    const first = generateStatefulToolTaskFromSeed(seed);
    const firstSnapshot = JSON.parse(JSON.stringify(first)) as typeof first;

    first.generation.factors.irrelevantInventory.SKU_MUTATED = 999;
    first.generation.factors.irrelevantSkuCount = -1;

    const second = generateStatefulToolTaskFromSeed(seed);
    expect(second).toEqual(firstSnapshot);
    expect(second.generation.factors.irrelevantInventory).not.toHaveProperty("SKU_MUTATED");
    expect(second.generation.factors.irrelevantSkuCount).toBe(
      Object.keys(second.generation.factors.irrelevantInventory).length,
    );
  });
});

describe("stateful-tools simulator and verifier", () => {
  it("handles successful reservation and verifier pass", () => {
    const task = generateStatefulToolTaskFromSeed(0);
    expect(task.goal.goalType).toBe("successful_reservation");
    if (task.goal.goalType !== "successful_reservation") {
      throw new Error("unexpected task goal type");
    }
    const goal = task.goal;

    const simulator = createStatefulToolSimulator(task.initialInventory);
    const reserveResult = simulator.reserveItem({
      reservationId: task.expectedReservationId,
      sku: goal.sku,
      quantity: goal.quantity,
    });
    expect(reserveResult.accepted).toBe(true);

    const snapshot = simulator.getStateSnapshot();
    expect(snapshot.inventory).toEqual(task.expectedFinalInventory);
    expect(snapshot.reservations[task.expectedReservationId]?.status).toBe("active");
    expect(snapshot.reservations).toEqual({
      [task.expectedReservationId]: {
        reservationId: task.expectedReservationId,
        sku: goal.sku,
        quantity: goal.quantity,
        status: "active",
        createdVersion: 1,
      },
    });

    const verification = verifyStatefulToolTask(task, snapshot);
    expect(verification.passed).toBe(true);
    expect(verification.failureCodes).toEqual([]);
  });

  it("handles reserve then cancel with exact rollback and verifier pass", () => {
    const task = generateStatefulToolTaskFromSeed(1);
    expect(task.goal.goalType).toBe("reservation_then_cancellation");
    if (task.goal.goalType !== "reservation_then_cancellation") {
      throw new Error("unexpected task goal type");
    }
    const goal = task.goal;

    const simulator = createStatefulToolSimulator(task.initialInventory);
    const reserveResult = simulator.reserveItem({
      reservationId: task.expectedReservationId,
      sku: goal.sku,
      quantity: goal.quantity,
    });
    expect(reserveResult.accepted).toBe(true);

    const cancelResult = simulator.cancelReservation({
      reservationId: task.expectedReservationId,
    });
    expect(cancelResult.accepted).toBe(true);

    const snapshot = simulator.getStateSnapshot();
    expect(snapshot.inventory).toEqual(task.expectedFinalInventory);
    expect(snapshot.reservations[task.expectedReservationId]?.status).toBe("cancelled");

    const verification = verifyStatefulToolTask(task, snapshot);
    expect(verification.passed).toBe(true);
    expect(verification.failureCodes).toEqual([]);
  });

  it("fails verifier when an unexpected side-effect reservation is also created", () => {
    const task = generateStatefulToolTaskFromSeed(0);
    expect(task.goal.goalType).toBe("successful_reservation");
    if (task.goal.goalType !== "successful_reservation") {
      throw new Error("unexpected task goal type");
    }

    const simulator = createStatefulToolSimulator(task.initialInventory);
    const expectedReserve = simulator.reserveItem({
      reservationId: task.expectedReservationId,
      sku: task.goal.sku,
      quantity: task.goal.quantity,
    });
    expect(expectedReserve.accepted).toBe(true);

    const collateralReserve = simulator.reserveItem({
      reservationId: "unexpected-side-effect",
      sku: "SKU_B",
      quantity: 1,
    });
    expect(collateralReserve.accepted).toBe(true);

    const snapshot = simulator.getStateSnapshot();
    const verification = verifyStatefulToolTask(task, snapshot);
    expect(verification.passed).toBe(false);
    expect(verification.failureCodes).toContain("task_unexpected_reservation");
  });

  it("fails verifier when rollback task persists an unexpected cancelled reservation", () => {
    const task = generateStatefulToolTaskFromSeed(1);
    expect(task.goal.goalType).toBe("reservation_then_cancellation");
    if (task.goal.goalType !== "reservation_then_cancellation") {
      throw new Error("unexpected task goal type");
    }

    const simulator = createStatefulToolSimulator(task.initialInventory);

    const expectedReserve = simulator.reserveItem({
      reservationId: task.expectedReservationId,
      sku: task.goal.sku,
      quantity: task.goal.quantity,
    });
    expect(expectedReserve.accepted).toBe(true);

    const expectedCancel = simulator.cancelReservation({ reservationId: task.expectedReservationId });
    expect(expectedCancel.accepted).toBe(true);

    const unexpectedReserve = simulator.reserveItem({
      reservationId: "unexpected-cancelled",
      sku: "SKU_X",
      quantity: 1,
    });
    expect(unexpectedReserve.accepted).toBe(true);
    const unexpectedCancel = simulator.cancelReservation({ reservationId: "unexpected-cancelled" });
    expect(unexpectedCancel.accepted).toBe(true);

    const snapshot = simulator.getStateSnapshot();
    const verification = verifyStatefulToolTask(task, snapshot);
    expect(verification.passed).toBe(false);
    expect(verification.failureCodes).toContain("task_unexpected_reservation");
  });

  it("fails verifier for malformed fixture with reservation sku outside task inventory", () => {
    const task = generateStatefulToolTaskFromSeed(0);
    const malformedFinalState = {
      inventory: {
        ...task.expectedFinalInventory,
      },
      reservations: {
        [task.expectedReservationId]: {
          reservationId: task.expectedReservationId,
          sku: task.goal.sku,
          quantity: task.goal.quantity,
          status: "active" as const,
          createdVersion: 1,
        },
        bad_external_sku: {
          reservationId: "bad_external_sku",
          sku: "SKU_NOT_IN_TASK",
          quantity: 1,
          status: "active" as const,
          createdVersion: 1,
        },
      },
      version: 1,
    };

    const verification = verifyStatefulToolTask(task, malformedFinalState);
    expect(verification.passed).toBe(false);
    expect(verification.failureCodes).toContain("reservation_unknown_sku");
  });

  it("fails verifier on incomplete rollback", () => {
    const task = generateStatefulToolTaskFromSeed(2);
    expect(task.goal.goalType).toBe("reservation_then_cancellation");
    if (task.goal.goalType !== "reservation_then_cancellation") {
      throw new Error("unexpected task goal type");
    }
    const goal = task.goal;

    const simulator = createStatefulToolSimulator(task.initialInventory);
    const reserveResult = simulator.reserveItem({
      reservationId: task.expectedReservationId,
      sku: goal.sku,
      quantity: goal.quantity,
    });
    expect(reserveResult.accepted).toBe(true);

    const snapshot = simulator.getStateSnapshot();
    const verification = verifyStatefulToolTask(task, snapshot);
    expect(verification.passed).toBe(false);
    expect(verification.failureCodes).toContain("rollback_not_completed");
  });

  it("rejects over-reservation with unchanged state version and traced rejection", () => {
    const simulator = createStatefulToolSimulator({ SKU_LOW: 1 });
    const before = simulator.getStateSnapshot();

    const result = simulator.reserveItem({
      reservationId: "res-too-much",
      sku: "SKU_LOW",
      quantity: 2,
    });

    expect(result.accepted).toBe(false);
    const after = simulator.getStateSnapshot();
    expect(after).toEqual(before);

    const trace = simulator.getTrace();
    const last = trace[trace.length - 1];
    expect(last.tool).toBe("reserve_item");
    expect(last.result.accepted).toBe(false);
    expect(last.stateVersionBefore).toBe(last.stateVersionAfter);
  });

  it("rejects repeated cancellation and avoids double restore", () => {
    const simulator = createStatefulToolSimulator({ SKU_A: 5 });

    const reserveResult = simulator.reserveItem({
      reservationId: "res-repeat-cancel",
      sku: "SKU_A",
      quantity: 2,
    });
    expect(reserveResult.accepted).toBe(true);

    const firstCancel = simulator.cancelReservation({
      reservationId: "res-repeat-cancel",
    });
    expect(firstCancel.accepted).toBe(true);

    const inventoryAfterFirstCancel = simulator.getStateSnapshot().inventory.SKU_A;
    expect(inventoryAfterFirstCancel).toBe(5);

    const secondCancel = simulator.cancelReservation({
      reservationId: "res-repeat-cancel",
    });
    expect(secondCancel.accepted).toBe(false);

    const snapshot = simulator.getStateSnapshot();
    expect(snapshot.inventory.SKU_A).toBe(5);
  });

  it("get_inventory returns expected count and traces unknown sku rejection without state-version change", () => {
    const simulator = createStatefulToolSimulator({ SKU_A: 2 });

    const found = simulator.getInventory({ sku: "SKU_A" });
    expect(found.accepted).toBe(true);
    if (!found.accepted) {
      throw new Error("expected successful inventory lookup");
    }
    expect(found.data.available).toBe(2);

    const beforeUnknown = simulator.getStateSnapshot().version;
    const missing = simulator.getInventory({ sku: "SKU_MISSING" });
    expect(missing.accepted).toBe(false);
    const afterUnknown = simulator.getStateSnapshot().version;
    expect(afterUnknown).toBe(beforeUnknown);

    const trace = simulator.getTrace();
    const successTrace = trace[0];
    const unknownTrace = trace[1];

    expect(successTrace.tool).toBe("get_inventory");
    expect(successTrace.result.accepted).toBe(true);
    expect(unknownTrace.tool).toBe("get_inventory");
    expect(unknownTrace.result.accepted).toBe(false);
    expect(unknownTrace.stateVersionBefore).toBe(unknownTrace.stateVersionAfter);
  });

  it("returns defensive copies for state snapshots and traces", () => {
    const simulator = createStatefulToolSimulator({ SKU_A: 3 });
    simulator.reserveItem({
      reservationId: "res-copy-check",
      sku: "SKU_A",
      quantity: 1,
    });

    const snapshot = simulator.getStateSnapshot();
    snapshot.inventory.SKU_A = 999;
    snapshot.reservations["res-copy-check"].status = "cancelled";

    const freshSnapshot = simulator.getStateSnapshot();
    expect(freshSnapshot.inventory.SKU_A).toBe(2);
    expect(freshSnapshot.reservations["res-copy-check"].status).toBe("active");

    const trace = simulator.getTrace();
    trace[0].tool = "cancel_reservation";
    trace[0].stateSummaryAfter.inventory.SKU_A = 500;

    const freshTrace = simulator.getTrace();
    expect(freshTrace[0].tool).toBe("reserve_item");
    expect(freshTrace[0].stateSummaryAfter.inventory.SKU_A).toBe(2);
  });

  it("passes execution-level verifier for seed 3 with ordered trace and strict final JSON", () => {
    const task = generateStatefulToolTaskFromSeed(3);
    expect(task.goal.goalType).toBe("rollback_with_final_state_report");
    if (task.goal.goalType !== "rollback_with_final_state_report") {
      throw new Error("unexpected task goal type");
    }

    const simulator = createStatefulToolSimulator(task.initialInventory);
    const reserveResult = simulator.reserveItem({
      reservationId: task.expectedReservationId,
      sku: task.goal.sku,
      quantity: task.goal.quantity,
    });
    expect(reserveResult.accepted).toBe(true);

    const inventoryResult = simulator.getInventory({ sku: task.goal.sku });
    expect(inventoryResult.accepted).toBe(true);

    const cancelResult = simulator.cancelReservation({ reservationId: task.expectedReservationId });
    expect(cancelResult.accepted).toBe(true);

    const finalState = simulator.getStateSnapshot();
    const verification = verifyStatefulToolTaskExecution(
      task,
      finalState,
      simulator.getTrace(),
      JSON.stringify({
        reservation_id: task.expectedReservationId,
        reservation_status: "cancelled",
        available_inventory: finalState.inventory[task.goal.sku],
      }),
    );

    expect(verification.passed).toBe(true);
    expect(verification.failureCodes).toEqual([]);
  });

  it("fails execution-level verifier for stale seed 3 final inventory report", () => {
    const task = generateStatefulToolTaskFromSeed(3);
    if (task.goal.goalType !== "rollback_with_final_state_report") {
      throw new Error("unexpected task goal type");
    }

    const simulator = createStatefulToolSimulator(task.initialInventory);
    simulator.reserveItem({
      reservationId: task.expectedReservationId,
      sku: task.goal.sku,
      quantity: task.goal.quantity,
    });
    simulator.getInventory({ sku: task.goal.sku });
    simulator.cancelReservation({ reservationId: task.expectedReservationId });

    const verification = verifyStatefulToolTaskExecution(
      task,
      simulator.getStateSnapshot(),
      simulator.getTrace(),
      JSON.stringify({
        reservation_id: task.expectedReservationId,
        reservation_status: "cancelled",
        available_inventory: 5,
      }),
    );

    expect(verification.passed).toBe(false);
    expect(verification.failureCodes).toContain("final_report_inventory_mismatch");
  });

  it("passes execution-level verifier for one generated rollback/report task", () => {
    const task = generateStatefulToolTaskFromSeed(1000);
    if (task.goal.goalType !== "rollback_with_final_state_report") {
      throw new Error("unexpected task goal type");
    }

    const simulator = createStatefulToolSimulator(task.initialInventory);
    const reserveResult = simulator.reserveItem({
      reservationId: task.expectedReservationId,
      sku: task.goal.sku,
      quantity: task.goal.quantity,
    });
    expect(reserveResult.accepted).toBe(true);

    const interim = simulator.getInventory({ sku: task.goal.sku });
    expect(interim.accepted).toBe(true);

    const cancelResult = simulator.cancelReservation({ reservationId: task.expectedReservationId });
    expect(cancelResult.accepted).toBe(true);

    const finalState = simulator.getStateSnapshot();
    const verification = verifyStatefulToolTaskExecution(
      task,
      finalState,
      simulator.getTrace(),
      JSON.stringify({
        reservation_id: task.expectedReservationId,
        reservation_status: "cancelled",
        available_inventory: finalState.inventory[task.goal.sku],
      }),
    );

    expect(verification.passed).toBe(true);
    expect(verification.failureCodes).toEqual([]);
  });

  it("fails execution-level verifier for stale generated final inventory report", () => {
    const task = generateStatefulToolTaskFromSeed(1000);
    if (task.goal.goalType !== "rollback_with_final_state_report") {
      throw new Error("unexpected task goal type");
    }

    const simulator = createStatefulToolSimulator(task.initialInventory);
    simulator.reserveItem({
      reservationId: task.expectedReservationId,
      sku: task.goal.sku,
      quantity: task.goal.quantity,
    });
    const interim = simulator.getInventory({ sku: task.goal.sku });
    expect(interim.accepted).toBe(true);
    if (!interim.accepted) {
      throw new Error("expected successful get_inventory for interim quantity");
    }
    simulator.cancelReservation({ reservationId: task.expectedReservationId });

    const verification = verifyStatefulToolTaskExecution(
      task,
      simulator.getStateSnapshot(),
      simulator.getTrace(),
      JSON.stringify({
        reservation_id: task.expectedReservationId,
        reservation_status: "cancelled",
        available_inventory: interim.data.available,
      }),
    );

    expect(verification.passed).toBe(false);
    expect(verification.failureCodes).toContain("final_report_inventory_mismatch");
  });

  it("fails execution-level verifier for invalid final report format (markdown fenced JSON)", () => {
    const task = generateStatefulToolTaskFromSeed(3);
    if (task.goal.goalType !== "rollback_with_final_state_report") {
      throw new Error("unexpected task goal type");
    }

    const simulator = createStatefulToolSimulator(task.initialInventory);
    simulator.reserveItem({
      reservationId: task.expectedReservationId,
      sku: task.goal.sku,
      quantity: task.goal.quantity,
    });
    simulator.getInventory({ sku: task.goal.sku });
    simulator.cancelReservation({ reservationId: task.expectedReservationId });

    const verification = verifyStatefulToolTaskExecution(
      task,
      simulator.getStateSnapshot(),
      simulator.getTrace(),
      '```json\n{"reservation_id":"res-3-D","reservation_status":"cancelled","available_inventory":9}\n```',
    );

    expect(verification.passed).toBe(false);
    expect(verification.failureCodes).toContain("final_report_invalid_json");
  });

  it("fails execution-level verifier when required interim get_inventory step is missing", () => {
    const task = generateStatefulToolTaskFromSeed(3);
    if (task.goal.goalType !== "rollback_with_final_state_report") {
      throw new Error("unexpected task goal type");
    }

    const simulator = createStatefulToolSimulator(task.initialInventory);
    simulator.reserveItem({
      reservationId: task.expectedReservationId,
      sku: task.goal.sku,
      quantity: task.goal.quantity,
    });
    simulator.cancelReservation({ reservationId: task.expectedReservationId });

    const finalState = simulator.getStateSnapshot();
    const verification = verifyStatefulToolTaskExecution(
      task,
      finalState,
      simulator.getTrace(),
      JSON.stringify({
        reservation_id: task.expectedReservationId,
        reservation_status: "cancelled",
        available_inventory: finalState.inventory[task.goal.sku],
      }),
    );

    expect(verification.passed).toBe(false);
    expect(verification.failureCodes).toContain("required_tool_sequence_mismatch");
  });

  it("preserves state-only task semantics under execution-level verifier regardless of natural-language prose", () => {
    const task = generateStatefulToolTaskFromSeed(0);
    if (task.goal.goalType !== "successful_reservation") {
      throw new Error("unexpected task goal type");
    }

    const simulator = createStatefulToolSimulator(task.initialInventory);
    simulator.reserveItem({
      reservationId: task.expectedReservationId,
      sku: task.goal.sku,
      quantity: task.goal.quantity,
    });

    const verification = verifyStatefulToolTaskExecution(
      task,
      simulator.getStateSnapshot(),
      simulator.getTrace(),
      "Reservation completed successfully and all done.",
    );

    expect(verification.passed).toBe(true);
    expect(verification.failureCodes).toEqual([]);
  });
});

