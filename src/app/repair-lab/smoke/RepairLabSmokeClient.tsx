"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  runRepairLabSmokeAction,
  runRollbackReportStalenessV1DiscoveryBaselineAction,
  type RepairLabSmokeActionState,
  type RollbackReportStalenessV1DiscoveryActionResult,
} from "./actions";

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

const ROLLBACK_REPORT_STALENESS_V1_DISCOVERY_SUITE_ID = "rollback-report-staleness-v1" as const;
const ROLLBACK_REPORT_STALENESS_V1_DISCOVERY_CASES = 7;
const ROLLBACK_REPORT_STALENESS_V1_DISCOVERY_REPETITIONS = 3;
const ROLLBACK_REPORT_STALENESS_V1_DISCOVERY_TOTAL_EXECUTIONS =
  ROLLBACK_REPORT_STALENESS_V1_DISCOVERY_CASES * ROLLBACK_REPORT_STALENESS_V1_DISCOVERY_REPETITIONS;

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

function formatFailureCodes(codes: readonly string[]): string {
  return codes.length > 0 ? codes.join(", ") : "none";
}

export function RepairLabSmokeClient({ baseline }: RepairLabSmokeClientProps) {
  const [state, formAction] = useFormState(runRepairLabSmokeAction, INITIAL_STATE);
  const result = state.runResult;
  const [isDiscoveryPending, setIsDiscoveryPending] = useState(false);
  const isDiscoveryInFlightRef = useRef(false);
  const [discoveryActionResult, setDiscoveryActionResult] = useState<RollbackReportStalenessV1DiscoveryActionResult | null>(
    null,
  );

  async function handleRunDiscoveryBaseline(): Promise<void> {
    if (isDiscoveryInFlightRef.current) {
      return;
    }

    const confirmed = window.confirm(
      "This will launch 21 sequential task executions and each execution may make multiple OpenAI API requests. Continue?",
    );
    if (!confirmed) {
      return;
    }

    isDiscoveryInFlightRef.current = true;
    setIsDiscoveryPending(true);
    setDiscoveryActionResult(null);

    try {
      const nextResult = await runRollbackReportStalenessV1DiscoveryBaselineAction();
      setDiscoveryActionResult(nextResult);
    } catch {
      setDiscoveryActionResult({
        status: "error",
        message:
          "Unable to complete the discovery baseline request. The connection or server action failed. Check the development server and retry.",
      });
    } finally {
      isDiscoveryInFlightRef.current = false;
      setIsDiscoveryPending(false);
    }
  }

  const discoveryEvaluation = discoveryActionResult?.status === "ok" ? discoveryActionResult.evaluation : null;

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

      <section className="run-panel" style={{ marginTop: "1rem" }} aria-labelledby="repair-lab-discovery-baseline">
        <h2 id="repair-lab-discovery-baseline">Rollback Report Staleness V1 — Discovery Baseline</h2>
        <p className="history-warning" role="status" style={{ marginTop: 0 }}>
          This batch is live and may incur API charges. Results are in-memory only and will be lost on refresh or navigation.
        </p>
        <dl className="benchmark-detail-list" style={{ marginTop: "0.75rem" }}>
          <div>
            <dt>Suite ID</dt>
            <dd>
              <code>{ROLLBACK_REPORT_STALENESS_V1_DISCOVERY_SUITE_ID}</code>
            </dd>
          </div>
          <div>
            <dt>Case coverage</dt>
            <dd>{ROLLBACK_REPORT_STALENESS_V1_DISCOVERY_CASES} discovery cases only</dd>
          </div>
          <div>
            <dt>Repetitions per case</dt>
            <dd>{ROLLBACK_REPORT_STALENESS_V1_DISCOVERY_REPETITIONS}</dd>
          </div>
          <div>
            <dt>Total task executions</dt>
            <dd>{ROLLBACK_REPORT_STALENESS_V1_DISCOVERY_TOTAL_EXECUTIONS} sequential task executions</dd>
          </div>
          <div>
            <dt>API activity</dt>
            <dd>Each task execution may make multiple OpenAI API requests.</dd>
          </div>
          <div>
            <dt>Excluded coverage</dt>
            <dd>Held-out and regression cases are not included.</dd>
          </div>
          <div>
            <dt>Persistence</dt>
            <dd>Results are not persisted and will be lost on refresh/navigation.</dd>
          </div>
        </dl>

        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            disabled={isDiscoveryPending}
            aria-disabled={isDiscoveryPending}
            onClick={() => {
              void handleRunDiscoveryBaseline();
            }}
          >
            {isDiscoveryPending
              ? "Running 21 discovery task executions..."
              : "Run 21 discovery task executions"}
          </button>
          {isDiscoveryPending ? (
            <p className="subtle" role="status" aria-live="polite" style={{ marginTop: "0.5rem" }}>
              Running 21 sequential task executions. Sequential execution may take time.
            </p>
          ) : null}
        </div>

        {discoveryActionResult?.status === "error" ? (
          <p className="history-warning" role="status" style={{ marginTop: "0.75rem" }}>
            {discoveryActionResult.message}
          </p>
        ) : null}

        {discoveryEvaluation ? (
          <div className="run-result-block" style={{ marginTop: "1rem" }}>
            <h3>Discovery baseline result</h3>
            <dl className="benchmark-detail-list" style={{ marginTop: "0.75rem" }}>
              <div>
                <dt>Suite ID</dt>
                <dd>
                  <code>{discoveryEvaluation.suiteId}</code>
                </dd>
              </div>
              <div>
                <dt>Configured repetitions</dt>
                <dd>{discoveryEvaluation.repetitions}</dd>
              </div>
              <div>
                <dt>Total execution count</dt>
                <dd>{discoveryEvaluation.summary.totalExecutions}</dd>
              </div>
              <div>
                <dt>Verifier pass count</dt>
                <dd>{discoveryEvaluation.summary.verifierPassCount}</dd>
              </div>
              <div>
                <dt>Verifier fail count</dt>
                <dd>{discoveryEvaluation.summary.verifierFailCount}</dd>
              </div>
              <div>
                <dt>Verifier failure-code counts</dt>
                <dd>
                  <pre className="contract-code-block">
                    {JSON.stringify(discoveryEvaluation.summary.verifierFailureCodeCounts, null, 2)}
                  </pre>
                </dd>
              </div>
            </dl>

            <h4 style={{ marginTop: "1rem" }}>Executions</h4>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Seed</th>
                    <th>Stratum</th>
                    <th>Repetition</th>
                    <th>Runner status</th>
                    <th>Termination reason</th>
                    <th>Verifier</th>
                    <th>Verifier failure codes</th>
                    <th>Request count</th>
                    <th>Tool-call rounds</th>
                    <th>Total latency (ms)</th>
                    <th>Input tokens</th>
                    <th>Output tokens</th>
                    <th>Total tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {discoveryEvaluation.executions.map((execution, index) => (
                    <tr key={`${execution.caseId}-${execution.repetition}-${index}`}>
                      <td>
                        <code>{execution.caseId}</code>
                      </td>
                      <td>{execution.seed}</td>
                      <td>
                        <code>{execution.stratum}</code>
                      </td>
                      <td>{execution.repetition}</td>
                      <td>
                        <code>{execution.runnerResult.status}</code>
                      </td>
                      <td>
                        <code>{execution.runnerResult.terminationReason}</code>
                      </td>
                      <td className={execution.runnerResult.verifierResult.passed ? "result-correct" : "result-incorrect"}>
                        {execution.runnerResult.verifierResult.passed ? "pass" : "fail"}
                      </td>
                      <td>
                        <code>{formatFailureCodes(execution.runnerResult.verifierResult.failureCodes)}</code>
                      </td>
                      <td>{execution.runnerResult.requestCount}</td>
                      <td>{execution.runnerResult.toolCallRounds}</td>
                      <td>{execution.runnerResult.totalLatencyMs}</td>
                      <td>{formatMaybeNumber(execution.runnerResult.usage.inputTokens)}</td>
                      <td>{formatMaybeNumber(execution.runnerResult.usage.outputTokens)}</td>
                      <td>{formatMaybeNumber(execution.runnerResult.usage.totalTokens)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="run-result-block" style={{ marginTop: "1rem" }}>
              <summary>Complete evaluation JSON</summary>
              <pre className="contract-code-block">{JSON.stringify(discoveryEvaluation, null, 2)}</pre>
            </details>
          </div>
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
