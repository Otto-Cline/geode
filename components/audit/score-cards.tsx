import type { AuditScores } from "@/lib/models/audit";

const cards: { key: keyof AuditScores; label: string }[] = [
  { key: "geoReadinessScore", label: "GEO Readiness" },
  { key: "visibilityScore", label: "Visibility" },
  { key: "stabilityScore", label: "Stability" },
  { key: "featureReadinessScore", label: "Feature Readiness" },
];

function tone(v: number): string {
  if (v < 0.4) return "bg-red-50 text-red-900";
  if (v < 0.7) return "bg-amber-50 text-amber-900";
  return "bg-green-50 text-green-900";
}

export function ScoreCards({ scores }: { scores: AuditScores }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.key} className={`rounded-lg p-4 ${tone(scores[c.key])}`}>
          <div className="text-xs uppercase tracking-wide opacity-70">{c.label}</div>
          <div className="mt-1 text-2xl font-semibold">
            {(scores[c.key] * 100).toFixed(0)}
          </div>
        </div>
      ))}
    </div>
  );
}
