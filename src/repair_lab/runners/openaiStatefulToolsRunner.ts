import {
  createStatefulToolSimulator,
  type StatefulToolTask,
  type VerificationResult,
  verifyStatefulToolTaskExecution,
} from "../environments/stateful_tools";

const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses" as const;

export const OPENAI_STATEFUL_TOOLS_BASELINE_CONFIG = {
  provider: "openai",
  model: "gpt-4o-mini-2024-07-18",
  temperature: 0,
  maxToolCallRounds: 6,
} as const;

export type OpenAiStatefulToolsRunStatus =
  | "completed"
  | "max_tool_call_rounds"
  | "configuration_error"
  | "provider_error"
  | "malformed_model_output";

export interface OpenAiStatefulToolsUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface OpenAiStatefulToolCall {
  toolCallId: string;
  name: string;
  argumentsJson: string;
}

export interface OpenAiResponsesFunctionCallInputItem {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
  id?: string;
  status?: string;
}

export interface OpenAiResponsesFunctionCallOutputInputItem {
  type: "function_call_output";
  call_id: string;
  output: string;
}

export type OpenAiResponsesInputItem =
  | { role: "user"; content: string }
  | OpenAiResponsesFunctionCallInputItem
  | OpenAiResponsesFunctionCallOutputInputItem;

export interface OpenAiResponsesRequestBody {
  model: string;
  instructions: string;
  temperature: number;
  input: OpenAiResponsesInputItem[];
  tools: OpenAiResponsesFunctionTool[];
  tool_choice: "auto";
  store: false;
}

export type OpenAiResponsesTransport = (requestBody: OpenAiResponsesRequestBody) => Promise<unknown>;

export interface OpenAiStatefulToolsModelTurnTrace {
  requestIndex: number;
  requestInputItemCount: number;
  responseAssistantText: string | null;
  responseToolCalls: OpenAiStatefulToolCall[];
  responseFunctionCallIds: string[];
  replayedFunctionCallCount: number;
  usage: OpenAiStatefulToolsUsage;
  latencyMs: number;
}

export interface OpenAiStatefulToolsDispatchedToolCallTrace {
  requestIndex: number;
  sequenceInResponse: number;
  toolCallId: string;
  toolName: string;
  argumentsJson: string;
  resultContent: string;
}

export interface OpenAiStatefulToolsSafeError {
  name: string;
  message: string;
}

export interface OpenAiStatefulToolsRunResult {
  status: OpenAiStatefulToolsRunStatus;
  baselineConfig: {
    provider: "openai";
    model: string;
    temperature: number;
    maxToolCallRounds: number;
  };
  task: {
    taskId: string;
    seed: number;
  };
  systemPrompt: string;
  taskInstruction: string;
  modelTurns: OpenAiStatefulToolsModelTurnTrace[];
  dispatchedToolCalls: OpenAiStatefulToolsDispatchedToolCallTrace[];
  finalModelText: string | null;
  simulatorFinalState: ReturnType<typeof createStatefulToolSimulator>["getStateSnapshot"] extends () => infer T
    ? T
    : never;
  simulatorTrace: ReturnType<typeof createStatefulToolSimulator>["getTrace"] extends () => infer T ? T : never;
  verifierResult: VerificationResult;
  terminationReason: string;
  requestCount: number;
  toolCallRounds: number;
  requestLatenciesMs: number[];
  totalLatencyMs: number;
  usage: OpenAiStatefulToolsUsage;
  error: OpenAiStatefulToolsSafeError | null;
}

export interface RunOpenAiStatefulToolTaskOptions {
  maxToolCallRounds?: number;
  apiKey?: string | null;
  transport?: OpenAiResponsesTransport;
}

interface OpenAiResponsesFunctionTool {
  type: "function";
  name: "get_inventory" | "reserve_item" | "cancel_reservation";
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: boolean;
  };
}

const SYSTEM_PROMPT =
  "You are an operations agent. Complete the task using available tools when needed. Tool results are authoritative. Do not invent tool results. Provide a concise final response when finished.";

const TOOL_SCHEMAS: OpenAiResponsesFunctionTool[] = [
  {
    type: "function",
    name: "get_inventory",
    description: "Read the currently available inventory for a SKU.",
    parameters: {
      type: "object",
      properties: {
        sku: { type: "string", description: "Stock keeping unit identifier." },
      },
      required: ["sku"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "reserve_item",
    description: "Reserve quantity of a SKU under a reservation id.",
    parameters: {
      type: "object",
      properties: {
        reservationId: { type: "string", description: "Reservation identifier." },
        sku: { type: "string", description: "Stock keeping unit identifier." },
        quantity: { type: "number", description: "Positive integer quantity to reserve." },
      },
      required: ["reservationId", "sku", "quantity"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "cancel_reservation",
    description: "Cancel an existing reservation id.",
    parameters: {
      type: "object",
      properties: {
        reservationId: { type: "string", description: "Reservation identifier." },
      },
      required: ["reservationId"],
      additionalProperties: false,
    },
  },
];

function toTaskInstruction(task: StatefulToolTask): string {
  const goalLines =
    task.goal.goalType === "successful_reservation"
      ? ["Goal: reserve the item and finish."]
      : task.goal.goalType === "reservation_then_cancellation"
        ? ["Goal: reserve the item then cancel that reservation before finishing."]
        : [
            "Goal: reserve the item, read interim inventory, cancel the reservation, then report final state.",
            "Required tool sequence: reserve_item -> get_inventory -> cancel_reservation.",
            "Final answer must be strict JSON only (no markdown, prose, or code fence).",
            "Required final JSON keys exactly: reservation_id, reservation_status, available_inventory.",
          ];

  return [
    `Task description: ${task.description}`,
    `Required target SKU: ${task.goal.sku}`,
    `Required quantity: ${task.goal.quantity}`,
    `Required reservation ID: ${task.expectedReservationId}`,
    `Goal mode: ${task.goal.goalType}`,
    ...goalLines,
  ].join("\n");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const body = keys.map((key) => `${JSON.stringify(key)}:${stableJson(obj[key])}`).join(",");
    return `{${body}}`;
  }

  return JSON.stringify(String(value));
}

function toUsage(usage?: Partial<OpenAiStatefulToolsUsage>): OpenAiStatefulToolsUsage {
  return {
    inputTokens: typeof usage?.inputTokens === "number" ? usage.inputTokens : null,
    outputTokens: typeof usage?.outputTokens === "number" ? usage.outputTokens : null,
    totalTokens: typeof usage?.totalTokens === "number" ? usage.totalTokens : null,
  };
}

function addUsage(
  running: OpenAiStatefulToolsUsage,
  current: OpenAiStatefulToolsUsage,
): OpenAiStatefulToolsUsage {
  return {
    inputTokens:
      running.inputTokens === null && current.inputTokens === null
        ? null
        : (running.inputTokens ?? 0) + (current.inputTokens ?? 0),
    outputTokens:
      running.outputTokens === null && current.outputTokens === null
        ? null
        : (running.outputTokens ?? 0) + (current.outputTokens ?? 0),
    totalTokens:
      running.totalTokens === null && current.totalTokens === null
        ? null
        : (running.totalTokens ?? 0) + (current.totalTokens ?? 0),
  };
}

function redactSecrets(value: string): string {
  return value.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
}

function toSafeError(error: unknown): OpenAiStatefulToolsSafeError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactSecrets(error.message),
    };
  }

  return {
    name: "UnknownError",
    message: redactSecrets(String(error)),
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseToolArgs(
  json: string,
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: "malformed_json_tool_arguments" } {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isObjectRecord(parsed)) {
      return { ok: false, reason: "malformed_json_tool_arguments" };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, reason: "malformed_json_tool_arguments" };
  }
}

function hasExactKeys(obj: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(obj).sort();
  const expectedKeys = [...expected].sort();
  return keys.length === expectedKeys.length && keys.every((key, index) => key === expectedKeys[index]);
}

function extractOpenAiErrorMessage(payload: unknown): string {
  if (
    isObjectRecord(payload) &&
    isObjectRecord(payload.error) &&
    typeof payload.error.message === "string" &&
    payload.error.message.trim().length > 0
  ) {
    return payload.error.message;
  }

  return "OpenAI request failed.";
}

function createOpenAiResponsesFetchTransport(apiKey: string): OpenAiResponsesTransport {
  return async function fetchModelResponse(requestBody: OpenAiResponsesRequestBody): Promise<unknown> {
    const response = await fetch(OPENAI_RESPONSES_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(`OpenAI API error (${response.status}): ${extractOpenAiErrorMessage(payload)}`);
    }

    return payload;
  };
}

type ParsedResponsesApiPayload =
  | {
      ok: true;
      assistantText: string | null;
      toolCalls: OpenAiStatefulToolCall[];
      replayableFunctionCalls: OpenAiResponsesFunctionCallInputItem[];
      usage: OpenAiStatefulToolsUsage;
      hasUsableToolOrOutputItem: boolean;
    }
  | {
      ok: false;
      usage: OpenAiStatefulToolsUsage;
      terminationReason: string;
      message: string;
      assistantText: string | null;
      toolCalls: OpenAiStatefulToolCall[];
      replayableFunctionCalls: OpenAiResponsesFunctionCallInputItem[];
      hasUsableToolOrOutputItem: boolean;
    };

function parseResponsesApiPayload(payload: unknown): ParsedResponsesApiPayload {
  const usageObject = isObjectRecord(payload) && isObjectRecord(payload.usage) ? payload.usage : {};
  const usage = toUsage({
    inputTokens:
      typeof usageObject.input_tokens === "number"
        ? usageObject.input_tokens
        : typeof usageObject.prompt_tokens === "number"
          ? usageObject.prompt_tokens
          : null,
    outputTokens:
      typeof usageObject.output_tokens === "number"
        ? usageObject.output_tokens
        : typeof usageObject.completion_tokens === "number"
          ? usageObject.completion_tokens
          : null,
    totalTokens: typeof usageObject.total_tokens === "number" ? usageObject.total_tokens : null,
  });

  if (!isObjectRecord(payload)) {
    return {
      ok: true,
      assistantText: null,
      toolCalls: [],
      replayableFunctionCalls: [],
      usage,
      hasUsableToolOrOutputItem: false,
    };
  }

  const toolCalls: OpenAiStatefulToolCall[] = [];
  const replayableFunctionCalls: OpenAiResponsesFunctionCallInputItem[] = [];
  const textChunks: string[] = [];
  let hasUsableToolOrOutputItem = false;
  const topLevelOutputText = typeof payload.output_text === "string" ? payload.output_text.trim() : "";
  const hasTopLevelOutputText = topLevelOutputText.length > 0;

  if (hasTopLevelOutputText) {
    textChunks.push(topLevelOutputText);
    hasUsableToolOrOutputItem = true;
  }

  if (Array.isArray(payload.output)) {
    for (const outputItem of payload.output) {
      if (!isObjectRecord(outputItem)) {
        continue;
      }

      const itemType = typeof outputItem.type === "string" ? outputItem.type : "";

      if (itemType === "function_call") {
        const callId = typeof outputItem.call_id === "string" ? outputItem.call_id.trim() : "";
        const name = typeof outputItem.name === "string" ? outputItem.name.trim() : "";
        const rawArgs =
          typeof outputItem.arguments === "string" ? outputItem.arguments : stableJson(outputItem.arguments ?? {});

        if (callId.length === 0 || name.length === 0 || rawArgs.length === 0) {
          return {
            ok: false,
            usage,
            terminationReason: "unsupported_tool_call_structure",
            message: "Model emitted function_call without usable call_id/name/arguments.",
            assistantText: null,
            toolCalls: [],
            replayableFunctionCalls: [],
            hasUsableToolOrOutputItem,
          };
        }

        toolCalls.push({
          toolCallId: callId,
          name,
          argumentsJson: rawArgs,
        });

        replayableFunctionCalls.push({
          type: "function_call",
          call_id: callId,
          name,
          arguments: rawArgs,
          ...(typeof outputItem.id === "string" ? { id: outputItem.id } : {}),
          ...(typeof outputItem.status === "string" ? { status: outputItem.status } : {}),
        });

        hasUsableToolOrOutputItem = true;
      }

      if (itemType === "function_call_output") {
        const callId = typeof outputItem.call_id === "string" ? outputItem.call_id.trim() : "";
        const output =
          typeof outputItem.output === "string" ? outputItem.output : stableJson(outputItem.output ?? null);
        if (callId.length > 0 && output.length > 0) {
          hasUsableToolOrOutputItem = true;
        }
      }

      if (Array.isArray(outputItem.content)) {
        for (const contentItem of outputItem.content) {
          if (!isObjectRecord(contentItem)) {
            continue;
          }

          if (contentItem.type === "output_text" && typeof contentItem.text === "string") {
            if (!hasTopLevelOutputText) {
              textChunks.push(contentItem.text);
            }
            hasUsableToolOrOutputItem = true;
          }
        }
      }
    }
  }

  return {
    ok: true,
    assistantText: textChunks.length > 0 ? textChunks.join("\n").trim() : null,
    toolCalls,
    replayableFunctionCalls,
    usage,
    hasUsableToolOrOutputItem,
  };
}

function createBaseResult(task: StatefulToolTask, maxToolCallRounds: number): Omit<
  OpenAiStatefulToolsRunResult,
  | "status"
  | "terminationReason"
  | "simulatorFinalState"
  | "simulatorTrace"
  | "verifierResult"
  | "totalLatencyMs"
> {
  return {
    baselineConfig: {
      provider: OPENAI_STATEFUL_TOOLS_BASELINE_CONFIG.provider,
      model: OPENAI_STATEFUL_TOOLS_BASELINE_CONFIG.model,
      temperature: OPENAI_STATEFUL_TOOLS_BASELINE_CONFIG.temperature,
      maxToolCallRounds,
    },
    task: {
      taskId: task.taskId,
      seed: task.seed,
    },
    systemPrompt: SYSTEM_PROMPT,
    taskInstruction: toTaskInstruction(task),
    modelTurns: [],
    dispatchedToolCalls: [],
    finalModelText: null,
    requestCount: 0,
    toolCallRounds: 0,
    requestLatenciesMs: [],
    usage: {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
    },
    error: null,
  };
}

export async function runOpenAiStatefulToolTask(
  task: StatefulToolTask,
  options: RunOpenAiStatefulToolTaskOptions = {},
): Promise<OpenAiStatefulToolsRunResult> {
  const startedAtMs = Date.now();
  const maxToolCallRounds = options.maxToolCallRounds ?? OPENAI_STATEFUL_TOOLS_BASELINE_CONFIG.maxToolCallRounds;
  const simulator = createStatefulToolSimulator(task.initialInventory);
  const baseResult = createBaseResult(task, maxToolCallRounds);

  function getExecutionVerification(): {
    simulatorFinalState: ReturnType<typeof simulator.getStateSnapshot>;
    simulatorTrace: ReturnType<typeof simulator.getTrace>;
    verifierResult: VerificationResult;
  } {
    const simulatorFinalState = simulator.getStateSnapshot();
    const simulatorTrace = simulator.getTrace();
    const verifierResult = verifyStatefulToolTaskExecution(
      task,
      simulatorFinalState,
      simulatorTrace,
      baseResult.finalModelText,
    );
    return {
      simulatorFinalState,
      simulatorTrace,
      verifierResult,
    };
  }

  const inputItems: OpenAiResponsesInputItem[] = [
    { role: "user", content: baseResult.taskInstruction },
  ];

  const defaultApiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const resolvedApiKey = options.apiKey === undefined ? defaultApiKey : options.apiKey?.trim() ?? "";
  const transport = options.transport ?? (resolvedApiKey.length > 0 ? createOpenAiResponsesFetchTransport(resolvedApiKey) : null);

  if (!transport) {
    const { simulatorFinalState, simulatorTrace, verifierResult } = getExecutionVerification();

    return {
      ...baseResult,
      status: "configuration_error",
      simulatorFinalState,
      simulatorTrace,
      verifierResult,
      terminationReason: "missing_openai_api_key",
      totalLatencyMs: Date.now() - startedAtMs,
      error: {
        name: "ConfigurationError",
        message: "OPENAI_API_KEY is missing.",
      },
    };
  }

  while (true) {
    baseResult.requestCount += 1;
    const requestIndex = baseResult.requestCount;
    const requestPayload: OpenAiResponsesRequestBody = {
      model: baseResult.baselineConfig.model,
      instructions: baseResult.systemPrompt,
      temperature: baseResult.baselineConfig.temperature,
      input: [...inputItems],
      tools: TOOL_SCHEMAS,
      tool_choice: "auto",
      store: false,
    };

    let rawResponsePayload: unknown;
    const requestStartedAtMs = Date.now();

    try {
      rawResponsePayload = await transport(requestPayload);
    } catch (error: unknown) {
      const { simulatorFinalState, simulatorTrace, verifierResult } = getExecutionVerification();

      return {
        ...baseResult,
        status: "provider_error",
        simulatorFinalState,
        simulatorTrace,
        verifierResult,
        terminationReason: "provider_exception",
        totalLatencyMs: Date.now() - startedAtMs,
        error: toSafeError(error),
      };
    }

    const requestLatencyMs = Date.now() - requestStartedAtMs;
    baseResult.requestLatenciesMs.push(requestLatencyMs);

    const parsedResponse = parseResponsesApiPayload(rawResponsePayload);
    const usage = toUsage(parsedResponse.usage);
    baseResult.usage = addUsage(baseResult.usage, usage);

    const responseToolCalls = parsedResponse.toolCalls.map((toolCall) => ({ ...toolCall }));
    baseResult.modelTurns.push({
      requestIndex,
      requestInputItemCount: requestPayload.input.length,
      responseAssistantText: parsedResponse.assistantText,
      responseToolCalls,
      responseFunctionCallIds: responseToolCalls.map((call) => call.toolCallId),
      replayedFunctionCallCount: parsedResponse.replayableFunctionCalls.length,
      usage,
      latencyMs: requestLatencyMs,
    });

    if (!parsedResponse.ok) {
      const { simulatorFinalState, simulatorTrace, verifierResult } = getExecutionVerification();
      return {
        ...baseResult,
        status: "malformed_model_output",
        simulatorFinalState,
        simulatorTrace,
        verifierResult,
        terminationReason: parsedResponse.terminationReason,
        totalLatencyMs: Date.now() - startedAtMs,
        error: {
          name: "MalformedModelOutput",
          message: parsedResponse.message,
        },
      };
    }

    if (responseToolCalls.length === 0) {
      if (
        (!parsedResponse.assistantText || parsedResponse.assistantText.length === 0) &&
        !parsedResponse.hasUsableToolOrOutputItem
      ) {
        const { simulatorFinalState, simulatorTrace, verifierResult } = getExecutionVerification();
        return {
          ...baseResult,
          status: "malformed_model_output",
          simulatorFinalState,
          simulatorTrace,
          verifierResult,
          terminationReason: "missing_text_and_tool_calls",
          totalLatencyMs: Date.now() - startedAtMs,
          error: {
            name: "MalformedModelOutput",
            message: "Model emitted no usable assistant text or tool call items.",
          },
        };
      }

      if (parsedResponse.assistantText && parsedResponse.assistantText.length > 0) {
        baseResult.finalModelText = parsedResponse.assistantText;
      }

      const { simulatorFinalState, simulatorTrace, verifierResult } = getExecutionVerification();
      return {
        ...baseResult,
        status: "completed",
        simulatorFinalState,
        simulatorTrace,
        verifierResult,
        terminationReason: "model_final_response_without_tool_call",
        totalLatencyMs: Date.now() - startedAtMs,
      };
    }

    if (baseResult.toolCallRounds >= maxToolCallRounds) {
      const { simulatorFinalState, simulatorTrace, verifierResult } = getExecutionVerification();

      return {
        ...baseResult,
        status: "max_tool_call_rounds",
        simulatorFinalState,
        simulatorTrace,
        verifierResult,
        terminationReason: "tool_call_round_limit_reached_before_dispatch",
        totalLatencyMs: Date.now() - startedAtMs,
      };
    }

    baseResult.toolCallRounds += 1;
    inputItems.push(...parsedResponse.replayableFunctionCalls);

    for (let sequence = 0; sequence < responseToolCalls.length; sequence += 1) {
      const toolCall = responseToolCalls[sequence];
      const parsedArgs = parseToolArgs(toolCall.argumentsJson);

      if (!toolCall.name || parsedArgs.ok === false) {
        const { simulatorFinalState, simulatorTrace, verifierResult } = getExecutionVerification();
        return {
          ...baseResult,
          status: "malformed_model_output",
          simulatorFinalState,
          simulatorTrace,
          verifierResult,
          terminationReason:
            parsedArgs.ok === false ? parsedArgs.reason : "unsupported_tool_call_structure",
          totalLatencyMs: Date.now() - startedAtMs,
          error: {
            name: "MalformedModelOutput",
            message: "Model emitted unsupported or malformed tool call payload.",
          },
        };
      }

      let resultContent = "";
      if (toolCall.name === "get_inventory") {
        if (
          !hasExactKeys(parsedArgs.value, ["sku"]) ||
          typeof parsedArgs.value.sku !== "string" ||
          parsedArgs.value.sku.length === 0
        ) {
          const { simulatorFinalState, simulatorTrace, verifierResult } = getExecutionVerification();
          return {
            ...baseResult,
            status: "malformed_model_output",
            simulatorFinalState,
            simulatorTrace,
            verifierResult,
            terminationReason: "invalid_tool_arguments_shape",
            totalLatencyMs: Date.now() - startedAtMs,
            error: {
              name: "MalformedModelOutput",
              message: "Invalid get_inventory arguments.",
            },
          };
        }

        const toolResult = simulator.getInventory({
          sku: parsedArgs.value.sku,
        });
        resultContent = stableJson(toolResult);
      } else if (toolCall.name === "reserve_item") {
        if (
          !hasExactKeys(parsedArgs.value, ["reservationId", "sku", "quantity"]) ||
          typeof parsedArgs.value.reservationId !== "string" ||
          parsedArgs.value.reservationId.length === 0 ||
          typeof parsedArgs.value.sku !== "string" ||
          parsedArgs.value.sku.length === 0 ||
          typeof parsedArgs.value.quantity !== "number"
        ) {
          const { simulatorFinalState, simulatorTrace, verifierResult } = getExecutionVerification();
          return {
            ...baseResult,
            status: "malformed_model_output",
            simulatorFinalState,
            simulatorTrace,
            verifierResult,
            terminationReason: "invalid_tool_arguments_shape",
            totalLatencyMs: Date.now() - startedAtMs,
            error: {
              name: "MalformedModelOutput",
              message: "Invalid reserve_item arguments.",
            },
          };
        }

        const toolResult = simulator.reserveItem({
          reservationId: parsedArgs.value.reservationId,
          sku: parsedArgs.value.sku,
          quantity: parsedArgs.value.quantity,
        });
        resultContent = stableJson(toolResult);
      } else if (toolCall.name === "cancel_reservation") {
        if (
          !hasExactKeys(parsedArgs.value, ["reservationId"]) ||
          typeof parsedArgs.value.reservationId !== "string" ||
          parsedArgs.value.reservationId.length === 0
        ) {
          const { simulatorFinalState, simulatorTrace, verifierResult } = getExecutionVerification();
          return {
            ...baseResult,
            status: "malformed_model_output",
            simulatorFinalState,
            simulatorTrace,
            verifierResult,
            terminationReason: "invalid_tool_arguments_shape",
            totalLatencyMs: Date.now() - startedAtMs,
            error: {
              name: "MalformedModelOutput",
              message: "Invalid cancel_reservation arguments.",
            },
          };
        }

        const toolResult = simulator.cancelReservation({
          reservationId: parsedArgs.value.reservationId,
        });
        resultContent = stableJson(toolResult);
      } else {
        const { simulatorFinalState, simulatorTrace, verifierResult } = getExecutionVerification();
        return {
          ...baseResult,
          status: "malformed_model_output",
          simulatorFinalState,
          simulatorTrace,
          verifierResult,
          terminationReason: "unknown_tool_name",
          totalLatencyMs: Date.now() - startedAtMs,
          error: {
            name: "MalformedModelOutput",
            message: `Unknown tool name from model: ${toolCall.name}`,
          },
        };
      }

      baseResult.dispatchedToolCalls.push({
        requestIndex,
        sequenceInResponse: sequence + 1,
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.name,
        argumentsJson: toolCall.argumentsJson,
        resultContent,
      });

      inputItems.push({
        type: "function_call_output",
        call_id: toolCall.toolCallId,
        output: resultContent,
      });
    }
  }
}

