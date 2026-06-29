import { getBenchmarkDetailState } from "@/core/registry/getBenchmarkDetailState";
import Link from "next/link";
import { notFound } from "next/navigation";

interface BenchmarkDetailPageProps {
  params: {
    id: string;
  };
}

export default function BenchmarkDetailPage({ params }: BenchmarkDetailPageProps) {
  const detailState = getBenchmarkDetailState(params.id);

  if (!detailState) {
    notFound();
  }

  const { benchmark, cacheStatus, manifestValid, ready, readinessMessage, manifestPreview } = detailState;

  return (
    <main className="container">
      <p>
        <Link href="/">← Back to benchmark list</Link>
      </p>

      <h1>{benchmark.name}</h1>
      <p className="subtle">Registry metadata plus current local cache/readiness state.</p>

      <h2>Registry Metadata</h2>

      <dl className="benchmark-detail-list">
        <div>
          <dt>Name</dt>
          <dd>{benchmark.name}</dd>
        </div>
        <div>
          <dt>ID</dt>
          <dd>
            <code>{benchmark.id}</code>
          </dd>
        </div>
        <div>
          <dt>Description</dt>
          <dd>{benchmark.description}</dd>
        </div>
        <div>
          <dt>Weakness Category</dt>
          <dd>{benchmark.weaknessCategory}</dd>
        </div>
        <div>
          <dt>Approved Repo URL</dt>
          <dd>
            <a href={benchmark.approvedRepoUrl} target="_blank" rel="noreferrer">
              {benchmark.approvedRepoUrl}
            </a>
          </dd>
        </div>
        <div>
          <dt>Default Ref</dt>
          <dd>
            <code>{benchmark.defaultRef}</code>
          </dd>
        </div>
        <div>
          <dt>Entrypoint</dt>
          <dd>
            <code>{benchmark.entrypoint}</code>
          </dd>
        </div>
        <div>
          <dt>Trust Mode</dt>
          <dd>{benchmark.trustMode}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{benchmark.status}</dd>
        </div>
      </dl>

      <h2>Current Local Status</h2>
      <dl className="benchmark-detail-list">
        <div>
          <dt>Cache Status</dt>
          <dd>
            <code>{cacheStatus}</code>
          </dd>
        </div>
        <div>
          <dt>Manifest Valid</dt>
          <dd>{manifestValid ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt>Ready</dt>
          <dd>{ready ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt>Status Message</dt>
          <dd>{readinessMessage}</dd>
        </div>
        <div>
          <dt>Manual Run</dt>
          <dd>
            <Link href={`/benchmarks/${benchmark.id}/run`}>Open manual run page</Link>
          </dd>
        </div>
      </dl>

      {manifestValid && manifestPreview ? (
        <section>
          <h2>Cached Manifest Preview</h2>
          <dl className="benchmark-detail-list">
            <div>
              <dt>Manifest ID</dt>
              <dd>
                <code>{manifestPreview.manifestId}</code>
              </dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{manifestPreview.name}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>
                <code>{manifestPreview.version}</code>
              </dd>
            </div>
            <div>
              <dt>Weakness Category</dt>
              <dd>
                <code>{manifestPreview.weaknessCategory}</code>
              </dd>
            </div>
            <div>
              <dt>Supported Modes</dt>
              <dd>
                <code>{manifestPreview.supportedModes.join(", ")}</code>
              </dd>
            </div>
            <div>
              <dt>Level Count</dt>
              <dd>{manifestPreview.levelCount}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>
                <code>{manifestPreview.owner}</code>
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
    </main>
  );
}

