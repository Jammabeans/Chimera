import {
  CancelReservationArgs,
  GetInventoryArgs,
  InventoryBySku,
  ReservationRecord,
  ReserveItemArgs,
  SimulatorState,
  StateSummary,
  ToolRejectedResult,
  ToolResult,
  ToolTraceEntry,
} from "./types";

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function deepCopyInventory(inventory: InventoryBySku): InventoryBySku {
  return JSON.parse(JSON.stringify(inventory)) as InventoryBySku;
}

function deepCopyReservations(
  reservations: Record<string, ReservationRecord>,
): Record<string, ReservationRecord> {
  return JSON.parse(JSON.stringify(reservations)) as Record<
    string,
    ReservationRecord
  >;
}

function deepCopyState(state: SimulatorState): SimulatorState {
  return {
    inventory: deepCopyInventory(state.inventory),
    reservations: deepCopyReservations(state.reservations),
    version: state.version,
  };
}

function stateSummary(state: SimulatorState): StateSummary {
  const activeReservationIds = Object.values(state.reservations)
    .filter((reservation) => reservation.status === "active")
    .map((reservation) => reservation.reservationId)
    .sort();

  const cancelledReservationIds = Object.values(state.reservations)
    .filter((reservation) => reservation.status === "cancelled")
    .map((reservation) => reservation.reservationId)
    .sort();

  const inventoryKeys = Object.keys(state.inventory).sort();
  const normalizedInventory: InventoryBySku = {};
  for (const key of inventoryKeys) {
    normalizedInventory[key] = state.inventory[key];
  }

  return {
    inventory: normalizedInventory,
    activeReservationIds,
    cancelledReservationIds,
  };
}

function rejected(
  code: ToolRejectedResult["code"],
  message: string,
): ToolRejectedResult {
  return { accepted: false, code, message };
}

function stableArgs(
  args: unknown,
): Record<string, string | number | boolean | null> {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return {};
  }

  const objectArgs = args as Record<string, unknown>;
  const keys = Object.keys(objectArgs).sort();
  const canonical: Record<string, string | number | boolean | null> = {};
  for (const key of keys) {
    const raw = objectArgs[key];
    if (
      raw === null ||
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean"
    ) {
      canonical[key] = raw;
      continue;
    }
    canonical[key] = String(raw);
  }
  return canonical;
}

export interface StatefulToolSimulator {
  getInventory(args: GetInventoryArgs): ToolResult<{ sku: string; available: number }>;
  reserveItem(
    args: ReserveItemArgs,
  ): ToolResult<{ reservationId: string; sku: string; quantity: number; status: "active" }>;
  cancelReservation(
    args: CancelReservationArgs,
  ): ToolResult<{ reservationId: string; status: "cancelled" }>;
  getStateSnapshot(): SimulatorState;
  getTrace(): ToolTraceEntry[];
}

export function createStatefulToolSimulator(initialInventory: InventoryBySku): StatefulToolSimulator {
  const inventoryEntries = Object.entries(initialInventory);
  for (const [sku, quantity] of inventoryEntries) {
    if (sku.length === 0) {
      throw new Error("initial inventory sku keys must be non-empty strings");
    }
    if (!isPositiveInteger(quantity)) {
      throw new Error("initial inventory quantities must be positive integers");
    }
  }

  const state: SimulatorState = {
    inventory: deepCopyInventory(initialInventory),
    reservations: {},
    version: 0,
  };

  const trace: ToolTraceEntry[] = [];
  let traceStep = 0;

  function appendTrace(
    tool: ToolTraceEntry["tool"],
    args: unknown,
    stateVersionBefore: number,
    result: ToolResult<Record<string, string | number | boolean | null>>,
  ): void {
    traceStep += 1;
    trace.push({
      traceStep,
      tool,
      args: stableArgs(args),
      result,
      stateVersionBefore,
      stateVersionAfter: state.version,
      stateSummaryAfter: stateSummary(state),
    });
  }

  return {
    getInventory(args) {
      const stateVersionBefore = state.version;
      if (!args || typeof args.sku !== "string" || args.sku.length === 0) {
        const result = rejected("invalid_args", "sku must be a non-empty string");
        appendTrace("get_inventory", args ?? {}, stateVersionBefore, result);
        return result;
      }

      const sku = args.sku;
      if (!(sku in state.inventory)) {
        const result = rejected("unknown_sku", `sku does not exist: ${sku}`);
        appendTrace("get_inventory", { sku }, stateVersionBefore, result);
        return result;
      }

      const result: ToolResult<{ sku: string; available: number }> = {
        accepted: true,
        data: {
          sku,
          available: state.inventory[sku],
        },
      };

      appendTrace("get_inventory", { sku }, stateVersionBefore, {
        accepted: true,
        data: { sku, available: state.inventory[sku] },
      });

      return result;
    },

    reserveItem(args) {
      const stateVersionBefore = state.version;
      if (
        !args ||
        typeof args.reservationId !== "string" ||
        args.reservationId.length === 0 ||
        typeof args.sku !== "string" ||
        args.sku.length === 0 ||
        typeof args.quantity !== "number"
      ) {
        const result = rejected(
          "invalid_args",
          "reservationId, sku, and quantity are required",
        );
        appendTrace("reserve_item", args ?? {}, stateVersionBefore, result);
        return result;
      }

      const { reservationId, sku, quantity } = args;

      if (!isPositiveInteger(quantity)) {
        const result = rejected("invalid_quantity", "quantity must be a positive integer");
        appendTrace(
          "reserve_item",
          { reservationId, sku, quantity },
          stateVersionBefore,
          result,
        );
        return result;
      }

      if (reservationId in state.reservations) {
        const result = rejected(
          "duplicate_reservation_id",
          `reservation already exists: ${reservationId}`,
        );
        appendTrace(
          "reserve_item",
          { reservationId, sku, quantity },
          stateVersionBefore,
          result,
        );
        return result;
      }

      if (!(sku in state.inventory)) {
        const result = rejected("unknown_sku", `sku does not exist: ${sku}`);
        appendTrace(
          "reserve_item",
          { reservationId, sku, quantity },
          stateVersionBefore,
          result,
        );
        return result;
      }

      if (state.inventory[sku] < quantity) {
        const result = rejected(
          "insufficient_inventory",
          `insufficient inventory for sku ${sku}`,
        );
        appendTrace(
          "reserve_item",
          { reservationId, sku, quantity },
          stateVersionBefore,
          result,
        );
        return result;
      }

      state.inventory[sku] -= quantity;
      state.version += 1;
      state.reservations[reservationId] = {
        reservationId,
        sku,
        quantity,
        status: "active",
        createdVersion: state.version,
      };

      const result: ToolResult<{
        reservationId: string;
        sku: string;
        quantity: number;
        status: "active";
      }> = {
        accepted: true,
        data: {
          reservationId,
          sku,
          quantity,
          status: "active",
        },
      };

      appendTrace("reserve_item", { reservationId, sku, quantity }, stateVersionBefore, {
        accepted: true,
        data: {
          reservationId,
          sku,
          quantity,
          status: "active",
        },
      });

      return result;
    },

    cancelReservation(args) {
      const stateVersionBefore = state.version;
      if (!args || typeof args.reservationId !== "string" || args.reservationId.length === 0) {
        const result = rejected("invalid_args", "reservationId must be a non-empty string");
        appendTrace("cancel_reservation", args ?? {}, stateVersionBefore, result);
        return result;
      }

      const { reservationId } = args;
      const reservation = state.reservations[reservationId];
      if (!reservation) {
        const result = rejected(
          "unknown_reservation",
          `reservation does not exist: ${reservationId}`,
        );
        appendTrace(
          "cancel_reservation",
          { reservationId },
          stateVersionBefore,
          result,
        );
        return result;
      }

      if (reservation.status !== "active") {
        const result = rejected(
          "reservation_not_active",
          `reservation is not active: ${reservationId}`,
        );
        appendTrace(
          "cancel_reservation",
          { reservationId },
          stateVersionBefore,
          result,
        );
        return result;
      }

      state.inventory[reservation.sku] += reservation.quantity;
      reservation.status = "cancelled";
      state.version += 1;

      const result: ToolResult<{ reservationId: string; status: "cancelled" }> = {
        accepted: true,
        data: {
          reservationId,
          status: "cancelled",
        },
      };

      appendTrace("cancel_reservation", { reservationId }, stateVersionBefore, {
        accepted: true,
        data: {
          reservationId,
          status: "cancelled",
        },
      });

      return result;
    },

    getStateSnapshot() {
      return deepCopyState(state);
    },

    getTrace() {
      return JSON.parse(JSON.stringify(trace)) as ToolTraceEntry[];
    },
  };
}

