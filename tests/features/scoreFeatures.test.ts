import { describe, it, expect } from "vitest";
import { computeComposites, featureReadinessScore } from "@/lib/features/scoreFeatures";
import type { PageFeatures } from "@/lib/models/audit";

const f: PageFeatures = {
  hasIntroSummary: 1,
  headingDepthScore: 1,
  listDensity: 0.5,
  contentLengthScore: 1,
  statisticsDensity: 0.6,
  authoritySignalDensity: 0.4,
  externalSourceSignal: 0.5,
  technicalTermDensity: 0.7,
  readabilityScore: 0.8,
  entityClarityScore: 1,
};

describe("composites", () => {
  it("computes all five factors in [0,1]", () => {
    const c = computeComposites(f);
    for (const v of Object.values(c)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("featureReadinessScore is high for high inputs", () => {
    const c = computeComposites(f);
    expect(featureReadinessScore(c, f)).toBeGreaterThan(0.7);
  });
});
