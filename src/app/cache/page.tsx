import { getCacheInspection } from "@/core/registry/getCacheInspection";

export default function CachePage() {
  const cacheInspection = getCacheInspection();

  return (
    <main className="container">
      <h1>Cache Inspection</h1>
      <p className="subtle">
        Read-only inspection of local benchmark cache state. This page does not run sync commands.
      </p>

      <ul className="cache-inspection-list" aria-label="Benchmark cache inspection list">
        {cacheInspection.map((item) => (
          <li key={item.benchmarkId} className="cache-inspection-card">
            <h2>
              {item.benchmarkName} <span className="subtle">({item.benchmarkId})</span>
            </h2>

            <dl>
              <div>
                <dt>Cache Directory</dt>
                <dd>
                  <code>{item.localCachePath}</code>
                </dd>
              </div>
              <div>
                <dt>Manifest Path</dt>
                <dd>
                  <code>{item.manifestPath}</code>
                </dd>
              </div>
              <div>
                <dt>Cache Status</dt>
                <dd>
                  <code>{item.status}</code>
                </dd>
              </div>
            </dl>

            {item.validationErrors.length > 0 ? (
              <section>
                <h3>Validation Errors</h3>
                <ul>
                  {item.validationErrors.map((error) => (
                    <li key={error} className="diag-error">
                      {error}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}

