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
        Readiness means registry entry exists, cache directory exists, root manifest exists, and manifest passes current
        cache inspection validation.
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
        {readinessReport.benchmarks.map((item) => (
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
                <dt>Cache Status</dt>
                <dd>
                  <code>{item.cacheStatus}</code>
                </dd>
              </div>
              <div>
                <dt>Manifest Valid</dt>
                <dd>{item.manifestValid ? "yes" : "no"}</dd>
              </div>
              <div>
                <dt>Status Message</dt>
                <dd>{item.readinessMessage}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </main>
  );
}

