import { NextResponse } from "next/server";
import { AuditInputSchema } from "@/lib/models/audit";
import { runAuditPipeline } from "@/lib/pipeline/auditPipeline";
import { putAudit } from "@/lib/storage/auditStore";

export const runtime = "nodejs"; // jsdom + readability need Node, not Edge.
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = AuditInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const audit = await runAuditPipeline(parsed.data);
    putAudit(audit);
    return NextResponse.json({ auditId: audit.auditId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "audit failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
