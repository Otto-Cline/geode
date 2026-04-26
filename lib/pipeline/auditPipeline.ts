// lib/pipeline/auditPipeline.ts
import { randomUUID } from "node:crypto";
import type { AuditInput, AuditResponse } from "@/lib/models/audit";
import { fetchPage } from "@/lib/ingest/fetchPage";
import { extractFeatures } from "@/lib/features/extractFeatures";
import { computeComposites } from "@/lib/features/scoreFeatures";
import { runPromptTrials } from "@/lib/evaluation/runPromptTrials";
import { aggregateResults } from "@/lib/evaluation/aggregateResults";
import { computeScores } from "@/lib/evaluation/scoring";
import { diagnoseAudit } from "@/lib/diagnosis/diagnoseAudit";
import { generateRecommendations } from "@/lib/rewrite/generateRecommendations";
import { CallLedger } from "@/lib/llm/ledger";
import { createLlmClient } from "@/lib/llm/client";

export async function runAuditPipeline(input: AuditInput): Promise<AuditResponse> {
  const ledger = new CallLedger();
  const page = await fetchPage(input.url);
  const features = extractFeatures(page, input.topic);
  const composites = computeComposites(features);

  const llm = await createLlmClient({ ledger, context: { features } });
  const trials = await runPromptTrials({
    llm,
    page,
    prompts: input.prompts,
    runsPerPrompt: input.runsPerPrompt,
  });
  const aggregated = aggregateResults(trials);
  const scores = computeScores({ features, composites, aggregated });
  const diagnosis = diagnoseAudit(features, aggregated, scores);
  const rewrite = await generateRecommendations({
    llm,
    page,
    diagnosis,
    features,
  });

  return {
    auditId: randomUUID(),
    input,
    page,
    features,
    composites,
    trials,
    aggregated,
    scores,
    diagnosis,
    rewrite,
    ledger: ledger.list(),
    totals: ledger.totals(),
    createdAt: new Date().toISOString(),
  };
}
