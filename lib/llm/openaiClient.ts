// lib/llm/openaiClient.ts
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type {
  LlmClient,
  LlmCompleteArgs,
  LlmCompleteResult,
  LlmFactoryDeps,
  LlmModel,
} from "./client";

const MODEL_IDS: Record<LlmModel, string> = {
  fast: "gpt-5-mini",
  smart: "gpt-5",
};

// Cost estimates (USD per 1K tokens) — placeholder values; verify against
// OpenAI pricing page at runtime if accuracy matters. These are only used for
// the call-ledger display and have no effect on behaviour.
const COST_PER_1K: Record<LlmModel, { in: number; out: number }> = {
  fast: { in: 0.0003, out: 0.0012 },
  smart: { in: 0.005, out: 0.015 },
};

export class OpenAiLlmClient implements LlmClient {
  private client: OpenAI;
  constructor(private deps: LlmFactoryDeps) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
    this.client = new OpenAI({ apiKey: key });
  }

  async complete<T>(args: LlmCompleteArgs<T>): Promise<LlmCompleteResult<T>> {
    const start = Date.now();
    const completion = await this.client.chat.completions.parse({
      model: MODEL_IDS[args.model],
      temperature: args.temperature ?? 0.5,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      response_format: zodResponseFormat(args.schema, args.purpose),
    });
    const latencyMs = Date.now() - start;
    const parsed = completion.choices[0]?.message?.parsed as T | null;
    if (!parsed) throw new Error(`OpenAI returned no parsed payload for ${args.purpose}`);
    const tokensIn = completion.usage?.prompt_tokens ?? 0;
    const tokensOut = completion.usage?.completion_tokens ?? 0;
    const cost = COST_PER_1K[args.model];
    const costEstimateUsd = (tokensIn * cost.in + tokensOut * cost.out) / 1000;
    this.deps.ledger.record({
      model: args.model,
      purpose: args.purpose,
      latencyMs,
      tokensIn,
      tokensOut,
      costEstimateUsd,
    });
    return {
      data: parsed,
      usage: { tokensIn, tokensOut, costEstimateUsd },
      latencyMs,
    };
  }
}
