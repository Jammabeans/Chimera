import { getRegisteredBenchmarks } from "@/core/registry/getRegisteredBenchmarks";
import { getBenchmarkReadiness } from "@/core/registry/getBenchmarkReadiness";
import Link from "next/link";

export default function HomePage() {
  const benchmarks = getRegisteredBenchmarks();
  const readinessReport = getBenchmarkReadiness();
  const readinessById = new Map(readinessReport.benchmarks.map((item) => [item.benchmarkId, item]));

  return (
    <main className="container">
      <h1>Chimera Core</h1>
      <p>Browser-based benchmark host app (core web app).</p>
      <p className="subtle">Use the top navigation to switch between home, contract, registry, and sync views.</p>
      <p className="subtle">
        Planned sync mapping is available at <Link href="/sync">/sync</Link> (manual sync plan only, no sync execution).
      </p>
      <p className="subtle">
        Local cache inspection is available at <Link href="/cache">/cache</Link> (read-only status and manifest checks).
      </p>
      <p className="subtle">
        Benchmark readiness status is available at <Link href="/readiness">/readiness</Link>.
      </p>

      <section aria-label="Benchmark Registry" className="registry-section">
        <h2>Benchmark Registry (Local Examples)</h2>
        <p className="subtle">
          Benchmarks are external repositories referenced by the local registry file.
        </p>
        <p className="subtle">
          Current entries are local example metadata only; cloning, install, execution, APIs, and storage are not
          implemented here.
        </p>

        <ul className="benchmark-card-list">
          {benchmarks.map((benchmark) => (
            <li key={benchmark.id} className="benchmark-card">
              <h3 className="benchmark-card-title-row">
                <span>{benchmark.name}</span>
                {readinessById.get(benchmark.id)?.ready ? (
                  <span className="readiness-badge readiness-badge-ready">Ready</span>
                ) : (
                  <span className="readiness-badge readiness-badge-not-ready">Not ready</span>
                )}
              </h3>
              <dl>
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
                  <dt>Trust Mode</dt>
                  <dd>{benchmark.trustMode}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{benchmark.status}</dd>
                </div>
                <div>
                  <dt>Approved Repo URL</dt>
                  <dd>
                    <a href={benchmark.approvedRepoUrl} target="_blank" rel="noreferrer">
                      {benchmark.approvedRepoUrl}
                    </a>
                  </dd>
                </div>
              </dl>
              <p className="benchmark-card-link-row">
                <Link href={`/benchmarks/${benchmark.id}`}>View details</Link>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

