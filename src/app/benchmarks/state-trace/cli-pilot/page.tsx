import Link from "next/link";
import { CliPilotClient } from "./CliPilotClient";

export default function StateTraceCliPilotPage() {

  return (
    <main className="container">
      <p>
        <Link href="/benchmarks/state-trace">← Back to benchmark detail</Link>
      </p>

      <h1>State Trace CLI Pilot</h1>
      <p className="subtle">
        Isolated pilot route for cached <code>state-trace</code> benchmark CLI orchestration only (generate + manual score).
      </p>

      <CliPilotClient />
    </main>
  );
}

