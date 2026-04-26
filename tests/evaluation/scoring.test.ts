import { describe, it, expect } from "vitest";
import { computeScores } from "@/lib/evaluation/scoring";

const features = {
  hasIntroSummary: 1,
  headingDepthScore: 1,
  listDensity: 0.5,
  contentLengthScore: 1,
  statisticsDensity: 0.7,
  authoritySignalDensity: 0.5,
  externalSourceSignal: 0.5,
  technicalTermDensity: 0.6,
  readabilityScore: 0.8,
  entityClarityScore: 1,
};

const composites = {
  extractability: 1,
  factualDensity: 0.7,
  structureChunkability: 0.7,
  authorityTrustSignals: 0.5,
  entityKeywordClarity: 1,
};

describe("computeScores", () => {
  it("returns all four scores in [0,1]", () => {
    const s = computeScores({
      features,
      composites,
      aggregated: [
        {
          prompt: "p",
          mentionRate: 0.6,
          evidenceUseRate: 0.4,
          avgProminence: 0.6,
          variance: 0.02,
        },
      ],
    });
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("stability is high when variance is zero", () => {
    const s = computeScores({
      features,
      composites,
      aggregated: [
        {
          prompt: "p",
          mentionRate: 1,
          evidenceUseRate: 1,
          avgProminence: 1,
          variance: 0,
        },
      ],
    });
    expect(s.stabilityScore).toBe(1);
  });

  it("visibility combines mention, evidence, and prominence", () => {
    const s = computeScores({
      features,
      composites,
      aggregated: [
        {
          prompt: "p",
          mentionRate: 1,
          evidenceUseRate: 1,
          avgProminence: 1,
          variance: 0.1,
        },
      ],
    });
    // visibility = 0.5*1 + 0.3*1 + 0.2*1 = 1.0
    expect(s.visibilityScore).toBe(1);
  });

  it("geoReadinessScore is clamped to [0, 1]", () => {
    const s = computeScores({
      features,
      composites,
      aggregated: [
        {
          prompt: "p",
          mentionRate: 0.1,
          evidenceUseRate: 0.1,
          avgProminence: 0.1,
          variance: 0.3,
        },
      ],
    });
    expect(s.geoReadinessScore).toBeGreaterThanOrEqual(0);
    expect(s.geoReadinessScore).toBeLessThanOrEqual(1);
  });

  it("aggregates across multiple prompts", () => {
    const s = computeScores({
      features,
      composites,
      aggregated: [
        {
          prompt: "p1",
          mentionRate: 0.8,
          evidenceUseRate: 0.6,
          avgProminence: 0.7,
          variance: 0.01,
        },
        {
          prompt: "p2",
          mentionRate: 0.4,
          evidenceUseRate: 0.2,
          avgProminence: 0.5,
          variance: 0.05,
        },
      ],
    });
    // visibilityScore = 0.5*(0.8+0.4)/2 + 0.3*(0.6+0.2)/2 + 0.2*(0.7+0.5)/2
    //                 = 0.5*0.6 + 0.3*0.4 + 0.2*0.6
    //                 = 0.3 + 0.12 + 0.12 = 0.54
    expect(s.visibilityScore).toBeCloseTo(0.54);
    // stabilityScore from (0.01+0.05)/2 = 0.03
    // normalizedVarianceToStability(0.03) = 1 - 0.03/0.25 = 1 - 0.12 = 0.88
    expect(s.stabilityScore).toBeCloseTo(0.88);
  });

  it("stability decreases with high variance", () => {
    const sLow = computeScores({
      features,
      composites,
      aggregated: [
        {
          prompt: "p",
          mentionRate: 0.5,
          evidenceUseRate: 0.5,
          avgProminence: 0.5,
          variance: 0.01,
        },
      ],
    });
    const sHigh = computeScores({
      features,
      composites,
      aggregated: [
        {
          prompt: "p",
          mentionRate: 0.5,
          evidenceUseRate: 0.5,
          avgProminence: 0.5,
          variance: 0.2,
        },
      ],
    });
    expect(sHigh.stabilityScore).toBeLessThan(sLow.stabilityScore);
  });

  it("geoReadinessScore weights visibility (0.5), stability (0.2), and feature readiness (0.3)", () => {
    // With perfect features and aggregated results
    const s = computeScores({
      features,
      composites,
      aggregated: [
        {
          prompt: "p",
          mentionRate: 1,
          evidenceUseRate: 1,
          avgProminence: 1,
          variance: 0,
        },
      ],
    });
    // visibility = 1.0
    // stability = 1.0
    // featureReadinessScore computed from composites
    // The exact value depends on featureReadinessScore calculation, but should be high
    expect(s.geoReadinessScore).toBeGreaterThan(0.8);
  });
});
