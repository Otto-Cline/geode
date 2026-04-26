// lib/llm/client.ts
import type { ZodType } from "zod";
import type { CallLedger } from "@/lib/llm/ledger";

export type LlmModel = "fast" | "smart";

export type LlmCompleteArgs<T> = {
  system: string;
  user: string;
  schema: ZodType<T>;
  model: LlmModel;
  purpose: string;
  temperature?: number;
};

export type LlmCompleteResult<T> = {
  data: T;
  usage: { tokensIn: number; tokensOut: number; costEstimateUsd: number };
  latencyMs: number;
};

export interface LlmClient {
  complete<T>(args: LlmCompleteArgs<T>): Promise<LlmCompleteResult<T>>;
}

export type LlmFactoryDeps = {
  ledger: CallLedger;
  // Used by the stub to make outputs feature-correlated.
  context?: { features?: Record<string, number> };
};

export async function createLlmClient(deps: LlmFactoryDeps): Promise<LlmClient> {
  const provider = process.env.LLM_PROVIDER ?? "stub";
  if (provider === "openai") {
    const { OpenAiLlmClient } = await import("./openaiClient");
    return new OpenAiLlmClient(deps);
  }
  const { StubLlmClient } = await import("./stubClient");
  return new StubLlmClient(deps);
}
