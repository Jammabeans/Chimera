import { describe, expect, it, vi } from "vitest";

import { generateStatefulToolTaskFromSeed } from "../environments/stateful_tools";
import {
  OPENAI_STATEFUL_TOOLS_BASELINE_CONFIG,
  runOpenAiStatefulToolTask,
  type OpenAiResponsesFunctionCallInputItem,
  type OpenAiResponsesFunctionCallOutputInputItem,
  type OpenAiResponsesInputItem,
  type OpenAiResponsesRequestBody,
} from "./openaiStatefulToolsRunner";

function isFunctionCallItem(item: OpenAiResponsesInputItem): item is OpenAiResponsesFunctionCallInputItem {
  return "type" in item && item.type === "function_call";
}

function isFunctionCallOutputItem(
  item: OpenAiResponsesInputItem,
): item is OpenAiResponsesFunctionCallOutputInputItem {
  return "type" in item && item.type === "function_call_output";
}

function isUserItem(item: OpenAiResponsesInputItem): item is Extract<OpenAiResponsesInputItem, { role: "user" }> {
  return "role" in item && item.role === "user";
}

function createQueueTransport(responses: unknown[]) {
  const requests: OpenAiResponsesRequestBody[] = [];
  const transport = vi.fn(async (requestBody: OpenAiResponsesRequestBody) => {
    requests.push(requestBody);
    const next = responses.shift();
    if (!next) {
      throw new Error("No mocked Responses API payload left in queue");
    }
    return next;
  });

  return { transport, requests };
}

describe("openaiStatefulToolsRunner", () => {
  it("first request is Responses-compatible and not Chat-style", async () => {
    const task = generateStatefulToolTaskFromSeed(0);
    const { transport, requests } = createQueueTransport([
      {
        output_text: "Completed with no tools.",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Completed with no tools." }],
          },
        ],
      },
    ]);

    await runOpenAiStatefulToolTask(task, { transport });

    expect(transport).toHaveBeenCalledTimes(1);
    const firstRequest = requests[0];
    expect(firstRequest.model).toBe(OPENAI_STATEFUL_TOOLS_BASELINE_CONFIG.model);
    expect(firstRequest.temperature).toBe(OPENAI_STATEFUL_TOOLS_BASELINE_CONFIG.temperature);
    expect(firstRequest.instructions.length).toBeGreaterThan(0);
    expect(firstRequest.input).toHaveLength(1);
    expect(firstRequest.input[0]).toMatchObject({ role: "user" });
    expect(firstRequest.tools).toHaveLength(3);
    expect(firstRequest.tool_choice).toBe("auto");
    expect(firstRequest.store).toBe(false);
    expect((firstRequest as unknown as { messages?: unknown }).messages).toBeUndefined();
    expect(firstRequest.input.some((item) => (item as { role?: string }).role === "tool")).toBe(false);
    expect(JSON.stringify(firstRequest)).not.toContain("tool_call_id");
  });

  it("single tool-call continuation replays function_call and function_call_output with same call_id", async () => {
    const task = generateStatefulToolTaskFromSeed(0);
    if (task.goal.goalType !== "successful_reservation") {
      throw new Error("unexpected task type for test");
    }

    const callId = "call-1";
    const { transport, requests } = createQueueTransport([
      {
        output: [
          {
            type: "function_call",
            call_id: callId,
            name: "reserve_item",
            arguments: JSON.stringify({
              reservationId: task.expectedReservationId,
              sku: task.goal.sku,
              quantity: task.goal.quantity,
            }),
          },
        ],
      },
      {
        output_text: "Done. Reservation completed.",
        output: [{ type: "message", content: [{ type: "output_text", text: "Done. Reservation completed." }] }],
      },
    ]);

    const result = await runOpenAiStatefulToolTask(task, { transport });

    expect(result.status).toBe("completed");
    expect(result.verifierResult.passed).toBe(true);
    expect(transport).toHaveBeenCalledTimes(2);
    const secondRequest = requests[1];
    const replayedCall = secondRequest.input.find((item) => isFunctionCallItem(item) && item.call_id === callId);
    const callOutput = secondRequest.input.find(
      (item): item is OpenAiResponsesFunctionCallOutputInputItem =>
        isFunctionCallOutputItem(item) && item.call_id === callId,
    );

    expect(replayedCall).toBeDefined();
    expect(callOutput).toBeDefined();
    if (!callOutput) {
      throw new Error("missing function_call_output");
    }

    const parsedToolPayload = JSON.parse(callOutput.output) as {
      accepted: boolean;
      data?: { reservationId: string };
    };
    expect(parsedToolPayload.accepted).toBe(true);
    expect(parsedToolPayload.data?.reservationId).toBe(task.expectedReservationId);
    expect(JSON.stringify(secondRequest)).not.toContain("tool_call_id");
    expect(secondRequest.input.some((item) => (item as { role?: string }).role === "tool")).toBe(false);
  });

  it("multiple tool calls preserve call/output ordering and dispatch sequentially", async () => {
    const task = generateStatefulToolTaskFromSeed(0);
    if (task.goal.goalType !== "successful_reservation") {
      throw new Error("unexpected task type for test");
    }

    const { transport, requests } = createQueueTransport([
      {
        output: [
          {
            type: "function_call",
            call_id: "call-1",
            name: "get_inventory",
            arguments: JSON.stringify({ sku: task.goal.sku }),
          },
          {
            type: "function_call",
            call_id: "call-2",
            name: "reserve_item",
            arguments: JSON.stringify({
              reservationId: task.expectedReservationId,
              sku: task.goal.sku,
              quantity: task.goal.quantity,
            }),
          },
        ],
      },
      {
        output_text: "Done.",
        output: [{ type: "message", content: [{ type: "output_text", text: "Done." }] }],
      },
    ]);

    const result = await runOpenAiStatefulToolTask(task, { transport });

    expect(result.status).toBe("completed");
    expect(result.verifierResult.passed).toBe(true);
    expect(result.dispatchedToolCalls.map((item) => item.toolCallId)).toEqual(["call-1", "call-2"]);
    expect(result.dispatchedToolCalls.map((item) => item.toolName)).toEqual(["get_inventory", "reserve_item"]);

    const secondRequest = requests[1];
    const compactInput = secondRequest.input.map((item) => {
      if (isFunctionCallItem(item)) {
        return `${item.type}:${item.call_id}:${item.name}`;
      }
      if (isFunctionCallOutputItem(item)) {
        return `${item.type}:${item.call_id}`;
      }
      if (isUserItem(item)) {
        return `${item.role}:user`;
      }

      return "unknown";
    });

    expect(compactInput).toEqual([
      "user:user",
      "function_call:call-1:get_inventory",
      "function_call:call-2:reserve_item",
      "function_call_output:call-1",
      "function_call_output:call-2",
    ]);
  });

  it("successful reserve-only run dispatches reserve_item and captures final text", async () => {
    const task = generateStatefulToolTaskFromSeed(0);
    expect(task.goal.goalType).toBe("successful_reservation");
    if (task.goal.goalType !== "successful_reservation") {
      throw new Error("unexpected task type for test");
    }

    const { transport, requests } = createQueueTransport([
      {
        output: [
          {
            type: "function_call",
            call_id: "call-1",
            name: "reserve_item",
            arguments: JSON.stringify({
              reservationId: task.expectedReservationId,
              sku: task.goal.sku,
              quantity: task.goal.quantity,
            }),
          },
        ],
        usage: { input_tokens: 11, output_tokens: 3, total_tokens: 14 },
      },
      {
        output_text: "Done. Reservation completed.",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Done. Reservation completed." }],
          },
        ],
        usage: { input_tokens: 9, output_tokens: 4, total_tokens: 13 },
      },
    ]);

    const result = await runOpenAiStatefulToolTask(task, {
      transport,
    });

    expect(result.status).toBe("completed");
    expect(result.verifierResult.passed).toBe(true);
    expect(result.baselineConfig.model).toBe(OPENAI_STATEFUL_TOOLS_BASELINE_CONFIG.model);
    expect(result.baselineConfig.temperature).toBe(OPENAI_STATEFUL_TOOLS_BASELINE_CONFIG.temperature);
    expect(result.baselineConfig.maxToolCallRounds).toBe(
      OPENAI_STATEFUL_TOOLS_BASELINE_CONFIG.maxToolCallRounds,
    );
    expect(result.dispatchedToolCalls).toHaveLength(1);
    expect(result.dispatchedToolCalls[0].toolName).toBe("reserve_item");
    expect(result.finalModelText).toBe("Done. Reservation completed.");

    expect(transport).toHaveBeenCalledTimes(2);
    const secondRequest = requests[1];
    const toolOutput = secondRequest.input.find((item) => isFunctionCallOutputItem(item));
    expect(toolOutput).toBeDefined();
    if (!toolOutput || toolOutput.type !== "function_call_output") {
      throw new Error("missing function_call_output");
    }
    const toolOutputItem = toolOutput;

    const parsedToolPayload = JSON.parse(toolOutputItem.output) as {
      accepted: boolean;
      data?: { reservationId: string };
    };
    expect(parsedToolPayload.accepted).toBe(true);
    expect(parsedToolPayload.data?.reservationId).toBe(task.expectedReservationId);
  });

  it("successful rollback run reserves then cancels and verifier passes", async () => {
    const task = generateStatefulToolTaskFromSeed(1);
    expect(task.goal.goalType).toBe("reservation_then_cancellation");
    if (task.goal.goalType !== "reservation_then_cancellation") {
      throw new Error("unexpected task type for test");
    }

    const { transport } = createQueueTransport([
      {
        output: [
          {
            type: "function_call",
            call_id: "call-1",
            name: "reserve_item",
            arguments: JSON.stringify({
              reservationId: task.expectedReservationId,
              sku: task.goal.sku,
              quantity: task.goal.quantity,
            }),
          },
        ],
      },
      {
        output: [
          {
            type: "function_call",
            call_id: "call-2",
            name: "cancel_reservation",
            arguments: JSON.stringify({ reservationId: task.expectedReservationId }),
          },
        ],
      },
      {
        output_text: "Rollback completed.",
        output: [{ type: "message", content: [{ type: "output_text", text: "Rollback completed." }] }],
      },
    ]);

    const result = await runOpenAiStatefulToolTask(task, {
      transport,
    });

    expect(result.status).toBe("completed");
    expect(result.verifierResult.passed).toBe(true);
    expect(result.simulatorFinalState.inventory).toEqual(task.expectedFinalInventory);
    expect(result.simulatorFinalState.reservations[task.expectedReservationId]?.status).toBe("cancelled");
  });

  it("report-task runner path passes with reserve->get_inventory->cancel and strict JSON final text", async () => {
    const task = generateStatefulToolTaskFromSeed(3);
    expect(task.goal.goalType).toBe("rollback_with_final_state_report");
    if (task.goal.goalType !== "rollback_with_final_state_report") {
      throw new Error("unexpected task type for test");
    }

    const { transport } = createQueueTransport([
      {
        output: [
          {
            type: "function_call",
            call_id: "call-1",
            name: "reserve_item",
            arguments: JSON.stringify({
              reservationId: task.expectedReservationId,
              sku: task.goal.sku,
              quantity: task.goal.quantity,
            }),
          },
          {
            type: "function_call",
            call_id: "call-2",
            name: "get_inventory",
            arguments: JSON.stringify({ sku: task.goal.sku }),
          },
        ],
      },
      {
        output: [
          {
            type: "function_call",
            call_id: "call-3",
            name: "cancel_reservation",
            arguments: JSON.stringify({ reservationId: task.expectedReservationId }),
          },
        ],
      },
      {
        output_text: JSON.stringify({
          reservation_id: task.expectedReservationId,
          reservation_status: "cancelled",
          available_inventory: 9,
        }),
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  reservation_id: task.expectedReservationId,
                  reservation_status: "cancelled",
                  available_inventory: 9,
                }),
              },
            ],
          },
        ],
      },
    ]);

    const result = await runOpenAiStatefulToolTask(task, { transport });

    expect(result.status).toBe("completed");
    expect(result.verifierResult.passed).toBe(true);
    expect(result.verifierResult.failureCodes).toEqual([]);
    expect(result.simulatorTrace.map((entry) => entry.tool)).toEqual([
      "reserve_item",
      "get_inventory",
      "cancel_reservation",
    ]);
  });

  it("report-task runner path fails hard verifier for stale strict JSON inventory", async () => {
    const task = generateStatefulToolTaskFromSeed(3);
    expect(task.goal.goalType).toBe("rollback_with_final_state_report");
    if (task.goal.goalType !== "rollback_with_final_state_report") {
      throw new Error("unexpected task type for test");
    }

    const { transport } = createQueueTransport([
      {
        output: [
          {
            type: "function_call",
            call_id: "call-1",
            name: "reserve_item",
            arguments: JSON.stringify({
              reservationId: task.expectedReservationId,
              sku: task.goal.sku,
              quantity: task.goal.quantity,
            }),
          },
        ],
      },
      {
        output: [
          {
            type: "function_call",
            call_id: "call-2",
            name: "get_inventory",
            arguments: JSON.stringify({ sku: task.goal.sku }),
          },
        ],
      },
      {
        output: [
          {
            type: "function_call",
            call_id: "call-3",
            name: "cancel_reservation",
            arguments: JSON.stringify({ reservationId: task.expectedReservationId }),
          },
        ],
      },
      {
        output_text: JSON.stringify({
          reservation_id: task.expectedReservationId,
          reservation_status: "cancelled",
          available_inventory: 5,
        }),
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  reservation_id: task.expectedReservationId,
                  reservation_status: "cancelled",
                  available_inventory: 5,
                }),
              },
            ],
          },
        ],
      },
    ]);

    const result = await runOpenAiStatefulToolTask(task, { transport });

    expect(result.status).toBe("completed");
    expect(result.simulatorFinalState.inventory[task.goal.sku]).toBe(9);
    expect(result.verifierResult.passed).toBe(false);
    expect(result.verifierResult.failureCodes).toContain("final_report_inventory_mismatch");
  });

  it("existing runner state-only task remains prose-insensitive under execution-level verifier", async () => {
    const task = generateStatefulToolTaskFromSeed(1);
    expect(task.goal.goalType).toBe("reservation_then_cancellation");
    if (task.goal.goalType !== "reservation_then_cancellation") {
      throw new Error("unexpected task type for test");
    }

    const { transport } = createQueueTransport([
      {
        output: [
          {
            type: "function_call",
            call_id: "call-1",
            name: "reserve_item",
            arguments: JSON.stringify({
              reservationId: task.expectedReservationId,
              sku: task.goal.sku,
              quantity: task.goal.quantity,
            }),
          },
        ],
      },
      {
        output: [
          {
            type: "function_call",
            call_id: "call-2",
            name: "cancel_reservation",
            arguments: JSON.stringify({ reservationId: task.expectedReservationId }),
          },
        ],
      },
      {
        output_text: "Rollback done; inventory is restored.",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Rollback done; inventory is restored." }],
          },
        ],
      },
    ]);

    const result = await runOpenAiStatefulToolTask(task, { transport });

    expect(result.status).toBe("completed");
    expect(result.verifierResult.passed).toBe(true);
    expect(result.verifierResult.failureCodes).toEqual([]);
  });

  it("collateral side effect can complete model flow while verifier fails", async () => {
    const task = generateStatefulToolTaskFromSeed(0);
    expect(task.goal.goalType).toBe("successful_reservation");
    if (task.goal.goalType !== "successful_reservation") {
      throw new Error("unexpected task type for test");
    }

    const { transport } = createQueueTransport([
      {
        output: [
          {
            type: "function_call",
            call_id: "call-1",
            name: "reserve_item",
            arguments: JSON.stringify({
              reservationId: task.expectedReservationId,
              sku: task.goal.sku,
              quantity: task.goal.quantity,
            }),
          },
          {
            type: "function_call",
            call_id: "call-2",
            name: "reserve_item",
            arguments: JSON.stringify({
              reservationId: "unexpected-side-effect",
              sku: "SKU_B",
              quantity: 1,
            }),
          },
        ],
      },
      {
        output_text: "Done.",
        output: [{ type: "message", content: [{ type: "output_text", text: "Done." }] }],
      },
    ]);

    const result = await runOpenAiStatefulToolTask(task, {
      transport,
    });

    expect(result.status).toBe("completed");
    expect(result.verifierResult.passed).toBe(false);
    expect(result.verifierResult.failureCodes).toContain("task_unexpected_reservation");
  });

  it("stops at maximum tool-call rounds before dispatching extra call", async () => {
    const task = generateStatefulToolTaskFromSeed(0);

    const { transport } = createQueueTransport([
      {
        output: [
          {
            type: "function_call",
            call_id: "call-1",
            name: "get_inventory",
            arguments: JSON.stringify({ sku: task.goal.sku }),
          },
        ],
      },
      {
        output: [
          {
            type: "function_call",
            call_id: "call-2",
            name: "get_inventory",
            arguments: JSON.stringify({ sku: task.goal.sku }),
          },
        ],
      },
      {
        output: [
          {
            type: "function_call",
            call_id: "call-3",
            name: "get_inventory",
            arguments: JSON.stringify({ sku: task.goal.sku }),
          },
        ],
      },
    ]);

    const result = await runOpenAiStatefulToolTask(task, {
      transport,
      maxToolCallRounds: 2,
    });

    expect(result.status).toBe("max_tool_call_rounds");
    expect(result.terminationReason).toBe("tool_call_round_limit_reached_before_dispatch");
    expect(result.dispatchedToolCalls).toHaveLength(2);
    expect(result.dispatchedToolCalls[0].toolCallId).toBe("call-1");
    expect(result.dispatchedToolCalls[1].toolCallId).toBe("call-2");
  });

  it("malformed JSON tool arguments terminates safely without state mutation", async () => {
    const task = generateStatefulToolTaskFromSeed(0);

    const { transport } = createQueueTransport([
      {
        output: [
          {
            type: "function_call",
            call_id: "call-1",
            name: "reserve_item",
            arguments: "{not-valid-json}",
          },
        ],
      },
    ]);

    const result = await runOpenAiStatefulToolTask(task, {
      transport,
    });

    expect(result.status).toBe("malformed_model_output");
    expect(result.terminationReason).toBe("malformed_json_tool_arguments");
    expect(result.simulatorFinalState.version).toBe(0);
    expect(result.simulatorFinalState.reservations).toEqual({});
  });

  it("missing API key returns configuration_error and does not call fetch", async () => {
    const task = generateStatefulToolTaskFromSeed(0);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await runOpenAiStatefulToolTask(task, {
      apiKey: "",
    });

    expect(result.status).toBe("configuration_error");
    expect(result.terminationReason).toBe("missing_openai_api_key");
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("provider error is captured as safe serializable evidence", async () => {
    const task = generateStatefulToolTaskFromSeed(0);

    const providerFailure = vi.fn(async (_request: OpenAiResponsesRequestBody) => {
      throw new Error("request failed for key sk-secret-key");
    });

    const result = await runOpenAiStatefulToolTask(task, {
      transport: providerFailure,
    });

    expect(result.status).toBe("provider_error");
    expect(result.terminationReason).toBe("provider_exception");
    expect(result.error).toEqual({
      name: "Error",
      message: "request failed for key [redacted]",
    });
    expect(JSON.stringify(result)).not.toContain("sk-secret-key");
  });

  it("no-tool immediate final response completes but verifier can fail", async () => {
    const task = generateStatefulToolTaskFromSeed(0);

    const { transport } = createQueueTransport([
      {
        output_text: "Completed with no tools.",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Completed with no tools." }],
          },
        ],
      },
    ]);

    const result = await runOpenAiStatefulToolTask(task, {
      transport,
    });

    expect(result.status).toBe("completed");
    expect(result.finalModelText).toBe("Completed with no tools.");
    expect(result.verifierResult.passed).toBe(false);
    expect(result.verifierResult.failureCodes).toContain("task_expected_reservation_missing");
  });

  it("raw malformed API payload with no usable output is malformed_model_output", async () => {
    const task = generateStatefulToolTaskFromSeed(0);
    const { transport } = createQueueTransport([{}]);

    const result = await runOpenAiStatefulToolTask(task, { transport });

    expect(result.status).toBe("malformed_model_output");
    expect(result.terminationReason).toBe("missing_text_and_tool_calls");
  });

  it("injected transport can run without API key and request/result do not leak secret", async () => {
    const task = generateStatefulToolTaskFromSeed(0);
    const fakeApiKey = "sk-secret-do-not-leak";
    const { transport, requests } = createQueueTransport([
      {
        output_text: "Completed with no tools.",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Completed with no tools." }],
          },
        ],
      },
    ]);

    const result = await runOpenAiStatefulToolTask(task, {
      apiKey: fakeApiKey,
      transport,
    });

    expect(result.status).toBe("completed");
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0])).not.toContain(fakeApiKey);
    expect(JSON.stringify(result)).not.toContain(fakeApiKey);
  });
});

