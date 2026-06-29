import { getBenchmarkById } from "@/core/registry/getBenchmarkById";
import { getBenchmarkDetailState } from "@/core/registry/getBenchmarkDetailState";
import { getRuntimeBenchmarkJsonFromCache } from "@/core/registry/getRuntimeBenchmarkJsonFromCache";
import { OPENAI_PROVIDER_ID } from "@/core/providers/openaiProvider";
import { executeProviderBenchmarkCase } from "@/core/runner/executeProviderBenchmarkCase";
import { scoreRuntimeBenchmarkCase } from "@/core/runner/scoreRuntimeBenchmarkCase";
import { appendModelRunHistory, readRecentModelRunsForBenchmark } from "@/core/storage/modelRunHistory";
import { appendManualRunHistory, readRecentManualRunsForBenchmark } from "@/core/storage/manualRunHistory";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const DEFAULT_OPENAI_MODEL_ID = "gpt-4o-mini" as const;

interface BenchmarkRunPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    caseId?: string | string[];
    modelId?: string | string[];
    answerText?: string | string[];
    submitStatus?: string | string[];
    resultCorrect?: string | string[];
    resultScore?: string | string[];
    resultExpectedAnswer?: string | string[];
    resultMessage?: string | string[];
    historyWarning?: string | string[];
    providerSubmitStatus?: string | string[];
    providerError?: string | string[];
    providerOutputText?: string | string[];
    providerResultCorrect?: string | string[];
    providerResultScore?: string | string[];
    providerResultExpectedAnswer?: string | string[];
    providerDurationMs?: string | string[];
    modelHistoryWarning?: string | string[];
  };
}

function toSingleSearchParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function toFormStringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export default function BenchmarkRunPage({ params, searchParams }: BenchmarkRunPageProps) {
  async function submitAnswerAction(formData: FormData): Promise<void> {
    "use server";

    const benchmarkId = toFormStringValue(formData.get("benchmarkId"));
    const caseId = toFormStringValue(formData.get("caseId"));
    const answerText = toFormStringValue(formData.get("answerText"));

    const runtimeState = getRuntimeBenchmarkJsonFromCache(benchmarkId);

    const responseParams = new URLSearchParams();
    if (caseId.trim().length > 0) {
      responseParams.set("caseId", caseId);
    }

    if (!runtimeState.valid || !runtimeState.artifact) {
      responseParams.set("submitStatus", "error");
      responseParams.set("resultCorrect", "false");
      responseParams.set("resultScore", "0");
      responseParams.set("resultExpectedAnswer", "");
      responseParams.set("resultMessage", "Runtime benchmark JSON is missing or invalid.");
      responseParams.set("answerText", answerText);
      redirect(`/benchmarks/${benchmarkId}/run?${responseParams.toString()}`);
    }

    const result = scoreRuntimeBenchmarkCase(runtimeState.artifact, caseId, answerText);
    const benchmarkCase = runtimeState.artifact.cases.find((item) => item.id === caseId);

    const historyAppendResult = appendManualRunHistory({
      timestamp: new Date().toISOString(),
      benchmarkId,
      benchmarkName: runtimeState.artifact.benchmarkName,
      caseId,
      caseTitle: benchmarkCase?.title ?? "",
      submittedAnswer: answerText,
      expectedAnswer: result.expectedAnswer,
      correct: result.correct,
      score: result.score,
      scoringMode: runtimeState.artifact.scoringMode,
    });

    responseParams.set("submitStatus", "scored");
    responseParams.set("resultCorrect", String(result.correct));
    responseParams.set("resultScore", String(result.score));
    responseParams.set("resultExpectedAnswer", result.expectedAnswer);
    responseParams.set("resultMessage", result.message);
    responseParams.set("answerText", answerText);

    if (historyAppendResult.warning) {
      responseParams.set("historyWarning", historyAppendResult.warning);
    }

    redirect(`/benchmarks/${benchmarkId}/run?${responseParams.toString()}`);
  }

  async function runWithOpenAiAction(formData: FormData): Promise<void> {
    "use server";

    const benchmarkId = toFormStringValue(formData.get("benchmarkId"));
    const caseId = toFormStringValue(formData.get("caseId"));
    const modelIdInput = toFormStringValue(formData.get("modelId")).trim();
    const modelId = modelIdInput.length > 0 ? modelIdInput : DEFAULT_OPENAI_MODEL_ID;

    const responseParams = new URLSearchParams();
    responseParams.set("modelId", modelId);

    if (caseId.trim().length > 0) {
      responseParams.set("caseId", caseId);
    }

    const runtimeState = getRuntimeBenchmarkJsonFromCache(benchmarkId);
    if (!runtimeState.valid || !runtimeState.artifact) {
      responseParams.set("providerSubmitStatus", "error");
      responseParams.set("providerError", "Runtime benchmark JSON is missing or invalid.");
      redirect(`/benchmarks/${benchmarkId}/run?${responseParams.toString()}`);
    }

    const benchmarkCase = runtimeState.artifact.cases.find((item) => item.id === caseId);
    if (!benchmarkCase) {
      responseParams.set("providerSubmitStatus", "error");
      responseParams.set("providerError", "Select a benchmark case before running with OpenAI.");
      redirect(`/benchmarks/${benchmarkId}/run?${responseParams.toString()}`);
    }

    const providerResult = await executeProviderBenchmarkCase({
      artifact: runtimeState.artifact,
      request: {
        benchmarkId,
        caseId,
        prompt: benchmarkCase.prompt,
        providerId: OPENAI_PROVIDER_ID,
        modelId,
      },
    });

    if (!providerResult.ok) {
      responseParams.set("providerSubmitStatus", "error");
      responseParams.set("providerError", providerResult.errorMessage);

      if (providerResult.metadata) {
        responseParams.set("providerDurationMs", String(providerResult.metadata.durationMs));
      }

      redirect(`/benchmarks/${benchmarkId}/run?${responseParams.toString()}`);
    }

    responseParams.set("providerSubmitStatus", "scored");
    responseParams.set("providerOutputText", providerResult.scoredResult.outputText);
    responseParams.set("providerResultCorrect", String(providerResult.scoredResult.correct));
    responseParams.set("providerResultScore", String(providerResult.scoredResult.score));
    responseParams.set("providerResultExpectedAnswer", providerResult.scoredResult.expectedAnswer);
    responseParams.set("providerDurationMs", String(providerResult.scoredResult.metadata.durationMs));

    const historyAppendResult = appendModelRunHistory({
      timestamp: providerResult.scoredResult.metadata.timestamp,
      benchmarkId,
      benchmarkName: providerResult.benchmarkName,
      caseId,
      caseTitle: providerResult.caseTitle,
      providerId: providerResult.scoredResult.metadata.providerId,
      modelId: providerResult.scoredResult.metadata.modelId,
      prompt: providerResult.scoredResult.prompt,
      outputText: providerResult.scoredResult.outputText,
      expectedAnswer: providerResult.scoredResult.expectedAnswer,
      correct: providerResult.scoredResult.correct,
      score: providerResult.scoredResult.score,
      durationMs: providerResult.scoredResult.metadata.durationMs,
    });

    if (historyAppendResult.warning) {
      responseParams.set("modelHistoryWarning", historyAppendResult.warning);
    }

    redirect(`/benchmarks/${benchmarkId}/run?${responseParams.toString()}`);
  }

  const benchmark = getBenchmarkById(params.id);
  if (!benchmark) {
    notFound();
  }

  const detailState = getBenchmarkDetailState(params.id);
  const runtimeState = getRuntimeBenchmarkJsonFromCache(params.id);

  const selectedCaseId = toSingleSearchParam(searchParams?.caseId);
  const selectedModelId = toSingleSearchParam(searchParams?.modelId) || DEFAULT_OPENAI_MODEL_ID;
  const previousAnswer = toSingleSearchParam(searchParams?.answerText);

  const selectedCase = runtimeState.artifact?.cases.find((item) => item.id === selectedCaseId) ?? null;
  const runtimeCases = runtimeState.artifact?.cases ?? [];

  const submitStatus = toSingleSearchParam(searchParams?.submitStatus);
  const resultCorrectParam = toSingleSearchParam(searchParams?.resultCorrect);
  const resultScoreParam = toSingleSearchParam(searchParams?.resultScore);
  const resultExpectedAnswer = toSingleSearchParam(searchParams?.resultExpectedAnswer);
  const resultMessage = toSingleSearchParam(searchParams?.resultMessage);
  const historyWarningFromSubmit = toSingleSearchParam(searchParams?.historyWarning);
  const providerSubmitStatus = toSingleSearchParam(searchParams?.providerSubmitStatus);
  const providerError = toSingleSearchParam(searchParams?.providerError);
  const providerOutputText = toSingleSearchParam(searchParams?.providerOutputText);
  const providerResultCorrectParam = toSingleSearchParam(searchParams?.providerResultCorrect);
  const providerResultScore = toSingleSearchParam(searchParams?.providerResultScore);
  const providerResultExpectedAnswer = toSingleSearchParam(searchParams?.providerResultExpectedAnswer);
  const providerDurationMs = toSingleSearchParam(searchParams?.providerDurationMs);
  const modelHistoryWarningFromSubmit = toSingleSearchParam(searchParams?.modelHistoryWarning);

  const recentRunsState = readRecentManualRunsForBenchmark(benchmark.id, 5);
  const recentModelRunsState = readRecentModelRunsForBenchmark(benchmark.id, 5);
  const historyWarning = historyWarningFromSubmit || recentRunsState.warning || "";
  const modelHistoryWarning = modelHistoryWarningFromSubmit || recentModelRunsState.warning || "";

  const hasScoreResult = submitStatus.length > 0;
  const resultCorrect = resultCorrectParam === "true";
  const hasProviderScoreResult = providerSubmitStatus === "scored";
  const providerResultCorrect = providerResultCorrectParam === "true";

  return (
    <main className="container">
      <p>
        <Link href={`/benchmarks/${benchmark.id}`}>← Back to benchmark detail</Link>
      </p>

      <h1>Manual Benchmark Run (v1)</h1>
      <p className="subtle">Manual-only flow using cached runtime-benchmark.json with exact-text scoring.</p>

      <h2>Benchmark</h2>
      <dl className="benchmark-detail-list">
        <div>
          <dt>Name</dt>
          <dd>{benchmark.name}</dd>
        </div>
        <div>
          <dt>ID</dt>
          <dd>
            <code>{benchmark.id}</code>
          </dd>
        </div>
        <div>
          <dt>Readiness</dt>
          <dd>{detailState?.ready ? "ready" : "not ready"}</dd>
        </div>
        <div>
          <dt>Runtime JSON Path</dt>
          <dd>
            <code>{runtimeState.runtimeJsonPath}</code>
          </dd>
        </div>
        <div>
          <dt>Runtime JSON Found</dt>
          <dd>{runtimeState.found ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt>Runtime JSON Valid</dt>
          <dd>{runtimeState.valid ? "yes" : "no"}</dd>
        </div>
      </dl>

      {runtimeState.validationErrors.length > 0 ? (
        <section>
          <h2>Runtime JSON Issues</h2>
          <ul>
            {runtimeState.validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {!runtimeState.valid || !runtimeState.artifact ? (
        <p className="subtle">
          Manual run is unavailable because runtime benchmark JSON is missing or invalid. Sync/fix benchmark cache and retry.
        </p>
      ) : (
        <>
          {historyWarning.length > 0 ? (
            <p className="history-warning" role="status">
              {historyWarning}
            </p>
          ) : null}

          {modelHistoryWarning.length > 0 ? (
            <p className="history-warning" role="status">
              {modelHistoryWarning}
            </p>
          ) : null}

          <section>
            <h2>Available Cases</h2>
            {runtimeCases.length === 0 ? (
              <p>No runtime cases were found in runtime-benchmark.json.</p>
            ) : (
              <ul className="runtime-case-list">
                {runtimeCases.map((item) => (
                  <li key={item.id} className="runtime-case-card">
                    <div>
                      <strong>{item.title}</strong> <span className="subtle">({item.id})</span>
                    </div>
                    <div className="runtime-case-meta">
                      <code>level: {item.levelId}</code>
                    </div>
                    <p className="runtime-case-actions">
                      <Link href={`/benchmarks/${benchmark.id}/run?caseId=${encodeURIComponent(item.id)}`}>Select case</Link>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selectedCase ? (
            <section>
              <h2>Selected Case</h2>
              <dl className="benchmark-detail-list">
                <div>
                  <dt>Case ID</dt>
                  <dd>
                    <code>{selectedCase.id}</code>
                  </dd>
                </div>
                <div>
                  <dt>Level</dt>
                  <dd>
                    <code>{selectedCase.levelId}</code>
                  </dd>
                </div>
                <div>
                  <dt>Title</dt>
                  <dd>{selectedCase.title}</dd>
                </div>
                <div>
                  <dt>Prompt</dt>
                  <dd>
                    <pre className="contract-code-block">{selectedCase.prompt}</pre>
                  </dd>
                </div>
              </dl>

              <h2>Run with OpenAI</h2>
              <form action={runWithOpenAiAction} className="runtime-answer-form">
                <input type="hidden" name="benchmarkId" value={benchmark.id} />
                <input type="hidden" name="caseId" value={selectedCase.id} />

                <label htmlFor="modelId">Model ID</label>
                <input id="modelId" name="modelId" type="text" defaultValue={selectedModelId} />

                <button type="submit">Run with OpenAI</button>
              </form>

              <h2>Submit Answer</h2>
              <form action={submitAnswerAction} className="runtime-answer-form">
                <input type="hidden" name="benchmarkId" value={benchmark.id} />
                <input type="hidden" name="caseId" value={selectedCase.id} />

                <label htmlFor="answerText">Answer text</label>
                <textarea id="answerText" name="answerText" rows={4} defaultValue={previousAnswer} required />

                <button type="submit">Score answer</button>
              </form>
            </section>
          ) : runtimeCases.length > 0 ? (
            <p className="subtle">Select a case to view prompt and submit an answer.</p>
          ) : null}

          {providerSubmitStatus === "error" ? (
            <section>
              <h2>Provider Result</h2>
              <p className="history-warning" role="status">
                {providerError || "Provider execution failed."}
              </p>
              {providerDurationMs.length > 0 ? <p className="subtle">Duration: {providerDurationMs}ms</p> : null}
            </section>
          ) : null}

          {hasProviderScoreResult ? (
            <section>
              <h2>Provider Result</h2>
              <dl className="benchmark-detail-list">
                <div>
                  <dt>provider</dt>
                  <dd>{OPENAI_PROVIDER_ID}</dd>
                </div>
                <div>
                  <dt>modelId</dt>
                  <dd>
                    <code>{selectedModelId}</code>
                  </dd>
                </div>
                <div>
                  <dt>outputText</dt>
                  <dd>
                    <pre className="contract-code-block">{providerOutputText || "(empty)"}</pre>
                  </dd>
                </div>
                <div>
                  <dt>correct</dt>
                  <dd>{providerResultCorrect ? "true" : "false"}</dd>
                </div>
                <div>
                  <dt>score</dt>
                  <dd>{providerResultScore || "0"}</dd>
                </div>
                <div>
                  <dt>expectedAnswer</dt>
                  <dd>
                    <code>{providerResultExpectedAnswer}</code>
                  </dd>
                </div>
                <div>
                  <dt>durationMs</dt>
                  <dd>{providerDurationMs || "0"}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          {hasScoreResult ? (
            <section>
              <h2>Result</h2>
              <dl className="benchmark-detail-list">
                <div>
                  <dt>correct</dt>
                  <dd>{resultCorrect ? "true" : "false"}</dd>
                </div>
                <div>
                  <dt>score</dt>
                  <dd>{resultScoreParam || "0"}</dd>
                </div>
                <div>
                  <dt>expectedAnswer</dt>
                  <dd>
                    <code>{resultExpectedAnswer}</code>
                  </dd>
                </div>
                <div>
                  <dt>message</dt>
                  <dd>{resultMessage || "No message."}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          <section>
            <h2>Recent Runs (this benchmark)</h2>
            {recentRunsState.entries.length === 0 ? (
              <p className="subtle">No recent manual runs found for this benchmark yet.</p>
            ) : (
              <ul className="run-history-list">
                {recentRunsState.entries.map((entry, index) => (
                  <li
                    key={`${entry.timestamp}-${entry.benchmarkId}-${entry.caseId}-${index}`}
                    className="run-history-card"
                  >
                    <dl>
                      <div>
                        <dt>Timestamp</dt>
                        <dd>{entry.timestamp}</dd>
                      </div>
                      <div>
                        <dt>Case</dt>
                        <dd>
                          {entry.caseTitle || "(untitled case)"} <span className="subtle">({entry.caseId})</span>
                        </dd>
                      </div>
                      <div>
                        <dt>Correct</dt>
                        <dd>{entry.correct ? "true" : "false"}</dd>
                      </div>
                      <div>
                        <dt>Score</dt>
                        <dd>{entry.score}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
            <p className="subtle">
              <Link href="/runs">View global run history</Link>
            </p>
          </section>

          <section>
            <h2>Recent Model Runs (this benchmark)</h2>
            {recentModelRunsState.entries.length === 0 ? (
              <p className="subtle">No recent model runs found for this benchmark yet.</p>
            ) : (
              <ul className="run-history-list">
                {recentModelRunsState.entries.map((entry, index) => (
                  <li
                    key={`${entry.timestamp}-${entry.benchmarkId}-${entry.caseId}-${entry.modelId}-${index}`}
                    className="run-history-card"
                  >
                    <dl>
                      <div>
                        <dt>Timestamp</dt>
                        <dd>{entry.timestamp}</dd>
                      </div>
                      <div>
                        <dt>Case</dt>
                        <dd>
                          {entry.caseTitle || "(untitled case)"} <span className="subtle">({entry.caseId})</span>
                        </dd>
                      </div>
                      <div>
                        <dt>Provider</dt>
                        <dd>
                          <code>{entry.providerId}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>Model</dt>
                        <dd>
                          <code>{entry.modelId}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>Correct</dt>
                        <dd>{entry.correct ? "true" : "false"}</dd>
                      </div>
                      <div>
                        <dt>Score</dt>
                        <dd>{entry.score}</dd>
                      </div>
                      <div>
                        <dt>Duration</dt>
                        <dd>{entry.durationMs}ms</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

