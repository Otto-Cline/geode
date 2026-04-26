import type { AggregatedPromptResult } from "@/lib/models/audit";
import { InfoTip } from "./info-tip";

export function PromptResultsTable({
  rows,
}: {
  rows: AggregatedPromptResult[];
}) {
  return (
    <section className="rounded-lg border p-4">
      <header className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Prompt results</h2>
        <InfoTip text="Each prompt was sent to the model multiple times. The columns aggregate across runs, so high mention/evidence rates with low variance signal robust visibility." />
      </header>
      <p className="mb-3 text-xs text-zinc-600">
        For each prompt we ran independent trials and aggregated. High variance
        suggests the page answers some queries well but is brittle on adjacent
        ones.
      </p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="py-1 pr-4">Prompt</th>
            <th className="py-1 pr-4">
              <span className="inline-flex items-center gap-1">
                Mentions
                <InfoTip text="Share of trials where the page appeared in the answer at all." />
              </span>
            </th>
            <th className="py-1 pr-4">
              <span className="inline-flex items-center gap-1">
                Evidence
                <InfoTip text="Share of trials where a specific fact, number, or quote from the page was cited." />
              </span>
            </th>
            <th className="py-1 pr-4">
              <span className="inline-flex items-center gap-1">
                Prominence
                <InfoTip text="Average centrality (0..1). 1 = lead source; 0 = footnote at best. Averaged across runs." />
              </span>
            </th>
            <th className="py-1">
              <span className="inline-flex items-center gap-1">
                Spread
                <InfoTip text="Standard deviation of prominence across runs, on the same 0..1 scale as the prominence column. Higher = the page's performance flips between runs (brittle). 0.00 = identical every run." />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.prompt} className="border-t">
              <td className="py-1 pr-4">{r.prompt}</td>
              <td className="py-1 pr-4 tabular-nums">
                {(r.mentionRate * 100).toFixed(0)}%
              </td>
              <td className="py-1 pr-4 tabular-nums">
                {(r.evidenceUseRate * 100).toFixed(0)}%
              </td>
              <td className="py-1 pr-4 tabular-nums">
                {r.avgProminence.toFixed(2)}
              </td>
              <td className="py-1 tabular-nums">{Math.sqrt(r.variance).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
