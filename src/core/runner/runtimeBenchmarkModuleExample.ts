import { EXTERNAL_BENCHMARK_MANIFEST_EXAMPLE } from "@/core/registry/externalBenchmarkManifestExample";
import type {
  RuntimeBenchmarkModule,
  RuntimeBenchmarkScoreResult,
} from "@/types/runtimeBenchmarkContract";

const EXPECTED_ANSWERS: Record<string, string> = {
  "case-basic-1": "north",
  "case-basic-2": "allowlisted",
};

function scorePlainTextAnswer(caseId: string, answerText: string): RuntimeBenchmarkScoreResult {
  const expectedAnswer = EXPECTED_ANSWERS[caseId];

  if (!expectedAnswer) {
    return {
      correct: false,
      score: 0,
      expectedAnswer: "",
      message: "Unknown benchmark case id.",
    };
  }

  const normalizedActual = answerText.trim().toLowerCase();
  const normalizedExpected = expectedAnswer.trim().toLowerCase();
  const correct = normalizedActual === normalizedExpected;

  return {
    correct,
    score: correct ? 1 : 0,
    expectedAnswer,
    message: correct ? "Correct answer." : "Incorrect answer.",
  };
}

export const RUNTIME_BENCHMARK_MODULE_EXAMPLE: RuntimeBenchmarkModule = {
  manifest: EXTERNAL_BENCHMARK_MANIFEST_EXAMPLE,
  cases: [
    {
      id: "case-basic-1",
      levelId: "basic",
      title: "Directional recall",
      prompt: "Reply with one word: north",
      metadata: {
        difficulty: "easy",
        deterministic: true,
      },
    },
    {
      id: "case-basic-2",
      levelId: "basic",
      title: "Trust mode recall",
      prompt: "Reply with one word: allowlisted",
    },
  ],
  scoreAnswer: scorePlainTextAnswer,
};

