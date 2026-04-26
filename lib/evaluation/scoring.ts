import type {
  AggregatedPromptResult,
  AuditScores,
  CompositeFactors,
  PageFeatures,
} from "@/lib/models/audit";
import { clamp01, mean, normalizedVarianceToStability } from "@/lib/utils/stats";
import { featureReadinessScore } from "@/lib/features/scoreFeatures";

export function computeScores(args: {
  features: PageFeatures;
  composites: CompositeFactors;
  aggregated: AggregatedPromptResult[];
}): AuditScores {
  const ag = args.aggregated;

  // Visibility: weighted average of mention, evidence use, and prominence
  const visibilityScore = clamp01(
    0.5 * mean(ag.map((a) => a.mentionRate)) +
      0.3 * mean(ag.map((a) => a.evidenceUseRate)) +
      0.2 * mean(ag.map((a) => a.avgProminence)),
  );

  // Stability: map average variance to 0–1 stability
  const stabilityScore = normalizedVarianceToStability(mean(ag.map((a) => a.variance)));

  // Feature readiness: composite-weighted feature score
  const featureReady = featureReadinessScore(args.composites, args.features);

  // GEO readiness: weighted average of visibility, stability, and feature readiness
  const geoReadinessScore = clamp01(
    0.5 * visibilityScore + 0.2 * stabilityScore + 0.3 * featureReady,
  );

  return {
    visibilityScore,
    stabilityScore,
    featureReadinessScore: featureReady,
    geoReadinessScore,
  };
}
