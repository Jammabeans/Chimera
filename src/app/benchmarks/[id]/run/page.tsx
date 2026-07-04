import { getBenchmarkById } from "@/core/registry/getBenchmarkById";
import { getBenchmarkDetailState } from "@/core/registry/getBenchmarkDetailState";
import { getRuntimeBenchmarkJsonFromCache } from "@/core/registry/getRuntimeBenchmarkJsonFromCache";
import { OLLAMA_PROVIDER_ID } from "@/core/providers/ollamaProvider";
import { OPENAI_PROVIDER_ID } from "@/core/providers/openaiProvider";
import { formatOpenAiModelPricing, OPENAI_MODEL_CATALOG } from "@/core/providers/openAiModelCatalog";
import { executeProviderBenchmarkCase } from "@/core/runner/executeProviderBenchmarkCase";
import { scoreRuntimeBenchmarkCase } from "@/core/runner/scoreRuntimeBenchmarkCase";
import { appendModelRunHistory, readRecentModelRunsForBenchmark } from "@/core/storage/modelRunHistory";
import { appendManualRunHistory, readRecentManualRunsForBenchmark } from "@/core/storage/manualRunHistory";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const DEFAULT_OPENAI_MODEL_ID = "gpt-4o-mini" as const;
const DEFAULT_OLLAMA_MODEL_ID = "llama3.1:8b" as const;
const CUSTOM_OPENAI_MODEL_OPTION = "__custom__" as const;
const MODEL_RUN_SECTION_ID = "model-run" as const;
const SUPPORTED_PROVIDER_IDS = [OPENAI_PROVIDER_ID, OLLAMA_PROVIDER_ID] as const;

type SupportedProviderId = (typeof SUPPORTED_PROVIDER_IDS)[number];

interface BenchmarkRunPageProps {
  params: {
    id: string;
  };
  searchParams?: {
    caseId?: string | string[];
    providerId?: string | string[];
    modelId?: string | string[];
    ollamaBaseUrl?: string | string[];
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

function toSupportedProviderId(value: string): SupportedProviderId {
  return SUPPORTED_PROVIDER_IDS.includes(value as SupportedProviderId)
    ? (value as SupportedProviderId)
    : OPENAI_PROVIDER_ID;
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
      redirect(`/benchmarks/${benchmarkId}/run?${responseParams.toString()}#${MODEL_RUN_SECTION_ID}`);
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

    redirect(`/benchmarks/${benchmarkId}/run?${responseParams.toString()}#${MODEL_RUN_SECTION_ID}`);
  }

  async function runWithProviderAction(formData: FormData): Promise<void> {
    "use server";

    const benchmarkId = toFormStringValue(formData.get("benchmarkId"));
    const caseId = toFormStringValue(formData.get("caseId"));
    const providerId = toSupportedProviderId(toFormStringValue(formData.get("providerId")).trim());
    const knownModelId = toFormStringValue(formData.get("knownModelId")).trim();
    const customModelId = toFormStringValue(formData.get("customModelId")).trim();
    const modelIdInput = toFormStringValue(formData.get("modelId")).trim();
    const ollamaBaseUrl = toFormStringValue(formData.get("ollamaBaseUrl")).trim();

    const modelId =
      providerId === OPENAI_PROVIDER_ID
        ? knownModelId === CUSTOM_OPENAI_MODEL_OPTION
          ? customModelId.length > 0
            ? customModelId
            : DEFAULT_OPENAI_MODEL_ID
          : knownModelId.length > 0
            ? knownModelId
            : DEFAULT_OPENAI_MODEL_ID
        : modelIdInput.length > 0
          ? modelIdInput
          : DEFAULT_OLLAMA_MODEL_ID;

    const responseParams = new URLSearchParams();
    responseParams.set("providerId", providerId);
    responseParams.set("modelId", modelId);
    if (providerId === OLLAMA_PROVIDER_ID && ollamaBaseUrl.length > 0) {
      responseParams.set("ollamaBaseUrl", ollamaBaseUrl);
    }

    if (caseId.trim().length > 0) {
      responseParams.set("caseId", caseId);
    }

    const runtimeState = getRuntimeBenchmarkJsonFromCache(benchmarkId);
    if (!runtimeState.valid || !runtimeState.artifact) {
      responseParams.set("providerSubmitStatus", "error");
      responseParams.set("providerError", "Runtime benchmark JSON is missing or invalid.");
      redirect(`/benchmarks/${benchmarkId}/run?${responseParams.toString()}#${MODEL_RUN_SECTION_ID}`);
    }

    const benchmarkCase = runtimeState.artifact.cases.find((item) => item.id === caseId);
    if (!benchmarkCase) {
      responseParams.set("providerSubmitStatus", "error");
      responseParams.set("providerError", "Select a benchmark case before running a model provider.");
      redirect(`/benchmarks/${benchmarkId}/run?${responseParams.toString()}#${MODEL_RUN_SECTION_ID}`);
    }

    const providerResult = await executeProviderBenchmarkCase({
      artifact: runtimeState.artifact,
      request: {
        benchmarkId,
        caseId,
        prompt: benchmarkCase.prompt,
        providerId,
        modelId,
      },
      ollamaBaseUrl: providerId === OLLAMA_PROVIDER_ID ? ollamaBaseUrl : undefined,
    });

    if (!providerResult.ok) {
      responseParams.set("providerSubmitStatus", "error");
      responseParams.set("providerError", providerResult.errorMessage);

      if (providerResult.metadata) {
        responseParams.set("providerDurationMs", String(providerResult.metadata.durationMs));
      }

      redirect(`/benchmarks/${benchmarkId}/run?${responseParams.toString()}#${MODEL_RUN_SECTION_ID}`);
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

    redirect(`/benchmarks/${benchmarkId}/run?${responseParams.toString()}#${MODEL_RUN_SECTION_ID}`);
  }

  const benchmark = getBenchmarkById(params.id);
  if (!benchmark) {
    notFound();
  }

  const detailState = getBenchmarkDetailState(params.id);
  const runtimeState = getRuntimeBenchmarkJsonFromCache(params.id);

  const selectedCaseId = toSingleSearchParam(searchParams?.caseId);
  const selectedProviderId = toSupportedProviderId(toSingleSearchParam(searchParams?.providerId));
  const selectedModelId =
    toSingleSearchParam(searchParams?.modelId) ||
    (selectedProviderId === OPENAI_PROVIDER_ID ? DEFAULT_OPENAI_MODEL_ID : DEFAULT_OLLAMA_MODEL_ID);
  const selectedOllamaBaseUrl = toSingleSearchParam(searchParams?.ollamaBaseUrl);
  const selectedCatalogModel =
    selectedProviderId === OPENAI_PROVIDER_ID
      ? OPENAI_MODEL_CATALOG.find((entry) => entry.modelId === selectedModelId) ?? null
      : null;
  const modelSelectValue = selectedCatalogModel ? selectedCatalogModel.modelId : CUSTOM_OPENAI_MODEL_OPTION;
  const customModelInputDefault = selectedCatalogModel ? "" : selectedModelId;
  const selectedPricingLabel = selectedCatalogModel
    ? formatOpenAiModelPricing(selectedCatalogModel)
    : "Custom model pricing is not available in the built-in catalog.";
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

  const selectedCaseLabel = selectedCase
    ? `${selectedCase.title} (level: ${selectedCase.levelId})`
    : "No case selected";

  const selectedProviderLabel =
    selectedProviderId === OPENAI_PROVIDER_ID ? "OpenAI" : selectedProviderId === OLLAMA_PROVIDER_ID ? "Ollama" : "Unknown";

  return (
    <main className="container">
      <p>
        <Link href={`/benchmarks/${benchmark.id}`}>← Back to benchmark detail</Link>
      </p>

      <h1>Manual Benchmark Run (v1)</h1>
      <p className="subtle">Manual-only flow using cached runtime-benchmark.json with exact-text scoring.</p>

      <section className="run-page-summary">
        <h2>Run Summary</h2>
        <dl className="benchmark-detail-list">
          <div>
            <dt>Benchmark</dt>
            <dd>{benchmark.name}</dd>
          </div>
          <div>
            <dt>Benchmark ID</dt>
            <dd>
              <code>{benchmark.id}</code>
            </dd>
          </div>
          <div>
            <dt>Selected Case</dt>
            <dd>{selectedCaseLabel}</dd>
          </div>
          <div>
            <dt>Runtime Status</dt>
            <dd>{runtimeState.valid ? "runtime ready" : "runtime unavailable"}</dd>
          </div>
        </dl>
      </section>

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
            <h2>Case Selection</h2>
            {runtimeCases.length === 0 ? (
              <p>No runtime cases were found in runtime-benchmark.json.</p>
            ) : (
              <ul className="runtime-case-list">
                {runtimeCases.map((item) => (
                  <li
                    key={item.id}
                    className={`runtime-case-card ${selectedCase?.id === item.id ? "runtime-case-card-selected" : ""}`}
                  >
                    <div>
                      <strong>{item.title}</strong>
                    </div>
                    <div className="runtime-case-meta">
                      <span>
                        Level: <code>{item.levelId}</code>
                      </span>
                    </div>
                    <div className="runtime-case-meta">
                      <span>
                        Case ID: <code>{item.id}</code>
                      </span>
                    </div>
                    <p className="runtime-case-actions">
                      {selectedCase?.id === item.id ? (
                        <span className="case-selected-badge">Selected</span>
                      ) : (
                        <Link
                          href={`/benchmarks/${benchmark.id}/run?caseId=${encodeURIComponent(item.id)}&providerId=${encodeURIComponent(selectedProviderId)}&modelId=${encodeURIComponent(selectedModelId)}${selectedOllamaBaseUrl.length > 0 ? `&ollamaBaseUrl=${encodeURIComponent(selectedOllamaBaseUrl)}` : ""}`}
                        >
                          Select case
                        </Link>
                      )}
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

              <div className="run-panels-grid">
                <section className="run-panel">
                  <h2>Manual Run</h2>
                  <form action={submitAnswerAction} className="runtime-answer-form">
                    <input type="hidden" name="benchmarkId" value={benchmark.id} />
                    <input type="hidden" name="caseId" value={selectedCase.id} />

                    <label htmlFor="answerText">Submitted answer</label>
                    <textarea id="answerText" name="answerText" rows={4} defaultValue={previousAnswer} required />

                    <button type="submit">Score answer</button>
                  </form>

                  {hasScoreResult ? (
                    <div className="run-result-block">
                      <h3>Manual Result</h3>
                      <dl className="benchmark-detail-list">
                        <div>
                          <dt>Outcome</dt>
                          <dd className={resultCorrect ? "result-correct" : "result-incorrect"}>
                            {resultCorrect ? "correct" : "incorrect"}
                          </dd>
                        </div>
                        <div>
                          <dt>Score</dt>
                          <dd>{resultScoreParam || "0"}</dd>
                        </div>
                        <div>
                          <dt>Expected answer</dt>
                          <dd>
                            <code>{resultExpectedAnswer}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Submitted answer</dt>
                          <dd>
                            <pre className="contract-code-block">{previousAnswer || "(empty)"}</pre>
                          </dd>
                        </div>
                        <div>
                          <dt>Message</dt>
                          <dd>{resultMessage || "No message."}</dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    <p className="subtle">Submit a manual answer to view score and expected answer.</p>
                  )}
                </section>

                <section id={MODEL_RUN_SECTION_ID} className="run-panel">
                  <h2>Model Run</h2>
                  <p className="subtle">
                    Selected provider: <strong>{selectedProviderLabel}</strong>
                  </p>
                  <p className="subtle">
                    Switch provider view:
                    {" "}
                    <Link
                      href={`/benchmarks/${benchmark.id}/run?caseId=${encodeURIComponent(selectedCase.id)}&providerId=${encodeURIComponent(OPENAI_PROVIDER_ID)}&modelId=${encodeURIComponent(selectedProviderId === OPENAI_PROVIDER_ID ? selectedModelId : DEFAULT_OPENAI_MODEL_ID)}#${MODEL_RUN_SECTION_ID}`}
                    >
                      OpenAI
                    </Link>
                    {" "}
                    ·{" "}
                    <Link
                      href={`/benchmarks/${benchmark.id}/run?caseId=${encodeURIComponent(selectedCase.id)}&providerId=${encodeURIComponent(OLLAMA_PROVIDER_ID)}&modelId=${encodeURIComponent(selectedProviderId === OLLAMA_PROVIDER_ID ? selectedModelId : DEFAULT_OLLAMA_MODEL_ID)}${selectedOllamaBaseUrl.length > 0 ? `&ollamaBaseUrl=${encodeURIComponent(selectedOllamaBaseUrl)}` : ""}#${MODEL_RUN_SECTION_ID}`}
                    >
                      Ollama
                    </Link>
                  </p>

                  <form action={runWithProviderAction} className="runtime-answer-form">
                    <input type="hidden" name="benchmarkId" value={benchmark.id} />
                    <input type="hidden" name="caseId" value={selectedCase.id} />
                    <input type="hidden" name="providerId" value={selectedProviderId} />

                    {selectedProviderId === OPENAI_PROVIDER_ID ? (
                      <>
                        <label htmlFor="knownModelId">OpenAI model</label>
                        <select id="knownModelId" name="knownModelId" defaultValue={modelSelectValue}>
                          {OPENAI_MODEL_CATALOG.map((entry) => (
                            <option key={entry.modelId} value={entry.modelId}>
                              {entry.modelId} ({formatOpenAiModelPricing(entry)})
                            </option>
                          ))}
                          <option value={CUSTOM_OPENAI_MODEL_OPTION}>Custom…</option>
                        </select>

                        <label htmlFor="customModelId">Custom OpenAI model ID (used when “Custom…” is selected)</label>
                        <input id="customModelId" name="customModelId" type="text" defaultValue={customModelInputDefault} />

                        <p className="model-pricing-helper subtle">
                          Pricing (USD per 1M tokens, input / cached input / output): {selectedPricingLabel}
                        </p>
                      </>
                    ) : (
                      <>
                        <label htmlFor="modelId">Ollama model</label>
                        <input id="modelId" name="modelId" type="text" defaultValue={selectedModelId} required />

                        <label htmlFor="ollamaBaseUrl">Ollama base URL (optional)</label>
                        <input
                          id="ollamaBaseUrl"
                          name="ollamaBaseUrl"
                          type="text"
                          defaultValue={selectedOllamaBaseUrl}
                          placeholder="http://127.0.0.1:11434"
                        />
                      </>
                    )}

                    <button type="submit">Run with selected provider</button>
                  </form>

                  {providerSubmitStatus === "error" ? (
                    <div className="run-result-block">
                      <h3>Model Result</h3>
                      <p className="history-warning" role="status">
                        {providerError || "Provider execution failed."}
                      </p>
                      {providerDurationMs.length > 0 ? <p className="subtle">Duration: {providerDurationMs}ms</p> : null}
                    </div>
                  ) : null}

                  {hasProviderScoreResult ? (
                    <div className="run-result-block">
                      <h3>Model Result</h3>
                      <dl className="benchmark-detail-list">
                        <div>
                          <dt>Provider</dt>
                          <dd>
                            <code>{selectedProviderId}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Model</dt>
                          <dd>
                            <code>{selectedModelId}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Outcome</dt>
                          <dd className={providerResultCorrect ? "result-correct" : "result-incorrect"}>
                            {providerResultCorrect ? "correct" : "incorrect"}
                          </dd>
                        </div>
                        <div>
                          <dt>Score</dt>
                          <dd>{providerResultScore || "0"}</dd>
                        </div>
                        <div>
                          <dt>Expected answer</dt>
                          <dd>
                            <code>{providerResultExpectedAnswer}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Output text</dt>
                          <dd>
                            <pre className="contract-code-block">{providerOutputText || "(empty)"}</pre>
                          </dd>
                        </div>
                        <div>
                          <dt>Duration</dt>
                          <dd>{providerDurationMs || "0"}ms</dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    <p className="subtle">Run with the selected provider to view output, score, and expected answer.</p>
                  )}
                </section>
              </div>
            </section>
          ) : runtimeCases.length > 0 ? (
            <p className="subtle">Select a case to view prompt and submit an answer.</p>
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

