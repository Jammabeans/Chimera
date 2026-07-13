import { describe, expect, it } from "vitest";

import { createStatefulToolSimulator } from "./simulator";
import { generateStatefulToolTaskFromSeed } from "./tasks";
import { verifyStatefulToolTask, verifyStatefulToolTaskExecution } from "./verifier";

describe("stateful-tools deterministic task generation", () => {
  it("returns structurally identical task for same seed", () => {
    const a = generateStatefulToolTaskFromSeed(7);
    const b = generateStatefulToolTaskFromSeed(7);
    expect(a).toEqual(b);
  });

  it("keeps seeds 0-2 goal categories stable and assigns seed 3 to rollback_with_final_state_report", () => {
    expect(generateStatefulToolTaskFromSeed(0).goal.goalType).toBe("successful_reservation");
    expect(generateStatefulToolTaskFromSeed(1).goal.goalType).toBe("reservation_then_cancellation");
    expect(generateStatefulToolTaskFromSeed(2).goal.goalType).toBe("reservation_then_cancellation");

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
    expect(seed3a.goal.reportRequirement).toEqual({
      format: "strict_json",
      requiredToolSequence: ["reserve_item", "get_inventory", "cancel_reservation"],
      expectedReservationId: "res-3-D",
      expectedReservationStatus: "cancelled",
      expectedAvailableInventory: 9,
    });
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

