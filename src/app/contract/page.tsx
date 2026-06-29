import { EXTERNAL_BENCHMARK_MANIFEST_EXAMPLE } from "@/core/registry/externalBenchmarkManifestExample";
import {
  PROVIDER_EXECUTION_METADATA_EXAMPLE,
  PROVIDER_EXECUTION_REQUEST_EXAMPLE,
  PROVIDER_EXECUTION_RESPONSE_EXAMPLE,
  SCORED_MODEL_RUN_RESULT_EXAMPLE,
} from "@/core/providers/providerExecutionContractExample";
import { RUNTIME_BENCHMARK_JSON_ARTIFACT_EXAMPLE } from "@/core/runner/runtimeBenchmarkJsonArtifactExample";
import { RUNTIME_BENCHMARK_MODULE_EXAMPLE } from "@/core/runner/runtimeBenchmarkModuleExample";
import { RUNTIME_BENCHMARK_JSON_FILENAME } from "@/types/runtimeBenchmarkJsonContract";

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

const RUNTIME_CASE_FIELDS = ["id", "levelId", "title", "prompt", "metadata (optional)"] as const;

const RUNTIME_ANSWER_FIELDS = ["answerText"] as const;

const RUNTIME_SCORE_FIELDS = ["correct", "score", "expectedAnswer", "message"] as const;

const RUNTIME_JSON_ARTIFACT_FIELDS = ["benchmarkId", "benchmarkName", "scoringMode", "cases"] as const;

const RUNTIME_JSON_CASE_FIELDS = [
  "id",
  "levelId",
  "title",
  "prompt",
  "expectedAnswer",
  "metadata (optional)",
] as const;

const RUNTIME_JSON_SCORING_MODES = ["exact-text"] as const;

const PROVIDER_EXECUTION_REQUEST_FIELDS = ["benchmarkId", "caseId", "prompt", "providerId", "modelId"] as const;

const PROVIDER_EXECUTION_RESPONSE_FIELDS = ["outputText", "rawResponseMetadata (optional)"] as const;

const PROVIDER_EXECUTION_METADATA_FIELDS = ["timestamp", "durationMs", "providerId", "modelId"] as const;

const SCORED_MODEL_RUN_RESULT_FIELDS = [
  "benchmarkId",
  "caseId",
  "prompt",
  "outputText",
  "expectedAnswer",
  "correct",
  "score",
  "metadata",
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

const RUNTIME_SCORE_SIGNATURE = `scoreAnswer(caseId: string, answerText: string): {
  correct: boolean;
  score: number;
  expectedAnswer: string;
  message: string;
}`;

export default function ContractPage() {
  return (
    <main className="container">
      <h1>Benchmark Contracts (v1)</h1>
      <p className="subtle">
        Chimera Core currently defines four complementary contracts: a benchmark repo manifest contract, a runtime
        module contract, a static runtime JSON contract, and a provider/model execution contract.
      </p>

      <section className="contract-section" aria-label="Required manifest fields">
        <h2>1) Manifest contract (external repo)</h2>
        <p className="subtle">
          External benchmark repositories must expose this minimal manifest shape. Clone/install/execution/provider
          behavior remains out of scope in this step.
        </p>
        <h3>Required manifest fields</h3>
        <ul className="contract-field-list">
          {REQUIRED_FIELDS.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="contract-section" aria-label="Sample benchmark manifest">
        <h3>Sample manifest</h3>
        <p className="subtle">This example is formatted for readability and mirrors the required v1 fields.</p>
        <pre className="contract-code-block">
          <code>{JSON.stringify(EXTERNAL_BENCHMARK_MANIFEST_EXAMPLE, null, 2)}</code>
        </pre>
      </section>

      <section className="contract-section" aria-label="Example external repo folder layout">
        <h3>Example external repo folder layout</h3>
        <pre className="contract-code-block">
          <code>{EXAMPLE_FOLDER_LAYOUT}</code>
        </pre>
      </section>

      <section className="contract-section" aria-label="Runtime benchmark contract">
        <h2>2) Runtime benchmark contract (v1)</h2>
        <p className="subtle">
          Runtime benchmark modules are intentionally simple for v1: static deterministic cases, plain text answers,
          and straightforward scoring.
        </p>

        <h3>Benchmark case fields</h3>
        <ul className="contract-field-list">
          {RUNTIME_CASE_FIELDS.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>

        <h3>Answer submission field</h3>
        <ul className="contract-field-list">
          {RUNTIME_ANSWER_FIELDS.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>

        <h3>Score result fields</h3>
        <ul className="contract-field-list">
          {RUNTIME_SCORE_FIELDS.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>

        <h3>Sample runtime module</h3>
        <pre className="contract-code-block">
          <code>{JSON.stringify(RUNTIME_BENCHMARK_MODULE_EXAMPLE, null, 2)}</code>
        </pre>

        <h3>Required scorer signature</h3>
        <pre className="contract-code-block">
          <code>{RUNTIME_SCORE_SIGNATURE}</code>
        </pre>
      </section>

      <section className="contract-section" aria-label="Static runtime benchmark JSON contract">
        <h2>3) Static runtime JSON contract ({RUNTIME_BENCHMARK_JSON_FILENAME})</h2>
        <p className="subtle">
          This is a separate on-disk artifact contract for static deterministic runtime cases. It is JSON-friendly and
          distinct from the in-memory runtime module contract above.
        </p>

        <h3>Runtime benchmark JSON fields</h3>
        <ul className="contract-field-list">
          {RUNTIME_JSON_ARTIFACT_FIELDS.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>

        <h3>Runtime case JSON fields</h3>
        <ul className="contract-field-list">
          {RUNTIME_JSON_CASE_FIELDS.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>

        <h3>Scoring mode (v1)</h3>
        <ul className="contract-field-list">
          {RUNTIME_JSON_SCORING_MODES.map((mode) => (
            <li key={mode}>
              <code>{mode}</code>
            </li>
          ))}
        </ul>

        <h3>Sample {RUNTIME_BENCHMARK_JSON_FILENAME}</h3>
        <pre className="contract-code-block">
          <code>{JSON.stringify(RUNTIME_BENCHMARK_JSON_ARTIFACT_EXAMPLE, null, 2)}</code>
        </pre>
      </section>

      <section className="contract-section" aria-label="Provider model execution contract">
        <h2>4) Provider/model execution contract (v1)</h2>
        <p className="subtle">
          This contract defines how Core asks a provider/model to run one benchmark prompt and how the response and
          scored result are recorded. Provider integration and execution orchestration are intentionally out of scope in
          this step.
        </p>

        <h3>Execution request fields</h3>
        <ul className="contract-field-list">
          {PROVIDER_EXECUTION_REQUEST_FIELDS.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>

        <h3>Execution response fields</h3>
        <ul className="contract-field-list">
          {PROVIDER_EXECUTION_RESPONSE_FIELDS.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>

        <h3>Execution metadata fields</h3>
        <ul className="contract-field-list">
          {PROVIDER_EXECUTION_METADATA_FIELDS.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>

        <h3>Scored model run result fields</h3>
        <ul className="contract-field-list">
          {SCORED_MODEL_RUN_RESULT_FIELDS.map((field) => (
            <li key={field}>
              <code>{field}</code>
            </li>
          ))}
        </ul>

        <h3>Sample execution request</h3>
        <pre className="contract-code-block">
          <code>{JSON.stringify(PROVIDER_EXECUTION_REQUEST_EXAMPLE, null, 2)}</code>
        </pre>

        <h3>Sample execution response</h3>
        <pre className="contract-code-block">
          <code>{JSON.stringify(PROVIDER_EXECUTION_RESPONSE_EXAMPLE, null, 2)}</code>
        </pre>

        <h3>Sample execution metadata</h3>
        <pre className="contract-code-block">
          <code>{JSON.stringify(PROVIDER_EXECUTION_METADATA_EXAMPLE, null, 2)}</code>
        </pre>

        <h3>Sample scored model run result</h3>
        <pre className="contract-code-block">
          <code>{JSON.stringify(SCORED_MODEL_RUN_RESULT_EXAMPLE, null, 2)}</code>
        </pre>
      </section>
    </main>
  );
}

