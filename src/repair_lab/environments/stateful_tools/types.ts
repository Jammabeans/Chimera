export type ReservationStatus = "active" | "cancelled";

export type InventoryBySku = Record<string, number>;

export interface ReservationRecord {
  reservationId: string;
  sku: string;
  quantity: number;
  status: ReservationStatus;
  createdVersion: number;
}

export interface ExpectedReservationRecord {
  sku: string;
  quantity: number;
  status: ReservationStatus;
}

export interface SimulatorState {
  inventory: InventoryBySku;
  reservations: Record<string, ReservationRecord>;
  version: number;
}

export type ToolName =
  | "get_inventory"
  | "reserve_item"
  | "cancel_reservation";

export type RejectionCode =
  | "invalid_args"
  | "unknown_sku"
  | "unknown_reservation"
  | "duplicate_reservation_id"
  | "invalid_quantity"
  | "insufficient_inventory"
  | "reservation_not_active";

interface ToolResultBase {
  accepted: boolean;
}

export interface ToolAcceptedResult<TData> extends ToolResultBase {
  accepted: true;
  data: TData;
}

export interface ToolRejectedResult extends ToolResultBase {
  accepted: false;
  code: RejectionCode;
  message: string;
}

export type ToolResult<TData> = ToolAcceptedResult<TData> | ToolRejectedResult;

export interface GetInventoryArgs {
  sku: string;
}

export interface ReserveItemArgs {
  reservationId: string;
  sku: string;
  quantity: number;
}

export interface CancelReservationArgs {
  reservationId: string;
}

export interface StateSummary {
  inventory: InventoryBySku;
  activeReservationIds: string[];
  cancelledReservationIds: string[];
}

export interface ToolTraceEntry {
  traceStep: number;
  tool: ToolName;
  args: Record<string, string | number | boolean | null>;
  result: ToolResult<Record<string, string | number | boolean | null>>;
  stateVersionBefore: number;
  stateVersionAfter: number;
  stateSummaryAfter: StateSummary;
}

export interface StrictJsonFinalStateReportRequirement {
  format: "strict_json";
  requiredToolSequence: ["reserve_item", "get_inventory", "cancel_reservation"];
  expectedReservationId: string;
  expectedReservationStatus: "cancelled";
  expectedAvailableInventory: number;
}

export type TaskGoal =
  | {
      goalType: "successful_reservation";
      sku: string;
      quantity: number;
      expectedReservationId: string;
    }
  | {
      goalType: "reservation_then_cancellation";
      sku: string;
      quantity: number;
      expectedReservationId: string;
    }
  | {
      goalType: "rollback_with_final_state_report";
      sku: string;
      quantity: number;
      expectedReservationId: string;
      reportRequirement: StrictJsonFinalStateReportRequirement;
    };

export interface StatefulToolTask {
  taskId: string;
  seed: number;
  initialInventory: InventoryBySku;
  expectedFinalInventory: InventoryBySku;
  expectedReservations: Record<string, ExpectedReservationRecord>;
  goal: TaskGoal;
  description: string;
  expectedReservationId: string;
}

export type VerificationCode =
  | "invalid_inventory_value"
  | "invalid_state_version"
  | "invalid_reservation_shape"
  | "invalid_reservation_quantity"
  | "reservation_unknown_sku"
  | "task_expected_reservation_missing"
  | "task_expected_reservation_mismatch"
  | "task_expected_reservation_not_active"
  | "task_expected_reservation_not_cancelled"
  | "task_unexpected_reservation"
  | "task_inventory_mismatch"
  | "inventory_conservation_violation"
  | "rollback_not_completed"
  | "required_tool_sequence_mismatch"
  | "final_report_missing"
  | "final_report_invalid_json"
  | "final_report_schema_mismatch"
  | "final_report_reservation_id_mismatch"
  | "final_report_reservation_status_mismatch"
  | "final_report_inventory_mismatch";

export interface VerificationResult {
  passed: boolean;
  failureCodes: VerificationCode[];
  evidence: string[];
  observedStateSummary: StateSummary & { version: number };
}

