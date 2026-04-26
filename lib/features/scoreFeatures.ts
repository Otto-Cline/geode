import type { CompositeFactors, PageFeatures } from "@/lib/models/audit";
import { clamp01 } from "@/lib/utils/stats";

export function computeComposites(f: PageFeatures): CompositeFactors {
  return {
    extractability: clamp01(0.6 * f.hasIntroSummary + 0.4 * f.headingDepthScore),
    factualDensity: clamp01(0.6 * f.statisticsDensity + 0.4 * f.authoritySignalDensity),
    structureChunkability: clamp01(0.6 * f.listDensity + 0.4 * f.headingDepthScore),
    authorityTrustSignals: clamp01(0.5 * f.authoritySignalDensity + 0.5 * f.externalSourceSignal),
    entityKeywordClarity: clamp01(0.6 * f.entityClarityScore + 0.4 * f.technicalTermDensity),
  };
}

export function featureReadinessScore(c: CompositeFactors, f: PageFeatures): number {
  const base =
    0.3 * c.extractability +
    0.2 * c.factualDensity +
    0.2 * c.structureChunkability +
    0.15 * c.authorityTrustSignals +
    0.15 * c.entityKeywordClarity;
  // Small adjustments from the two unmapped features.
  const adj = 0.05 * f.contentLengthScore + 0.05 * f.readabilityScore;
  return clamp01(0.9 * base + adj);
}
