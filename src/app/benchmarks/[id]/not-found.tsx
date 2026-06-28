import Link from "next/link";

export default function BenchmarkNotFoundPage() {
  return (
    <main className="container">
      <h1>Benchmark Not Found</h1>
      <p className="subtle">
        The requested benchmark ID is not in the current static registry.
      </p>
      <p>
        <Link href="/">Return to benchmark registry</Link>
      </p>
    </main>
  );
}

