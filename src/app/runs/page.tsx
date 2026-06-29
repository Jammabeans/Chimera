import { readManualRunHistory } from "@/core/storage/manualRunHistory";

export default function RunsPage() {
  const historyState = readManualRunHistory();

  return (
    <main className="container">
      <h1>Manual Run History (v1)</h1>
      <p className="subtle">Global local-only manual run log from data/manual-run-history.json.</p>

      {historyState.warning ? (
        <p className="history-warning" role="status">
          {historyState.warning}
        </p>
      ) : null}

      {historyState.entries.length === 0 ? (
        <p className="subtle">No manual run history entries yet.</p>
      ) : (
        <ul className="run-history-list">
          {historyState.entries.map((entry, index) => (
            <li key={`${entry.timestamp}-${entry.benchmarkId}-${entry.caseId}-${index}`} className="run-history-card">
              <dl>
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
                  <dt>Submitted answer</dt>
                  <dd>
                    <code>{entry.submittedAnswer}</code>
                  </dd>
                </div>
                <div>
                  <dt>Expected answer</dt>
                  <dd>
                    <code>{entry.expectedAnswer}</code>
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
                  <dt>Scoring mode</dt>
                  <dd>{entry.scoringMode}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

