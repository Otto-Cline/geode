import type { LlmClient } from "@/lib/llm/client";
import type { ExtractedPage, PromptTrialResult } from "@/lib/models/audit";
import { TrialResultSchema } from "@/lib/models/audit";
import {
  TRIAL_SYSTEM_PROMPT,
  buildTrialUserPrompt,
} from "@/lib/prompts/systemPrompts";
import { truncateAtParagraph } from "@/lib/utils/text";

export async function runPromptTrials(args: {
  llm: LlmClient;
  page: ExtractedPage;
  prompts: string[];
  runsPerPrompt: number;
}): Promise<PromptTrialResult[]> {
  const truncated = truncateAtParagraph(args.page.fullText, 3500);
  const out: PromptTrialResult[] = [];
  for (const prompt of args.prompts) {
    for (let runIndex = 0; runIndex < args.runsPerPrompt; runIndex++) {
      const purpose = `trial:${prompt}:${runIndex}`;
      const res = await args.llm.complete({
        system: TRIAL_SYSTEM_PROMPT,
        user: buildTrialUserPrompt({
          prompt,
          url: args.page.url,
          title: args.page.title,
          truncatedText: truncated,
        }),
        schema: TrialResultSchema,
        model: "fast",
        purpose,
        temperature: 1,
      });
      out.push({ ...res.data, prompt, runIndex });
    }
  }
  return out;
}
