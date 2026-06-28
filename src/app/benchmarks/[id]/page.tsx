import { getBenchmarkById } from "@/core/registry/getBenchmarkById";
import Link from "next/link";
import { notFound } from "next/navigation";

interface BenchmarkDetailPageProps {
  params: {
    id: string;
  };
}

export default function BenchmarkDetailPage({ params }: BenchmarkDetailPageProps) {
  const benchmark = getBenchmarkById(params.id);

  if (!benchmark) {
    notFound();
  }

  return (
    <main className="container">
      <p>
        <Link href="/">← Back to benchmark list</Link>
      </p>

      <h1>{benchmark.name}</h1>
      <p className="subtle">Benchmark detail from static registry entry.</p>

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
          <dt>Repo URL</dt>
          <dd>
            <a href={benchmark.repoUrl} target="_blank" rel="noreferrer">
              {benchmark.repoUrl}
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
    </main>
  );
}

