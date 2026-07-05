"use client";

import { useFormState } from "react-dom";
import {
  generateStateTraceInstanceAction,
  scoreStateTraceResponseAction,
  type GenerateCliPilotState,
  type ScoreCliPilotState,
} from "./actions";

const DEFAULT_SEED = "1" as const;
const DEFAULT_STEP_COUNT = "4" as const;

const INITIAL_GENERATE_STATE: GenerateCliPilotState = {
  seed: DEFAULT_SEED,
  stepCount: DEFAULT_STEP_COUNT,
  status: "idle",
  error: "",
  generatedPrompt: "",
  generatedInstanceJson: "",
};

const INITIAL_SCORE_STATE: ScoreCliPilotState = {
  responseText: "",
  status: "idle",
  error: "",
  scoreResultJson: "",
};

export function CliPilotClient() {
  const [generateState, generateAction] = useFormState(generateStateTraceInstanceAction, INITIAL_GENERATE_STATE);
  const [scoreState, scoreAction] = useFormState(scoreStateTraceResponseAction, INITIAL_SCORE_STATE);

  const hasGeneratedInstance =
    generateState.status === "ok" && generateState.generatedInstanceJson.trim().length > 0;

  return (
    <>
      <section className="run-panel">
        <h2>1) Generate instance (CLI)</h2>
        <form action={generateAction} className="runtime-answer-form">
          <label htmlFor="seed">Seed</label>
          <input id="seed" name="seed" type="text" defaultValue={generateState.seed} required />

          <label htmlFor="stepCount">Step count</label>
          <input id="stepCount" name="stepCount" type="text" defaultValue={generateState.stepCount} required />

          <button type="submit">Generate with cached CLI</button>
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
              <p className="subtle">No prompt field was found in CLI output; raw instance JSON is shown below.</p>
            )}

            <h3>Generated instance JSON</h3>
            <pre className="contract-code-block">{generateState.generatedInstanceJson}</pre>
          </div>
        ) : (
          <p className="subtle">Generate an instance to reveal prompt and enable manual scoring.</p>
        )}
      </section>

      <section className="run-panel" style={{ marginTop: "1rem" }}>
        <h2>2) Submit manual answer + score (CLI)</h2>
        <form action={scoreAction} className="runtime-answer-form">
          <input type="hidden" name="generatedInstanceJson" value={generateState.generatedInstanceJson} />

          <label htmlFor="responseText">Manual answer</label>
          <textarea id="responseText" name="responseText" rows={4} defaultValue={scoreState.responseText} required />

          <button type="submit" disabled={!hasGeneratedInstance}>
            Score with cached CLI
          </button>
        </form>

        {!hasGeneratedInstance ? (
          <p className="subtle">Scoring is disabled until a valid generated instance is present.</p>
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
          </div>
        ) : null}
      </section>
    </>
  );
}

