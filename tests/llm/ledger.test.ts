import { describe, it, expect } from "vitest";
import { CallLedger } from "@/lib/llm/ledger";

describe("CallLedger", () => {
  it("records and totals", () => {
    const l = new CallLedger();
    l.record({
      model: "fast",
      purpose: "trial",
      latencyMs: 100,
      tokensIn: 10,
      tokensOut: 5,
      costEstimateUsd: 0.001,
    });
    l.record({
      model: "smart",
      purpose: "rewrite",
      latencyMs: 200,
      tokensIn: 50,
      tokensOut: 30,
      costEstimateUsd: 0.01,
    });
    expect(l.list()).toHaveLength(2);
    expect(l.list()[0].index).toBe(1);
    const t = l.totals();
    expect(t.calls).toBe(2);
    expect(t.totalLatencyMs).toBe(300);
    expect(t.totalCostUsd).toBeCloseTo(0.011, 4);
  });
});
