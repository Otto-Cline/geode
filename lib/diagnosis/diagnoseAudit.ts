import type {
  AggregatedPromptResult,
  AuditScores,
  DiagnosisItem,
  PageFeatures,
} from "@/lib/models/audit";
import { mean } from "@/lib/utils/stats";

type Rule = (
  f: PageFeatures,
  ag: AggregatedPromptResult[],
  s: AuditScores,
) => DiagnosisItem | null;

const rules: Rule[] = [
  (f) =>
    f.hasIntroSummary < 0.5 && f.entityClarityScore < 0.4
      ? {
          label: "Weak extractability",
          severity: "high",
          explanation:
            "No clear intro summary and the topic isn't restated up top, so an answer engine can't lift a self-contained snippet.",
        }
      : null,
  (f, ag) => {
    const evid = mean(ag.map((a) => a.evidenceUseRate));
    return f.statisticsDensity < 0.2 && evid < 0.3
      ? {
          label: "Insufficient factual grounding",
          severity: "high",
          explanation:
            "Few numbers, percentages, or specific claims. Pages with concrete stats get cited as evidence more often.",
        }
      : null;
  },
  (f, ag) => {
    const prom = mean(ag.map((a) => a.avgProminence));
    return f.listDensity < 0.15 && prom < 0.4
      ? {
          label: "Poor chunkability",
          severity: "medium",
          explanation:
            "Content is mostly long prose. Bullets, tables, and short lists are easier for answer engines to lift verbatim.",
        }
      : null;
  },
  (f) =>
    f.authoritySignalDensity < 0.15
      ? {
          label: "Weak trust/corroboration cues",
          severity: "medium",
          explanation:
            "Few mentions of studies, surveys, or named experts. Authority signals make a page more quotable.",
        }
      : null,
  (_, ag) => {
    const v = mean(ag.map((a) => a.variance));
    return v > 0.06
      ? {
          label: "Narrow topic coverage / low robustness",
          severity: "medium",
          explanation:
            "Performance varies a lot across prompts and reruns. The page likely answers some queries well but fails on adjacent ones.",
        }
      : null;
  },
  (f) =>
    f.contentLengthScore < 0.4
      ? {
          label: "Content thinness",
          severity: "low",
          explanation:
            "Page is short relative to the topic. Longer, well-structured pages tend to surface more reliably.",
        }
      : null,
  (f) =>
    f.headingDepthScore < 0.4
      ? {
          label: "Flat structure",
          severity: "low",
          explanation:
            "Few or no h2/h3 headings. Hierarchical structure helps answer engines locate sub-topics.",
        }
      : null,
];

export function diagnoseAudit(
  features: PageFeatures,
  aggregated: AggregatedPromptResult[],
  scores: AuditScores,
): DiagnosisItem[] {
  const found = rules
    .map((r) => r(features, aggregated, scores))
    .filter((x): x is DiagnosisItem => x !== null);
  const order = { high: 0, medium: 1, low: 2 } as const;
  found.sort((a, b) => order[a.severity] - order[b.severity]);
  return found.slice(0, 5);
}
