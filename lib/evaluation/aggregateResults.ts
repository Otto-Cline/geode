import type { AggregatedPromptResult, PromptTrialResult } from "@/lib/models/audit";
import { mean, variance } from "@/lib/utils/stats";

export function aggregateResults(trials: PromptTrialResult[]): AggregatedPromptResult[] {
  const byPrompt = new Map<string, PromptTrialResult[]>();
  for (const t of trials) {
    const arr = byPrompt.get(t.prompt) ?? [];
    arr.push(t);
    byPrompt.set(t.prompt, arr);
  }
  return Array.from(byPrompt.entries()).map(([prompt, ts]) => {
    const proms = ts.map((t) => t.prominenceScore);
    return {
      prompt,
      mentionRate: ts.filter((t) => t.mentioned).length / ts.length,
      evidenceUseRate: ts.filter((t) => t.evidenceUsed).length / ts.length,
      avgProminence: mean(proms),
      variance: variance(proms),
    };
  });
}
