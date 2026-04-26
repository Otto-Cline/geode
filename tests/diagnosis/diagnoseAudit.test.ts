import { describe, it, expect } from "vitest";
import { diagnoseAudit } from "@/lib/diagnosis/diagnoseAudit";

const goodFeatures = {
  hasIntroSummary: 1,
  headingDepthScore: 1,
  listDensity: 0.5,
  contentLengthScore: 1,
  statisticsDensity: 0.7,
  authoritySignalDensity: 0.5,
  externalSourceSignal: 0.5,
  technicalTermDensity: 0.7,
  readabilityScore: 0.8,
  entityClarityScore: 1,
};

const goodAg = [
  {
    prompt: "p",
    mentionRate: 0.9,
    evidenceUseRate: 0.7,
    avgProminence: 0.8,
    variance: 0.01,
  },
];

const goodScores = {
  visibilityScore: 0.8,
  stabilityScore: 0.95,
  featureReadinessScore: 0.9,
  geoReadinessScore: 0.85,
};

describe("diagnoseAudit", () => {
  it("returns no issues for a strong page", () => {
    expect(diagnoseAudit(goodFeatures, goodAg, goodScores)).toHaveLength(0);
  });

  it("flags weak extractability", () => {
    const f = { ...goodFeatures, hasIntroSummary: 0, entityClarityScore: 0.1 };
    const out = diagnoseAudit(f, goodAg, goodScores);
    expect(
      out.some(
        (d) => d.label === "Weak extractability" && d.severity === "high"
      )
    ).toBe(true);
  });

  it("returns at most 5 items, sorted by severity", () => {
    const f = {
      hasIntroSummary: 0,
      headingDepthScore: 0.1,
      listDensity: 0,
      contentLengthScore: 0.2,
      statisticsDensity: 0,
      authoritySignalDensity: 0,
      externalSourceSignal: 0,
      technicalTermDensity: 0,
      readabilityScore: 0.5,
      entityClarityScore: 0,
    };
    const out = diagnoseAudit(
      f,
      [
        {
          prompt: "p",
          mentionRate: 0,
          evidenceUseRate: 0,
          avgProminence: 0,
          variance: 0.1,
        },
      ],
      goodScores
    );
    expect(out.length).toBeLessThanOrEqual(5);
    if (out.length > 1) {
      const order = { high: 0, medium: 1, low: 2 } as const;
      for (let i = 1; i < out.length; i++) {
        expect(order[out[i - 1].severity]).toBeLessThanOrEqual(
          order[out[i].severity]
        );
      }
    }
  });
});
