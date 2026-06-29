import type { RuntimeBenchmarkScoreResult } from "@/types/runtimeBenchmarkContract";
import type { RuntimeBenchmarkJsonArtifact } from "@/types/runtimeBenchmarkJsonContract";

export function scoreRuntimeBenchmarkCase(
  artifact: RuntimeBenchmarkJsonArtifact,
  caseId: string,
  answerText: string,
): RuntimeBenchmarkScoreResult {
  if (artifact.scoringMode !== "exact-text") {
    return {
      correct: false,
      score: 0,
      expectedAnswer: "",
      message: `Unsupported scoring mode: ${artifact.scoringMode}`,
    };
  }

  const benchmarkCase = artifact.cases.find((item) => item.id === caseId);

  if (!benchmarkCase) {
    return {
      correct: false,
      score: 0,
      expectedAnswer: "",
      message: "Selected case was not found.",
    };
  }

  const correct = answerText === benchmarkCase.expectedAnswer;

  return {
    correct,
    score: correct ? 1 : 0,
    expectedAnswer: benchmarkCase.expectedAnswer,
    message: correct ? "Correct answer." : "Incorrect answer.",
  };
}

