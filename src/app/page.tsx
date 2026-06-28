import { getRegisteredBenchmarks } from "@/core/registry/getRegisteredBenchmarks";

export default function HomePage() {
  const benchmarks = getRegisteredBenchmarks();

  return (
    <main className="container">
      <h1>Chimera Core</h1>
      <p>Browser-based benchmark host app (core web app).</p>

      <section aria-label="Benchmark Registry" className="registry-section">
        <h2>Benchmark Registry (Static Examples)</h2>
        <p className="subtle">
          These entries are local placeholders for future external benchmark repository loading.
        </p>

        <table className="registry-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Description</th>
              <th>Weakness</th>
              <th>Trust</th>
              <th>Status</th>
              <th>Repo</th>
              <th>Entrypoint</th>
              <th>Default Ref</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((benchmark) => (
              <tr key={benchmark.id}>
                <td>{benchmark.id}</td>
                <td>{benchmark.name}</td>
                <td>{benchmark.description}</td>
                <td>{benchmark.weaknessCategory}</td>
                <td>{benchmark.trustMode}</td>
                <td>{benchmark.status}</td>
                <td>
                  <a href={benchmark.repoUrl} target="_blank" rel="noreferrer">
                    {benchmark.repoUrl}
                  </a>
                </td>
                <td>
                  <code>{benchmark.entrypoint}</code>
                </td>
                <td>
                  <code>{benchmark.defaultRef}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

