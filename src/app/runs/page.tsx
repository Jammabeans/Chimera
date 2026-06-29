import {
  getCombinedRunTimeline,
  type CombinedRunTimelineEntry,
} from "@/core/storage/getCombinedRunTimeline";

function renderRunTypeBadge(entry: CombinedRunTimelineEntry) {
  return (
    <span
      className={entry.runType === "manual" ? "run-type-badge run-type-badge-manual" : "run-type-badge run-type-badge-model"}
    >
      {entry.runType}
    </span>
  );
}

export default function RunsPage() {
  const historyState = getCombinedRunTimeline();

  return (
    <main className="container">
      <h1>Run History (v1)</h1>
      <p className="subtle">Combined local-only run timeline from manual and model history files.</p>

      {historyState.warnings.map((warning, index) => (
        <p key={`${warning}-${index}`} className="history-warning" role="status">
          {warning}
        </p>
      ))}

      {historyState.entries.length === 0 ? (
        <p className="subtle">No run history entries yet.</p>
      ) : (
        <ul className="run-history-list">
          {historyState.entries.map((entry, index) => (
            <li key={`${entry.timestamp}-${entry.benchmarkId}-${entry.caseId}-${index}`} className="run-history-card">
              <dl>
                <div>
                  <dt>Run type</dt>
                  <dd>{renderRunTypeBadge(entry)}</dd>
                </div>
                <div>
                  <dt>Timestamp</dt>
                  <dd>{entry.timestamp}</dd>
                </div>
                <div>
                  <dt>Benchmark</dt>
                  <dd>
                    {entry.benchmarkName} <span className="subtle">({entry.benchmarkId})</span>
                  </dd>
                </div>
                <div>
                  <dt>Case</dt>
                  <dd>
                    {entry.caseTitle || "(untitled case)"} <span className="subtle">({entry.caseId})</span>
                  </dd>
                </div>
                <div>
                  <dt>Expected answer</dt>
                  <dd>
                    <code>{entry.expectedAnswer}</code>
                  </dd>
                </div>
                {entry.runType === "manual" ? (
                  <>
                    <div>
                      <dt>Submitted answer</dt>
                      <dd>
                        <code>{entry.submittedAnswer}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Scoring mode</dt>
                      <dd>{entry.scoringMode}</dd>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <dt>Provider</dt>
                      <dd>{entry.providerId}</dd>
                    </div>
                    <div>
                      <dt>Model</dt>
                      <dd>{entry.modelId}</dd>
                    </div>
                    <div>
                      <dt>Output text</dt>
                      <dd>
                        <code>{entry.outputText}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Duration (ms)</dt>
                      <dd>{entry.durationMs}</dd>
                    </div>
                  </>
                )}
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
    </main>
  );
}

