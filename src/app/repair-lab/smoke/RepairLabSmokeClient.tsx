"use client";

import { useFormState, useFormStatus } from "react-dom";
import { runRepairLabSmokeAction, type RepairLabSmokeActionState } from "./actions";

interface RepairLabSmokeClientProps {
  baseline: {
    provider: string;
    model: string;
    temperature: number;
    maxToolCallRounds: number;
  };
}

const INITIAL_STATE: RepairLabSmokeActionState = {
  selectedSeed: 0,
  status: "idle",
  message: "",
  runResult: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <>
      <button type="submit" disabled={pending} aria-disabled={pending}>
        {pending ? "Running live baseline..." : "Run selected seeded task"}
      </button>
      {pending ? (
        <p className="subtle" role="status" aria-live="polite" style={{ marginTop: "0.5rem" }}>
          Running live baseline...
        </p>
      ) : null}
    </>
  );
}

function formatMaybeNumber(value: number | null): string {
  return typeof value === "number" ? String(value) : "n/a";
}

export function RepairLabSmokeClient({ baseline }: RepairLabSmokeClientProps) {
  const [state, formAction] = useFormState(runRepairLabSmokeAction, INITIAL_STATE);
  const result = state.runResult;

  return (
    <>
      <section className="run-panel" aria-labelledby="repair-lab-smoke-config">
        <h2 id="repair-lab-smoke-config">Baseline and task selection</h2>

        <p className="history-warning" role="status" style={{ marginTop: 0 }}>
          This action sends one live request to OpenAI and may incur API charges. No results are persisted.
        </p>

        <dl className="benchmark-detail-list" style={{ marginTop: "0.75rem" }}>
          <div>
            <dt>Provider</dt>
            <dd>{baseline.provider}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>
              <code>{baseline.model}</code>
            </dd>
          </div>
          <div>
            <dt>Temperature</dt>
            <dd>{baseline.temperature}</dd>
          </div>
          <div>
            <dt>Maximum tool-call rounds</dt>
            <dd>{baseline.maxToolCallRounds}</dd>
          </div>
        </dl>

        <form action={formAction} className="runtime-answer-form" style={{ marginTop: "1rem" }}>
          <label htmlFor="seed">Deterministic seeded task</label>
          <select id="seed" name="seed" defaultValue="0" required>
            <option value="0">0 — successful reservation task</option>
            <option value="1">1 — reservation then cancellation task</option>
            <option value="2">2 — rollback-critical reservation/cancellation task</option>
            <option value="3">3 — rollback with final-state JSON report</option>
          </select>

          <SubmitButton />
        </form>

        {state.status === "validation_error" || state.status === "error" ? (
          <p className="history-warning" role="status">
            {state.message}
          </p>
        ) : null}
      </section>

      {result ? (
        <section className="run-panel" style={{ marginTop: "1rem" }} aria-labelledby="repair-lab-smoke-result">
          <h2 id="repair-lab-smoke-result">Run result (hard verifier is authoritative)</h2>

          {result.status === "configuration_error" ? (
            <p className="history-warning" role="alert">
              Configure OPENAI_API_KEY in the server environment, then restart the development server.
            </p>
          ) : null}

          <dl className="benchmark-detail-list" style={{ marginTop: "0.75rem" }}>
            <div>
              <dt>Task</dt>
              <dd>
                <code>{result.task.taskId}</code> (seed {result.task.seed})
              </dd>
            </div>
            <div>
              <dt>Runner status</dt>
              <dd>
                <code>{result.status}</code>
              </dd>
            </div>
            <div>
              <dt>Termination reason</dt>
              <dd>
                <code>{result.terminationReason}</code>
              </dd>
            </div>
            <div>
              <dt>Verifier (authoritative)</dt>
              <dd className={result.verifierResult.passed ? "result-correct" : "result-incorrect"}>
                {result.verifierResult.passed ? "pass" : "fail"}
              </dd>
            </div>
            <div>
              <dt>Verifier failure codes</dt>
              <dd>
                {result.verifierResult.failureCodes.length > 0 ? (
                  <code>{result.verifierResult.failureCodes.join(", ")}</code>
                ) : (
                  "none"
                )}
              </dd>
            </div>
            <div>
              <dt>Final model text</dt>
              <dd>
                <pre className="contract-code-block">{result.finalModelText ?? "(none)"}</pre>
              </dd>
            </div>
            <div>
              <dt>Request count</dt>
              <dd>{result.requestCount}</dd>
            </div>
            <div>
              <dt>Tool-call rounds</dt>
              <dd>{result.toolCallRounds}</dd>
            </div>
            <div>
              <dt>Total latency</dt>
              <dd>{result.totalLatencyMs} ms</dd>
            </div>
            <div>
              <dt>Token usage</dt>
              <dd>
                input {formatMaybeNumber(result.usage.inputTokens)} / output {formatMaybeNumber(result.usage.outputTokens)} /
                total {formatMaybeNumber(result.usage.totalTokens)}
              </dd>
            </div>
          </dl>

          {result.error ? (
            <div className="run-result-block">
              <h3>Runner error evidence</h3>
              <pre className="contract-code-block">{JSON.stringify(result.error, null, 2)}</pre>
            </div>
          ) : null}

          <div className="run-result-block">
            <h3>Dispatched tool calls (in order)</h3>
            {result.dispatchedToolCalls.length === 0 ? (
              <p className="subtle">No dispatched tool calls.</p>
            ) : (
              <ol>
                {result.dispatchedToolCalls.map((call, index) => (
                  <li key={`${call.requestIndex}-${call.toolCallId}-${index}`}>
                    <pre className="contract-code-block">{JSON.stringify(call, null, 2)}</pre>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="run-result-block">
            <h3>Simulator trace (in order)</h3>
            {result.simulatorTrace.length === 0 ? (
              <p className="subtle">No simulator trace events.</p>
            ) : (
              <ol>
                {result.simulatorTrace.map((entry) => (
                  <li key={entry.traceStep}>
                    <pre className="contract-code-block">{JSON.stringify(entry, null, 2)}</pre>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="run-result-block">
            <h3>Model-turn summary</h3>
            {result.modelTurns.length === 0 ? (
              <p className="subtle">No model turns recorded.</p>
            ) : (
              <ol>
                {result.modelTurns.map((turn) => (
                  <li key={turn.requestIndex}>
                    <pre
                      className="contract-code-block"
                    >{`request #${turn.requestIndex}: inputItems=${turn.requestInputItemCount}, toolCalls=${turn.responseToolCalls.length}, replayedFunctionCalls=${turn.replayedFunctionCallCount}, latencyMs=${turn.latencyMs}, assistantText=${turn.responseAssistantText ?? "(none)"}`}</pre>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <details className="run-result-block">
            <summary>Full structured runner result JSON</summary>
            <pre className="contract-code-block">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </section>
      ) : null}
    </>
  );
}

