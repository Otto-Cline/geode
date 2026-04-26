import { describe, it, expect } from "vitest";
import { extractFeatures } from "@/lib/features/extractFeatures";
import type { ExtractedPage } from "@/lib/models/audit";

const base: ExtractedPage = {
  url: "https://example.com/x",
  title: "Best CRM for Small Teams",
  headings: [
    { level: 2, text: "Overview" },
    { level: 3, text: "Pricing" },
  ],
  paragraphs: [
    "Choosing the best CRM for small teams comes down to fit, price, and onboarding speed. Below we compare three leading options across pricing, ease of use, and integrations, with concrete numbers from recent surveys. We also flag the tradeoffs each option makes.",
    "According to a 2024 survey, 68% of small teams chose a CRM based on pricing. Most teams reported a payback period of 3 months.",
  ],
  lists: [["A", "B", "C"]],
  tables: [],
  outboundLinkCount: 5,
  sameDomainLinkCount: 5,
  fullText: "",
};
base.fullText = base.paragraphs.join("\n\n");

describe("extractFeatures", () => {
  it("returns all 10 features in [0,1]", () => {
    const f = extractFeatures(base, "best CRM");
    for (const v of Object.values(f)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(Object.keys(f)).toHaveLength(10);
  });

  it("scores intro summary present", () => {
    const f = extractFeatures(base, "best CRM");
    expect(f.hasIntroSummary).toBe(1);
  });

  it("detects topic terms in entity clarity", () => {
    const f = extractFeatures(base, "best CRM");
    expect(f.entityClarityScore).toBeGreaterThan(0.5);
  });

  it("counts statistics", () => {
    const f = extractFeatures(base, "best CRM");
    expect(f.statisticsDensity).toBeGreaterThan(0);
  });

  it("returns 0 entity clarity for unrelated topic", () => {
    const f = extractFeatures(base, "quantum computing");
    expect(f.entityClarityScore).toBe(0);
  });
});
