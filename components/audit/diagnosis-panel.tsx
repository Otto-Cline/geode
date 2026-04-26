import type { DiagnosisItem } from "@/lib/models/audit";
import { InfoTip } from "./info-tip";

const tone: Record<DiagnosisItem["severity"], string> = {
  high: "bg-red-50 text-red-900 border-red-200",
  medium: "bg-amber-50 text-amber-900 border-amber-200",
  low: "bg-zinc-50 text-zinc-900 border-zinc-200",
};

export function DiagnosisPanel({ items }: { items: DiagnosisItem[] }) {
  return (
    <section className="rounded-lg border p-4">
      <header className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Diagnosis</h2>
        <InfoTip text="Top issues identified by rule-based diagnosis from the page features and trial outcomes. Higher-severity items are the ones most likely to move scores if you address them first." />
      </header>
      <p className="mb-3 text-xs text-zinc-600">
        Up to 5 issues, sorted by severity. Each one maps to specific feature thresholds — fixing the underlying feature should resolve it.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-600">No major issues detected.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((d) => (
            <li key={d.label} className={`rounded border p-3 text-sm ${tone[d.severity]}`}>
              <div className="font-medium">
                {d.label} <span className="opacity-70">· {d.severity}</span>
              </div>
              <div className="opacity-80">{d.explanation}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
