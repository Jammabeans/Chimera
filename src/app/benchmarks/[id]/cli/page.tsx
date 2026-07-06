import Link from "next/link";
import { notFound } from "next/navigation";

import { getBenchmarkById } from "@/core/registry/getBenchmarkById";
import { parseBenchmarkCliDescribeMetadata, runBenchmarkCliDescribe } from "@/core/runner/runBenchmarkCachedCli";

import { GenericCliClient } from "./GenericCliClient";

interface BenchmarkGenericCliPageProps {
  params: {
    id: string;
  };
}

export default function BenchmarkGenericCliPage({ params }: BenchmarkGenericCliPageProps) {
  const benchmark = getBenchmarkById(params.id);
  if (!benchmark) {
    notFound();
  }

  const describeResult = runBenchmarkCliDescribe(benchmark.id);

  return (
    <main className="container">
      <p>
        <Link href={`/benchmarks/${benchmark.id}`}>← Back to benchmark detail</Link>
      </p>

      <h1>Generic Benchmark CLI Route</h1>
      <p className="subtle">
        Generic CLI flow powered by benchmark <code>describe</code> metadata. This route does not run provider execution.
      </p>

      <section>
        <h2>Benchmark</h2>
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
            <dt>Cache path</dt>
            <dd>
              <code>{`benchmarks-cache/${benchmark.id}`}</code>
            </dd>
          </div>
        </dl>
      </section>

      {!describeResult.ok ? (
        <section className="run-panel">
          <h2>CLI unavailable</h2>
          <p className="history-warning" role="status">
            {describeResult.message}
          </p>
        </section>
      ) : (
        (() => {
          const describeMetadata = parseBenchmarkCliDescribeMetadata(benchmark.id, describeResult.data);

          return (
            <>
              <section className="run-panel">
                <h2>Describe metadata</h2>
                <dl className="benchmark-detail-list">
                  <div>
                    <dt>Display name</dt>
                    <dd>{describeMetadata.displayName || "(empty)"}</dd>
                  </div>
                  <div>
                    <dt>Description</dt>
                    <dd>{describeMetadata.description || "(empty)"}</dd>
                  </div>
                  <div>
                    <dt>Contract version</dt>
                    <dd>
                      <code>{describeMetadata.contractVersion}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Supports generate</dt>
                    <dd>{describeMetadata.supportsGenerate ? "yes" : "no"}</dd>
                  </div>
                  <div>
                    <dt>Supports score</dt>
                    <dd>{describeMetadata.supportsScore ? "yes" : "no"}</dd>
                  </div>
                  <div>
                    <dt>Supports analyze</dt>
                    <dd>{describeMetadata.supportsAnalyze ? "yes" : "no"}</dd>
                  </div>
                  <div>
                    <dt>Generate field count</dt>
                    <dd>{describeMetadata.generateFields.length}</dd>
                  </div>
                </dl>
              </section>

              <GenericCliClient benchmarkId={benchmark.id} describeMetadata={describeMetadata} />
            </>
          );
        })()
      )}
    </main>
  );
}
