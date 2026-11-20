// The ONE swap point for the result screen. The UI imports only these two functions (and
// types) from "@/lib/mock". In Phase 2 they are replaced by real services with the same
// signatures; the UI does not change.
//
// Privacy: the mock never receives or reads the user's CV or job text, and it never logs.
// getMockCoverLetterDraft receives only the cover letter answers (which may be personal data).

import { buildCoverLetter, mockResult } from "@/lib/mock/mock-data";
import type { Result } from "@/lib/result";
import type {
  CoverLetterAnswers,
  MockResult,
  ResultError,
} from "@/lib/result/types";

export type * from "@/lib/result/types";

type Options = {
  delayMs?: number; // tests pass 0 so they run instantly
  fail?: boolean; // lets the UI show its error state
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// `resultId` is accepted and ignored. In Phase 2 a result is addressed by an id and stored
// server-side; keeping the parameter now means the callers will not change.
export async function getMockResult(
  resultId?: string,
  options: Options = {},
): Promise<Result<MockResult, ResultError>> {
  void resultId;
  await wait(options.delayMs ?? 1500); // simulates the model's thinking time
  if (options.fail) return { ok: false, error: { category: "unavailable" } };
  // structuredClone: a fresh copy each call, so a caller cannot change the module's data.
  return { ok: true, value: structuredClone(mockResult) };
}

export async function getMockCoverLetterDraft(
  answers: CoverLetterAnswers,
  options: Pick<Options, "delayMs"> = {},
): Promise<Result<string, ResultError>> {
  await wait(options.delayMs ?? 400);
  return { ok: true, value: buildCoverLetter(answers) };
}
