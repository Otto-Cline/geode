import type { PageFeatures } from "@/lib/models/audit";
import { InfoTip } from "./info-tip";

const FEATURE_TIPS: Record<keyof PageFeatures, { label: string; tip: string }> = {
  hasIntroSummary: {
    label: "Intro summary",
    tip: "Does the lead paragraph stand alone (40–250 words, no question heading above it)? Answer engines often lift the first paragraph verbatim.",
  },
  headingDepthScore: {
    label: "Heading depth",
    tip: "Hierarchical heading structure (h2 + h3) helps engines locate sub-topics. Flat pages (h1 only) score low.",
  },
  listDensity: {
    label: "List density",
    tip: "Ratio of bullet/table content to total content blocks. Lists are easier to lift verbatim than long prose.",
  },
  contentLengthScore: {
    label: "Content length",
    tip: "Word count, peaked at 800–2500. Too short feels thin; too long is harder to summarise cleanly.",
  },
  statisticsDensity: {
    label: "Statistics density",
    tip: "Density of percentages, dollar figures, scaled numbers, and years per 100 words. Concrete numbers get cited more.",
  },
  authoritySignalDensity: {
    label: "Authority signals",
    tip: 'Mentions of "according to," studies, surveys, named experts (Dr/Prof). Authority cues improve quotability.',
  },
  externalSourceSignal: {
    label: "External sources",
    tip: "Share of links pointing to other domains. Pages that cite outside sources are seen as more trustworthy.",
  },
  technicalTermDensity: {
    label: "Topic term density",
    tip: "How often topic-relevant terms appear per 100 words. Higher = clearer topical focus on the chosen topic.",
  },
  readabilityScore: {
    label: "Readability",
    tip: "Flesch reading ease, mapped to 0..1 with peak around 60–70. Too dense or too simple both hurt.",
  },
  entityClarityScore: {
    label: "Entity clarity",
    tip: "Does the title and lead paragraph restate the topic? Answer engines need the entity stated up top.",
  },
};

export function FeatureBars({ features }: { features: PageFeatures }) {
  return (
    <section className="rounded-lg border p-4">
      <header className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Page features</h2>
        <InfoTip text="Ten interpretable page-level signals that correlate with how easily an answer engine can lift content from this page. Each is 0..1 (higher is better). Hover any row for what it measures." />
      </header>
      <p className="mb-4 text-xs text-zinc-600">
        Deterministic heuristics computed from page structure and content — no LLM involved. These drive the Feature Readiness score and feed the diagnosis rules.
      </p>
      <ul className="space-y-2 text-sm">
        {(Object.keys(FEATURE_TIPS) as (keyof PageFeatures)[]).map((k) => {
          const v = features[k];
          const { label, tip } = FEATURE_TIPS[k];
          return (
            <li key={k} className="flex items-center gap-3">
              <div className="flex w-44 items-center gap-1.5">
                <span className="text-xs">{label}</span>
                <InfoTip text={tip} />
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-200">
                <div className="h-full bg-zinc-700" style={{ width: `${v * 100}%` }} />
              </div>
              <span className="w-10 text-right tabular-nums">{v.toFixed(2)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
