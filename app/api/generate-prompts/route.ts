import { NextResponse } from "next/server";
import { z } from "zod";
import { CallLedger } from "@/lib/llm/ledger";
import { createLlmClient } from "@/lib/llm/client";
import { generatePrompts } from "@/lib/prompts/generatePrompts";

export const runtime = "nodejs";
export const maxDuration = 30;

const RequestSchema = z.object({
  url: z.url(),
  topic: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const ledger = new CallLedger();
    const llm = await createLlmClient({ ledger });
    const prompts = await generatePrompts({
      llm,
      url: parsed.data.url,
      topic: parsed.data.topic,
    });
    return NextResponse.json({ prompts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
