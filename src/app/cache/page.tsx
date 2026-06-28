import { getCacheInspection } from "@/core/registry/getCacheInspection";

function getStatusClassName(status: string): string {
  if (status === "manifest-valid") {
    return "cache-status-valid";
  }

  if (status === "manifest-invalid") {
    return "cache-status-invalid";
  }

  if (status === "cache-missing" || status === "manifest-missing") {
    return "cache-status-missing";
  }

  return "";
}

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
                  <code className={getStatusClassName(item.status)}>{item.status}</code>
                </dd>
              </div>
            </dl>

            {item.status === "manifest-valid" && item.manifestPreview ? (
              <section>
                <h3>Manifest Preview</h3>
                <dl>
                  <div>
                    <dt>Manifest ID</dt>
                    <dd>
                      <code>{item.manifestPreview.manifestId}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Name</dt>
                    <dd>{item.manifestPreview.name}</dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>
                      <code>{item.manifestPreview.version}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Weakness Category</dt>
                    <dd>
                      <code>{item.manifestPreview.weaknessCategory}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Supported Modes</dt>
                    <dd>
                      <code>{item.manifestPreview.supportedModes.join(", ")}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Level Count</dt>
                    <dd>{item.manifestPreview.levelCount}</dd>
                  </div>
                  <div>
                    <dt>Owner</dt>
                    <dd>
                      <code>{item.manifestPreview.owner}</code>
                    </dd>
                  </div>
                </dl>
              </section>
            ) : null}

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

