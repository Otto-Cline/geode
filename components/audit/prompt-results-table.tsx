import type { AggregatedPromptResult } from "@/lib/models/audit";

export function PromptResultsTable({ rows }: { rows: AggregatedPromptResult[] }) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-semibold">Prompt results</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="py-1 pr-4">Prompt</th>
            <th className="py-1 pr-4">Mentions</th>
            <th className="py-1 pr-4">Evidence</th>
            <th className="py-1 pr-4">Prominence</th>
            <th className="py-1">Var.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.prompt} className="border-t">
              <td className="py-1 pr-4">{r.prompt}</td>
              <td className="py-1 pr-4 tabular-nums">{(r.mentionRate * 100).toFixed(0)}%</td>
              <td className="py-1 pr-4 tabular-nums">{(r.evidenceUseRate * 100).toFixed(0)}%</td>
              <td className="py-1 pr-4 tabular-nums">{r.avgProminence.toFixed(2)}</td>
              <td className="py-1 tabular-nums">{r.variance.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
