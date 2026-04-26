import Link from "next/link";
import { getAudit } from "@/lib/storage/auditStore";
import { ScoreCards } from "@/components/audit/score-cards";
import { FeatureBars } from "@/components/audit/feature-bars";
import { PromptResultsTable } from "@/components/audit/prompt-results-table";
import { DiagnosisPanel } from "@/components/audit/diagnosis-panel";
import { RewritePanel } from "@/components/audit/rewrite-panel";
import { CallLedgerPanel } from "@/components/audit/call-ledger-panel";

export default async function AuditResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const audit = getAudit(id);
  if (!audit) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Audit not found or expired</h1>
        <p className="mt-4 text-zinc-600">
          Audits are kept in memory for 10 minutes. Run a new one.
        </p>
        <Link href="/" className="mt-6 inline-block rounded-md bg-black px-4 py-2 text-white">
          Back to form
        </Link>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-5xl p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{audit.page.title}</h1>
          <p className="text-sm text-zinc-600">
            {audit.page.url} · topic: <span className="font-medium">{audit.input.topic}</span>
          </p>
        </div>
        <Link href="/" className="rounded-md border px-3 py-1.5 text-sm">↻ Run again</Link>
      </header>
      <ScoreCards scores={audit.scores} />
      <div className="grid gap-6 md:grid-cols-2">
        <DiagnosisPanel items={audit.diagnosis} />
        <RewritePanel
          rewrite={audit.rewrite}
          originalIntro={audit.page.paragraphs[0] ?? ""}
        />
      </div>
      <FeatureBars features={audit.features} />
      <PromptResultsTable rows={audit.aggregated} />
      <CallLedgerPanel ledger={audit.ledger} totals={audit.totals} />
    </main>
  );
}
