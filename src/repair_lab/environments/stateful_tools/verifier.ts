import {
  ReservationStatus,
  SimulatorState,
  StatefulToolTask,
  ToolTraceEntry,
  VerificationCode,
  VerificationResult,
} from "./types";

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function hasReservationStatus(value: unknown): value is ReservationStatus {
  return value === "active" || value === "cancelled";
}

function summarizeObservedState(state: SimulatorState): VerificationResult["observedStateSummary"] {
  const activeReservationIds = Object.values(state.reservations)
    .filter((reservation) => reservation.status === "active")
    .map((reservation) => reservation.reservationId)
    .sort();

  const cancelledReservationIds = Object.values(state.reservations)
    .filter((reservation) => reservation.status === "cancelled")
    .map((reservation) => reservation.reservationId)
    .sort();

  return {
    inventory: JSON.parse(JSON.stringify(state.inventory)) as Record<string, number>,
    activeReservationIds,
    cancelledReservationIds,
    version: state.version,
  };
}

export function verifyStatefulToolTask(
  task: StatefulToolTask,
  finalState: SimulatorState,
): VerificationResult {
  const failureCodes: VerificationCode[] = [];
  const evidence: string[] = [];

  function addFailure(code: VerificationCode, detail: string): void {
    failureCodes.push(code);
    evidence.push(detail);
  }

  if (!isNonNegativeInteger(finalState.version)) {
    addFailure("invalid_state_version", `final state version is invalid: ${finalState.version}`);
  }

  for (const [sku, quantity] of Object.entries(finalState.inventory)) {
    if (!isNonNegativeInteger(quantity)) {
      addFailure(
        "invalid_inventory_value",
        `inventory for sku ${sku} is not a non-negative integer: ${quantity}`,
      );
    }
  }

  let inventoryMismatchDetected = false;
  const expectedInventorySkus = Object.keys(task.expectedFinalInventory).sort();
  const observedInventorySkus = Object.keys(finalState.inventory).sort();

  for (const expectedSku of expectedInventorySkus) {
    if (!(expectedSku in finalState.inventory)) {
      inventoryMismatchDetected = true;
      addFailure(
        "task_inventory_mismatch",
        `expected inventory sku missing in final state: ${expectedSku}`,
      );
      continue;
    }

    const expectedQuantity = task.expectedFinalInventory[expectedSku];
    const observedQuantity = finalState.inventory[expectedSku];
    if (observedQuantity !== expectedQuantity) {
      inventoryMismatchDetected = true;
      addFailure(
        "task_inventory_mismatch",
        `inventory mismatch for sku ${expectedSku}: expected ${expectedQuantity}, observed ${observedQuantity}`,
      );
    }
  }

  for (const observedSku of observedInventorySkus) {
    if (!(observedSku in task.expectedFinalInventory)) {
      inventoryMismatchDetected = true;
      addFailure(
        "task_inventory_mismatch",
        `unexpected inventory sku present in final state: ${observedSku}`,
      );
    }
  }

  const activeReservedBySku: Record<string, number> = {};

  for (const [reservationId, reservation] of Object.entries(finalState.reservations)) {
    const statusValid = hasReservationStatus(reservation.status);
    if (
      reservation.reservationId !== reservationId ||
      typeof reservation.sku !== "string" ||
      reservation.sku.length === 0 ||
      !statusValid ||
      !isNonNegativeInteger(reservation.createdVersion)
    ) {
      addFailure("invalid_reservation_shape", `reservation shape invalid for reservationId ${reservationId}`);
    }

    if (!isPositiveInteger(reservation.quantity)) {
      addFailure(
        "invalid_reservation_quantity",
        `reservation quantity invalid for reservationId ${reservationId}: ${reservation.quantity}`,
      );
    }

    if (!(reservation.sku in task.initialInventory)) {
      addFailure(
        "reservation_unknown_sku",
        `reservation ${reservationId} references sku outside task inventory: ${reservation.sku}`,
      );
    }

    if (
      statusValid &&
      reservation.status === "active" &&
      reservation.sku in task.initialInventory &&
      isPositiveInteger(reservation.quantity)
    ) {
      activeReservedBySku[reservation.sku] =
        (activeReservedBySku[reservation.sku] ?? 0) + reservation.quantity;
    }
  }

  for (const [sku, initialQuantity] of Object.entries(task.initialInventory)) {
    const observedAvailable = finalState.inventory[sku];
    if (!isNonNegativeInteger(observedAvailable)) {
      continue;
    }
    const activeReserved = activeReservedBySku[sku] ?? 0;
    if (observedAvailable + activeReserved !== initialQuantity) {
      addFailure(
        "inventory_conservation_violation",
        `inventory conservation violated for sku ${sku}: initial ${initialQuantity}, observed available ${observedAvailable}, active reserved ${activeReserved}`,
      );
    }
  }

  for (const [expectedReservationId, expectedReservation] of Object.entries(task.expectedReservations)) {
    const observedReservation = finalState.reservations[expectedReservationId];
    if (!observedReservation) {
      addFailure(
        "task_expected_reservation_missing",
        `expected reservation missing: ${expectedReservationId}`,
      );
      continue;
    }

    if (
      observedReservation.sku !== expectedReservation.sku ||
      observedReservation.quantity !== expectedReservation.quantity ||
      observedReservation.status !== expectedReservation.status
    ) {
      addFailure(
        "task_expected_reservation_mismatch",
        `expected reservation mismatch for ${expectedReservationId}: expected {sku:${expectedReservation.sku}, quantity:${expectedReservation.quantity}, status:${expectedReservation.status}}, observed {sku:${observedReservation.sku}, quantity:${observedReservation.quantity}, status:${observedReservation.status}}`,
      );
    }
  }

  for (const observedReservationId of Object.keys(finalState.reservations)) {
    if (!(observedReservationId in task.expectedReservations)) {
      addFailure(
        "task_unexpected_reservation",
        `unexpected reservation present in final state: ${observedReservationId}`,
      );
    }
  }

  const expectedReservation = finalState.reservations[task.expectedReservationId];
  if (!expectedReservation) {
    addFailure("task_expected_reservation_missing", `expected reservation missing: ${task.expectedReservationId}`);
  }

  if (task.goal.goalType === "successful_reservation") {
    if (expectedReservation && expectedReservation.status !== "active") {
      addFailure(
        "task_expected_reservation_not_active",
        `expected reservation is not active: ${task.expectedReservationId}`,
      );
    }
  }

  if (
    task.goal.goalType === "reservation_then_cancellation" ||
    task.goal.goalType === "rollback_with_final_state_report"
  ) {
    if (!expectedReservation || expectedReservation.status !== "cancelled") {
      addFailure(
        "task_expected_reservation_not_cancelled",
        `expected reservation is not cancelled: ${task.expectedReservationId}`,
      );
      addFailure("rollback_not_completed", "rollback-critical reservation cancellation was not completed");
    }

    if (inventoryMismatchDetected) {
      addFailure("rollback_not_completed", "rollback-critical inventory restoration was not completed");
    }
  }

  return {
    passed: failureCodes.length === 0,
    failureCodes: Array.from(new Set(failureCodes)),
    evidence,
    observedStateSummary: summarizeObservedState(finalState),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(obj: Record<string, unknown>, expected: string[]): boolean {
  const observed = Object.keys(obj).sort();
  const required = [...expected].sort();
  return observed.length === required.length && observed.every((key, index) => key === required[index]);
}

function hasRequiredSuccessfulToolSequence(
  trace: ToolTraceEntry[],
  task: StatefulToolTask,
): boolean {
  if (task.goal.goalType !== "rollback_with_final_state_report") {
    return true;
  }

  const expectedReservationId = task.goal.expectedReservationId;
  const expectedSku = task.goal.sku;
  const expectedQuantity = task.goal.quantity;

  let phase: 0 | 1 | 2 | 3 = 0;

  for (const entry of trace) {
    if (!entry.result.accepted) {
      continue;
    }

    if (
      phase === 0 &&
      entry.tool === "reserve_item" &&
      entry.args.reservationId === expectedReservationId &&
      entry.args.sku === expectedSku &&
      entry.args.quantity === expectedQuantity
    ) {
      phase = 1;
      continue;
    }

    if (phase === 1 && entry.tool === "get_inventory" && entry.args.sku === expectedSku) {
      phase = 2;
      continue;
    }

    if (
      phase === 2 &&
      entry.tool === "cancel_reservation" &&
      entry.args.reservationId === expectedReservationId
    ) {
      phase = 3;
      break;
    }
  }

  return phase === 3;
}

export function verifyStatefulToolTaskExecution(
  task: StatefulToolTask,
  finalState: SimulatorState,
  simulatorTrace: ToolTraceEntry[],
  finalModelText: string | null,
): VerificationResult {
  const base = verifyStatefulToolTask(task, finalState);
  if (task.goal.goalType !== "rollback_with_final_state_report") {
    return base;
  }

  const failureCodes: VerificationCode[] = [...base.failureCodes];
  const evidence: string[] = [...base.evidence];

  function addFailure(code: VerificationCode, detail: string): void {
    failureCodes.push(code);
    evidence.push(detail);
  }

  if (!hasRequiredSuccessfulToolSequence(simulatorTrace, task)) {
    addFailure(
      "required_tool_sequence_mismatch",
      "required successful tool subsequence reserve_item -> get_inventory -> cancel_reservation was not observed in order",
    );
  }

  const trimmedFinalText = finalModelText?.trim() ?? "";
  if (trimmedFinalText.length === 0) {
    addFailure("final_report_missing", "final response text is required for strict JSON report task");
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmedFinalText);
    } catch {
      addFailure("final_report_invalid_json", "final response must be parseable strict JSON with no markdown or prose");
      parsed = undefined;
    }

    if (parsed !== undefined) {
      if (!isPlainObject(parsed) || !hasExactKeys(parsed, ["reservation_id", "reservation_status", "available_inventory"])) {
        addFailure(
          "final_report_schema_mismatch",
          "final JSON report must be an object with exactly keys reservation_id, reservation_status, available_inventory",
        );
      } else {
        if (parsed.reservation_id !== task.goal.reportRequirement.expectedReservationId) {
          addFailure(
            "final_report_reservation_id_mismatch",
            `final report reservation_id mismatch: expected ${task.goal.reportRequirement.expectedReservationId}, observed ${String(parsed.reservation_id)}`,
          );
        }

        if (parsed.reservation_status !== task.goal.reportRequirement.expectedReservationStatus) {
          addFailure(
            "final_report_reservation_status_mismatch",
            `final report reservation_status mismatch: expected ${task.goal.reportRequirement.expectedReservationStatus}, observed ${String(parsed.reservation_status)}`,
          );
        }

        const observedFinalInventory = finalState.inventory[task.goal.sku];
        if (!Number.isInteger(parsed.available_inventory) || parsed.available_inventory !== observedFinalInventory) {
          addFailure(
            "final_report_inventory_mismatch",
            `final report available_inventory mismatch: expected ${String(observedFinalInventory)}, observed ${String(parsed.available_inventory)}`,
          );
        }
      }
    }
  }

  return {
    passed: failureCodes.length === 0,
    failureCodes: Array.from(new Set(failureCodes)),
    evidence,
    observedStateSummary: base.observedStateSummary,
  };
}

