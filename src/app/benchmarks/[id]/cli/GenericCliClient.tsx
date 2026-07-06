"use client";

import { useFormState } from "react-dom";

import type { BenchmarkCliDescribeMetadata } from "@/core/runner/runBenchmarkCachedCli";

import {
  generateBenchmarkCliInstanceAction,
  scoreBenchmarkCliResponseAction,
  type GenericCliGenerateState,
  type GenericCliScoreState,
} from "./actions";

interface GenericCliClientProps {
  benchmarkId: string;
  describeMetadata: BenchmarkCliDescribeMetadata;
}

function toFieldFormName(fieldName: string): string {
  return `generateField__${fieldName}`;
}

function toInputDefaultValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return "";
}

const EMPTY_SCORE_STATE: GenericCliScoreState = {
  responseText: "",
  status: "idle",
  error: "",
  scoreResultJson: "",
  analysisStatus: "idle",
  analysisResultJson: "",
  analysisError: "",
};

export function GenericCliClient({ benchmarkId, describeMetadata }: GenericCliClientProps) {
  const initialGenerateState: GenericCliGenerateState = {
    benchmarkId,
    status: "idle",
    error: "",
    generatedPrompt: "",
    generatedInstanceJson: "",
    generatedResultJson: "",
  };

  const [generateState, generateAction] = useFormState(generateBenchmarkCliInstanceAction, initialGenerateState);
  const [scoreState, scoreAction] = useFormState(scoreBenchmarkCliResponseAction, EMPTY_SCORE_STATE);

  const hasGeneratedInstance =
    generateState.status === "ok" && generateState.generatedInstanceJson.trim().length > 0;

  return (
    <>
      <section className="run-panel">
        <h2>1) Describe + Generate (CLI)</h2>
        <p className="subtle">Generate input fields are rendered from describe metadata.</p>

        <form action={generateAction} className="runtime-answer-form">
          <input type="hidden" name="benchmarkId" value={benchmarkId} />

          {describeMetadata.generateFields.length === 0 ? (
            <p className="subtle">No describe.generate.fields were provided. Generate will use envelope-only payload.</p>
          ) : (
            describeMetadata.generateFields.map((field) => {
              const formName = toFieldFormName(field.name);

              if (field.type === "select") {
                return (
                  <div key={field.name}>
                    <label htmlFor={formName}>
                      {field.name}
                      {field.required ? " *" : ""}
                    </label>
                    <select id={formName} name={formName} defaultValue={toInputDefaultValue(field.defaultValue)}>
                      {!field.required ? <option value="">(none)</option> : null}
                      {field.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {field.description.length > 0 ? <p className="subtle">{field.description}</p> : null}
                  </div>
                );
              }

              if (field.type === "boolean") {
                const defaultChecked = typeof field.defaultValue === "boolean" ? field.defaultValue : false;
                return (
                  <div key={field.name}>
                    <label htmlFor={formName}>
                      <input id={formName} name={formName} type="checkbox" defaultChecked={defaultChecked} /> {field.name}
                      {field.required ? " *" : ""}
                    </label>
                    {field.description.length > 0 ? <p className="subtle">{field.description}</p> : null}
                  </div>
                );
              }

              if (field.type === "integer") {
                return (
                  <div key={field.name}>
                    <label htmlFor={formName}>
                      {field.name}
                      {field.required ? " *" : ""}
                    </label>
                    <input
                      id={formName}
                      name={formName}
                      type="number"
                      defaultValue={toInputDefaultValue(field.defaultValue)}
                      required={field.required}
                      min={field.min ?? undefined}
                      max={field.max ?? undefined}
                      step={1}
                    />
                    {field.description.length > 0 ? <p className="subtle">{field.description}</p> : null}
                  </div>
                );
              }

              return (
                <div key={field.name}>
                  <label htmlFor={formName}>
                    {field.name}
                    {field.required ? " *" : ""}
                  </label>
                  <input
                    id={formName}
                    name={formName}
                    type="text"
                    defaultValue={toInputDefaultValue(field.defaultValue)}
                    required={field.required}
                  />
                  {field.description.length > 0 ? <p className="subtle">{field.description}</p> : null}
                </div>
              );
            })
          )}

          <button type="submit" disabled={!describeMetadata.supportsGenerate}>
            Generate with cached CLI
          </button>
        </form>

        {generateState.status === "error" ? (
          <p className="history-warning" role="status">
            {generateState.error || "Failed to generate instance."}
          </p>
        ) : null}

        {hasGeneratedInstance ? (
          <div className="run-result-block">
            <h3>Generated prompt</h3>
            {generateState.generatedPrompt.trim().length > 0 ? (
              <pre className="contract-code-block">{generateState.generatedPrompt}</pre>
            ) : (
              <p className="subtle">No prompt field was detected in generate response.</p>
            )}

            <h3>Generated instance JSON</h3>
            <pre className="contract-code-block">{generateState.generatedInstanceJson}</pre>

            <h3>Generate result JSON</h3>
            <pre className="contract-code-block">{generateState.generatedResultJson}</pre>
          </div>
        ) : null}
      </section>

      <section className="run-panel" style={{ marginTop: "1rem" }}>
        <h2>2) Manual score (and optional analyze)</h2>
        <form action={scoreAction} className="runtime-answer-form">
          <input type="hidden" name="benchmarkId" value={benchmarkId} />
          <input type="hidden" name="generatedInstanceJson" value={generateState.generatedInstanceJson} />

          <label htmlFor="responseText">Manual answer</label>
          <textarea id="responseText" name="responseText" rows={4} defaultValue={scoreState.responseText} required />

          <button type="submit" disabled={!hasGeneratedInstance || !describeMetadata.supportsScore}>
            Score with cached CLI
          </button>
        </form>

        {!describeMetadata.supportsScore ? (
          <p className="history-warning" role="status">
            This benchmark CLI does not advertise score support in describe.
          </p>
        ) : null}

        {!hasGeneratedInstance ? (
          <p className="subtle">Scoring is disabled until a generated instance is available.</p>
        ) : null}

        {scoreState.status === "error" ? (
          <p className="history-warning" role="status">
            {scoreState.error || "Failed to score manual response."}
          </p>
        ) : null}

        {scoreState.status === "ok" && scoreState.scoreResultJson.trim().length > 0 ? (
          <div className="run-result-block">
            <h3>Score result JSON</h3>
            <pre className="contract-code-block">{scoreState.scoreResultJson}</pre>

            {describeMetadata.supportsAnalyze ? (
              <>
                {scoreState.analysisStatus === "ok" && scoreState.analysisResultJson.trim().length > 0 ? (
                  <>
                    <h3>Analysis result JSON</h3>
                    <pre className="contract-code-block">{scoreState.analysisResultJson}</pre>
                  </>
                ) : null}

                {scoreState.analysisStatus === "error" ? (
                  <p className="history-warning" role="status">
                    Analyze failed after score succeeded: {scoreState.analysisError || "Unknown analyze failure."}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="subtle">Analyze is not advertised by this benchmark CLI.</p>
            )}
          </div>
        ) : null}
      </section>
    </>
  );
}
