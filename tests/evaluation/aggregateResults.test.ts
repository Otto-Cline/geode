import { describe, it, expect } from "vitest";
import { aggregateResults } from "@/lib/evaluation/aggregateResults";

describe("aggregateResults", () => {
  it("aggregates per prompt", () => {
    const out = aggregateResults([
      { prompt: "p1", runIndex: 0, mentioned: true, evidenceUsed: true, prominenceScore: 0.8, notes: "" },
      { prompt: "p1", runIndex: 1, mentioned: false, evidenceUsed: false, prominenceScore: 0.4, notes: "" },
      { prompt: "p2", runIndex: 0, mentioned: true, evidenceUsed: false, prominenceScore: 0.6, notes: "" },
    ]);
    expect(out).toHaveLength(2);
    const p1 = out.find((r) => r.prompt === "p1")!;
    expect(p1.mentionRate).toBe(0.5);
    expect(p1.evidenceUseRate).toBe(0.5);
    expect(p1.avgProminence).toBeCloseTo(0.6);
    expect(p1.variance).toBeGreaterThan(0);
    const p2 = out.find((r) => r.prompt === "p2")!;
    expect(p2.mentionRate).toBe(1);
    expect(p2.variance).toBe(0);
  });
});
