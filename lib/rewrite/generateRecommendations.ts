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

const MAX_PARAGRAPH_CHARS = 14_000; // ~3500 tokens, chars/4 heuristic

export async function generateRecommendations(args: {
  llm: LlmClient;
  page: ExtractedPage;
  diagnosis: DiagnosisItem[];
  features: PageFeatures;
}): Promise<RewriteResult> {
  const targets = pickTargetFeatures(args.features);
  const paragraphs = capParagraphs(args.page.paragraphs, MAX_PARAGRAPH_CHARS);
  const res = await args.llm.complete({
    system: REWRITE_SYSTEM_PROMPT,
    user: buildRewriteUserPrompt({
      url: args.page.url,
      title: args.page.title,
      paragraphs,
      originalIntro: paragraphs[0] ?? "",
      diagnosis: args.diagnosis.slice(0, 3),
      targetFeatures: targets,
    }),
    schema: RewriteResultSchema,
    model: "smart",
    purpose: "rewrite",
    temperature: 1,
  });
  return res.data;
}

function capParagraphs(ps: string[], maxChars: number): string[] {
  const out: string[] = [];
  let total = 0;
  for (const p of ps) {
    if (total + p.length > maxChars && out.length > 0) break;
    out.push(p);
    total += p.length;
  }
  return out;
}

function pickTargetFeatures(f: PageFeatures): string[] {
  return Object.entries(f)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([k]) => k);
}
