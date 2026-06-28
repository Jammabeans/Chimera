import { EXTERNAL_BENCHMARK_MANIFEST_EXAMPLE } from "@/core/registry/externalBenchmarkManifestExample";
import Link from "next/link";

const REQUIRED_FIELDS = [
  "id",
  "name",
  "version",
  "description",
  "weaknessCategory",
  "supportedModes",
  "entrypoint",
  "levels",
  "owner",
] as const;

const EXAMPLE_FOLDER_LAYOUT = `external-benchmark-repo/
  benchmark.manifest.json
  src/
    benchmarks/
      state-trace/
        index.ts
    levels/
      basic.ts
      context-heavy.ts`;

export default function ContractPage() {
  return (
    <main className="container">
      <p>
        <Link href="/">← Back to home</Link>
      </p>

      <h1>Benchmark Repo Contract (v1)</h1>
      <p className="subtle">
        External benchmark repositories must expose a minimal manifest that Chimera Core can understand. This step
        defines the manifest shape only; loading, cloning, install, execution, providers, and storage are intentionally
        out of scope.
      </p>

      <section className="contract-section" aria-label="Required manifest fields">
        <h2>Required manifest fields</h2>
        <ul className="contract-field-list">
          {REQUIRED_FIELDS.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="contract-section" aria-label="Sample benchmark manifest">
        <h2>Sample manifest</h2>
        <pre className="contract-code-block">
          <code>{JSON.stringify(EXTERNAL_BENCHMARK_MANIFEST_EXAMPLE, null, 2)}</code>
        </pre>
      </section>

      <section className="contract-section" aria-label="Example external repo folder layout">
        <h2>Example external repo folder layout</h2>
        <pre className="contract-code-block">
          <code>{EXAMPLE_FOLDER_LAYOUT}</code>
        </pre>
      </section>
    </main>
  );
}

