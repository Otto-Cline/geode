import type { AuditScores } from "@/lib/models/audit";
import { InfoTip } from "./info-tip";

const cards: { key: keyof AuditScores; label: string; tip: string }[] = [
  {
    key: "geoReadinessScore",
    label: "GEO Readiness",
    tip: "Overall score (0–100). Weighted composite: 50% Visibility + 20% Stability + 30% Feature Readiness.",
  },
  {
    key: "visibilityScore",
    label: "Visibility",
    tip: "How often this page would be selected, cited, or featured prominently across simulated answer-engine trials.",
  },
  {
    key: "stabilityScore",
    label: "Stability",
    tip: "Consistency of performance across repeated trials. High = robust to phrasing variation; low = brittle.",
  },
  {
    key: "featureReadinessScore",
    label: "Feature Readiness",
    tip: "Composite score from 10 page-level features (structure, factual density, etc) — independent of trial outcomes.",
  },
];

function tone(v: number): string {
  if (v < 0.4) return "bg-red-50 text-red-900";
  if (v < 0.7) return "bg-amber-50 text-amber-900";
  return "bg-green-50 text-green-900";
}

export function ScoreCards({ scores }: { scores: AuditScores }) {
  return (
    <section>
      <p className="mb-3 text-sm text-zinc-600">
        Four headline scores summarising how recommendation-ready this page is for AI answer engines.
        GEO Readiness is the overall composite; the others are its components.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.key} className={`rounded-lg p-4 ${tone(scores[c.key])}`}>
            <div className="flex items-center gap-1.5">
              <div className="text-xs uppercase tracking-wide opacity-70">{c.label}</div>
              <InfoTip text={c.tip} />
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {(scores[c.key] * 100).toFixed(0)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
