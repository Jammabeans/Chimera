import { OPENAI_STATEFUL_TOOLS_BASELINE_CONFIG } from "@/repair_lab/runners/openaiStatefulToolsRunner";
import { RepairLabSmokeClient } from "./RepairLabSmokeClient";

export default function RepairLabSmokePage() {
  return (
    <main className="container">
      <h1>Repair Lab — OpenAI Stateful Tools Smoke Test</h1>
      <p className="subtle">
        Internal harness for one explicit live baseline run through seeded deterministic stateful-tools tasks. Model prose is not
        the correctness oracle; the hard verifier result is authoritative.
      </p>

      <RepairLabSmokeClient baseline={OPENAI_STATEFUL_TOOLS_BASELINE_CONFIG} />
    </main>
  );
}

