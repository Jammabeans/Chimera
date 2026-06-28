import { getSyncPlan } from "@/core/registry/getSyncPlan";

export default function SyncPage() {
  const syncPlan = getSyncPlan();

  return (
    <main className="container">
      <h1>Sync Planning</h1>
      <p className="subtle">
        This page shows planned mapping only. Sync is not implemented yet (no clone, pull, install, or execution).
      </p>

      <ul className="sync-plan-list" aria-label="Sync planning list">
        {syncPlan.map((item) => (
          <li key={item.benchmarkId} className="sync-plan-card">
            <h2>
              {item.benchmarkName} <span className="subtle">({item.benchmarkId})</span>
            </h2>

            <dl>
              <div>
                <dt>Approved Repo URL</dt>
                <dd>
                  <a href={item.repoUrl} target="_blank" rel="noreferrer">
                    {item.repoUrl}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Local Cache Path</dt>
                <dd>
                  <code>{item.localCachePath}</code>
                </dd>
              </div>
              <div>
                <dt>Expected Manifest Path</dt>
                <dd>
                  <code>{item.expectedManifestPath}</code>
                </dd>
              </div>
              <div>
                <dt>Ref</dt>
                <dd>
                  <code>{item.ref}</code>
                </dd>
              </div>
              <div>
                <dt>Trust Mode</dt>
                <dd>{item.trustMode}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{item.status}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </main>
  );
}

