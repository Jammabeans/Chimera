import { getSyncPlan } from "@/core/registry/getSyncPlan";
import { runManualBenchmarkSync } from "@/core/registry/runManualBenchmarkSync";
import { redirect } from "next/navigation";

interface SyncPageProps {
  searchParams?: {
    syncMessage?: string;
    syncedId?: string;
    syncStatus?: string;
  };
}

export default function SyncPage({ searchParams }: SyncPageProps) {
  async function syncOneBenchmarkAction(formData: FormData): Promise<void> {
    "use server";

    const benchmarkIdValue = formData.get("benchmarkId");
    const benchmarkId = typeof benchmarkIdValue === "string" ? benchmarkIdValue : "";
    const result = runManualBenchmarkSync(benchmarkId);

    const params = new URLSearchParams();
    params.set("syncStatus", result.status);
    params.set("syncMessage", result.message);
    params.set("syncedId", result.benchmarkId);

    redirect(`/sync?${params.toString()}`);
  }

  const syncPlan = getSyncPlan();
  const syncMessage = searchParams?.syncMessage?.trim() ?? "";
  const syncedId = searchParams?.syncedId?.trim() ?? "";
  const syncStatus = searchParams?.syncStatus?.trim() ?? "";
  const isSuccessStatus = syncStatus === "cloned" || syncStatus === "updated";

  return (
    <main className="container">
      <h1>Sync Planning</h1>
      <p className="subtle">
        This page supports manual sync of one benchmark at a time using approved registry entries. Missing caches are cloned.
        Existing caches are treated as disposable and updated via fetch + hard reset.
      </p>

      {syncMessage.length > 0 ? (
        <p
          className={`sync-result-message ${
            isSuccessStatus
              ? "sync-result-success"
              : syncStatus === "rejected"
                ? "sync-result-warning"
                : "sync-result-error"
          }`}
          role="status"
        >
          {syncMessage}
        </p>
      ) : null}

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

            <form action={syncOneBenchmarkAction} className="sync-action-row">
              <input type="hidden" name="benchmarkId" value={item.benchmarkId} />
              <button type="submit">Sync this benchmark</button>
              {syncedId === item.benchmarkId && syncMessage.length > 0 ? (
                <span className="sync-last-attempt-tag">latest attempt</span>
              ) : null}
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}

