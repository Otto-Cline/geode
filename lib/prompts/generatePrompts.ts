import type { LlmClient } from "@/lib/llm/client";
import { GeneratedPromptsSchema } from "@/lib/models/audit";
import {
  GENERATE_PROMPTS_SYSTEM_PROMPT,
  buildGeneratePromptsUserPrompt,
} from "@/lib/prompts/systemPrompts";

export async function generatePrompts(args: {
  llm: LlmClient;
  url: string;
  topic: string;
}): Promise<string[]> {
  const res = await args.llm.complete({
    system: GENERATE_PROMPTS_SYSTEM_PROMPT,
    user: buildGeneratePromptsUserPrompt({ url: args.url, topic: args.topic }),
    schema: GeneratedPromptsSchema,
    model: "fast",
    purpose: "generate-prompts",
    temperature: 1,
  });
  return res.data.prompts;
}
