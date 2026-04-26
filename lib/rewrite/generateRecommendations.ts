import type { LlmClient } from "@/lib/llm/client";
import type {
  DiagnosisItem,
  ExtractedPage,
  PageFeatures,
  RewriteResult,
} from "@/lib/models/audit";
import { RewriteResultSchema } from "@/lib/models/audit";
import {
  REWRITE_SYSTEM_PROMPT,
  buildRewriteUserPrompt,
} from "@/lib/prompts/systemPrompts";
import { truncateAtParagraph } from "@/lib/utils/text";

export async function generateRecommendations(args: {
  llm: LlmClient;
  page: ExtractedPage;
  diagnosis: DiagnosisItem[];
  features: PageFeatures;
}): Promise<RewriteResult> {
  const targets = pickTargetFeatures(args.features);
  const truncated = truncateAtParagraph(args.page.fullText, 3500);
  const res = await args.llm.complete({
    system: REWRITE_SYSTEM_PROMPT,
    user: buildRewriteUserPrompt({
      url: args.page.url,
      title: args.page.title,
      truncatedText: truncated,
      diagnosis: args.diagnosis.slice(0, 3),
      targetFeatures: targets,
    }),
    schema: RewriteResultSchema,
    model: "smart",
    purpose: "rewrite",
    temperature: 0.2,
  });
  return res.data;
}

function pickTargetFeatures(f: PageFeatures): string[] {
  return Object.entries(f)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([k]) => k);
}
