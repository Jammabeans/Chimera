import { getBenchmarkReadiness } from "@/core/registry/getBenchmarkReadiness";

function getReadinessClassName(ready: boolean): string {
  return ready ? "readiness-status-ready" : "readiness-status-not-ready";
}

export default function ReadinessPage() {
  const readinessReport = getBenchmarkReadiness();

  return (
    <main className="container">
      <h1>Benchmark Readiness</h1>
      <p className="subtle">
        Config-based run readiness only. No live OpenAI API connectivity checks and no live Ollama endpoint probing are
        performed in this view.
      </p>

      <section className="readiness-summary" aria-label="Readiness summary">
        <p>
          <strong>Total benchmarks:</strong> {readinessReport.summary.totalCount}
        </p>
        <p>
          <strong>Ready:</strong> {readinessReport.summary.readyCount}
        </p>
        <p>
          <strong>Not ready:</strong> {readinessReport.summary.notReadyCount}
        </p>
      </section>

      <ul className="readiness-list" aria-label="Per-benchmark readiness list">
        {readinessReport.benchmarks.map((item) => {
          return (
            <li key={item.benchmarkId} className="readiness-card">
            <h2>
              {item.benchmarkName} <span className="subtle">({item.benchmarkId})</span>
            </h2>

            <dl>
              <div>
                <dt>Readiness</dt>
                <dd>
                  <span className={getReadinessClassName(item.ready)}>{item.readinessLabel}</span>
                </dd>
              </div>
              <div>
                <dt>Registry Entry Present</dt>
                <dd>
                  <span className={getReadinessClassName(item.existsInRegistry)}>{item.existsInRegistry ? "yes" : "no"}</span>
                </dd>
              </div>
              <div>
                <dt>Cache Status</dt>
                <dd>
                  <code>{item.cacheStatus}</code>
                </dd>
              </div>
              <div>
                <dt>Cache Exists</dt>
                <dd>
                  <span className={getReadinessClassName(item.cacheExists)}>{item.cacheExists ? "yes" : "no"}</span>
                </dd>
              </div>
              <div>
                <dt>Manifest Exists</dt>
                <dd>
                  <span className={getReadinessClassName(item.manifestExists)}>{item.manifestExists ? "yes" : "no"}</span>
                </dd>
              </div>
              <div>
                <dt>Manifest Valid</dt>
                <dd>
                  <span className={getReadinessClassName(item.manifestValid)}>{item.manifestValid ? "yes" : "no"}</span>
                </dd>
              </div>
              <div>
                <dt>Runtime Benchmark Artifact Exists</dt>
                <dd>
                  <span className={getReadinessClassName(item.runtimeBenchmarkArtifactExists)}>
                    {item.runtimeBenchmarkArtifactExists ? "yes" : "no"}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Runtime Benchmark Artifact Valid</dt>
                <dd>
                  <span className={getReadinessClassName(item.runtimeBenchmarkArtifactValid)}>
                    {item.runtimeBenchmarkArtifactValid ? "yes" : "no"}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Manual Run Ready</dt>
                <dd>
                  <span className={getReadinessClassName(item.manualRunReady)}>{item.manualRunReady ? "yes" : "no"}</span>
                </dd>
              </div>
              {!item.manualRunReady ? (
                <div>
                  <dt>Manual Run Note</dt>
                  <dd>{item.manualRunReadinessReason}</dd>
                </div>
              ) : null}
              <div>
                <dt>OpenAI Run Ready</dt>
                <dd>
                  <span className={getReadinessClassName(item.openAiRunReady)}>{item.openAiRunReady ? "yes" : "no"}</span>
                </dd>
              </div>
              {!item.openAiRunReady ? (
                <div>
                  <dt>OpenAI Run Note</dt>
                  <dd>{item.openAiRunReadinessReason}</dd>
                </div>
              ) : null}
              <div>
                <dt>Ollama Run Ready</dt>
                <dd>
                  <span className={getReadinessClassName(item.ollamaRunReady)}>{item.ollamaRunReady ? "yes" : "no"}</span>
                </dd>
              </div>
              {!item.ollamaRunReady ? (
                <div>
                  <dt>Ollama Run Note</dt>
                  <dd>{item.ollamaRunReadinessReason}</dd>
                </div>
              ) : null}
              <div>
                <dt>Status Message</dt>
                <dd>{item.readinessMessage}</dd>
              </div>
            </dl>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

