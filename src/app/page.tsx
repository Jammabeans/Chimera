import { getRegisteredBenchmarks } from "@/core/registry/getRegisteredBenchmarks";
import Link from "next/link";

export default function HomePage() {
  const benchmarks = getRegisteredBenchmarks();

  return (
    <main className="container">
      <h1>Chimera Core</h1>
      <p>Browser-based benchmark host app (core web app).</p>

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
              <h3>{benchmark.name}</h3>
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
                  <dt>Repo URL</dt>
                  <dd>
                    <a href={benchmark.repoUrl} target="_blank" rel="noreferrer">
                      {benchmark.repoUrl}
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

