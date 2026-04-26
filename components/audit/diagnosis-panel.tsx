import type { DiagnosisItem } from "@/lib/models/audit";

const tone: Record<DiagnosisItem["severity"], string> = {
  high: "bg-red-50 text-red-900 border-red-200",
  medium: "bg-amber-50 text-amber-900 border-amber-200",
  low: "bg-zinc-50 text-zinc-900 border-zinc-200",
};

export function DiagnosisPanel({ items }: { items: DiagnosisItem[] }) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-semibold">Diagnosis</h2>
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
    </div>
  );
}
