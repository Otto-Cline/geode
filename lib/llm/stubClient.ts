import type {
  LlmClient,
  LlmCompleteArgs,
  LlmCompleteResult,
  LlmFactoryDeps,
} from "./client";
import { TrialResultSchema, RewriteResultSchema } from "@/lib/models/audit";
import { seededRng, clamp01 } from "@/lib/utils/stats";

export class StubLlmClient implements LlmClient {
  constructor(private deps: LlmFactoryDeps) {}

  async complete<T>(args: LlmCompleteArgs<T>): Promise<LlmCompleteResult<T>> {
    const start = Date.now();
    let data: unknown;
    if (args.schema === TrialResultSchema) {
      data = this.fakeTrial(args.purpose);
    } else if (args.schema === RewriteResultSchema) {
      data = this.fakeRewrite();
    } else {
      // Generic fallback: try to satisfy schema with a best-effort empty value.
      data = args.schema.parse({});
    }
    const parsed = args.schema.parse(data) as T;
    const latencyMs = 4 + Math.floor(Math.random() * 6);
    const usage = { tokensIn: 0, tokensOut: 0, costEstimateUsd: 0 };
    this.deps.ledger.record({
      model: "stub",
      purpose: args.purpose,
      latencyMs,
      ...usage,
    });
    return { data: parsed, usage, latencyMs: Date.now() - start + latencyMs };
  }

  private fakeTrial(purpose: string) {
    const f = this.deps.context?.features ?? {};
    const rng = seededRng(purpose); // purpose includes "trial:<prompt>:<runIndex>"
    const featureReadiness = clamp01(
      0.3 * (f.hasIntroSummary ?? 0.5) +
        0.2 * (f.statisticsDensity ?? 0.5) +
        0.2 * (f.listDensity ?? 0.5) +
        0.15 * (f.authoritySignalDensity ?? 0.5) +
        0.15 * (f.entityClarityScore ?? 0.5),
    );
    const jitter = (rng() - 0.5) * 0.25;
    const mentionProb = clamp01(0.3 + 0.4 * featureReadiness + jitter);
    const evidenceProb = clamp01(
      mentionProb * (0.5 + 0.5 * (f.statisticsDensity ?? 0.5)),
    );
    const prominenceScore = clamp01(
      0.2 +
        0.6 * (f.hasIntroSummary ?? 0.5) +
        0.2 * (f.listDensity ?? 0.5) +
        (rng() - 0.5) * 0.2,
    );
    return {
      mentioned: rng() < mentionProb,
      evidenceUsed: rng() < evidenceProb,
      prominenceScore,
      notes:
        prominenceScore > 0.6
          ? "Strong intro and clear topic focus."
          : "Weaker structure; would only appear as a secondary mention.",
    };
  }

  private fakeRewrite() {
    return {
      revisedIntro:
        "[stub] A focused 2-sentence summary of the page's main claim and audience, written for an answer engine to lift verbatim.",
      bulletBlock: [
        "[stub] Key fact 1 with a concrete number.",
        "[stub] Key fact 2 with a clear comparison.",
        "[stub] Key fact 3 referencing a credible source.",
      ],
      faqBlock: [
        { q: "[stub] What is this page about?", a: "[stub] One-sentence answer." },
        { q: "[stub] Who is it for?", a: "[stub] One-sentence answer." },
      ],
    };
  }
}
