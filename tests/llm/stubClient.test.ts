import { describe, it, expect } from "vitest";
import { StubLlmClient } from "@/lib/llm/stubClient";
import { CallLedger } from "@/lib/llm/ledger";
import { TrialResultSchema, RewriteResultSchema } from "@/lib/models/audit";

describe("StubLlmClient", () => {
  it("returns a valid TrialResult and records to ledger", async () => {
    const ledger = new CallLedger();
    const client = new StubLlmClient({
      ledger,
      context: { features: { hasIntroSummary: 1, statisticsDensity: 0.5, listDensity: 0.5, authoritySignalDensity: 0.5, entityClarityScore: 1 } },
    });
    const out = await client.complete({
      system: "s",
      user: "u",
      schema: TrialResultSchema,
      model: "fast",
      purpose: "trial:hello:0",
    });
    expect(out.data.prominenceScore).toBeGreaterThanOrEqual(0);
    expect(out.data.prominenceScore).toBeLessThanOrEqual(1);
    expect(ledger.list()).toHaveLength(1);
  });

  it("is deterministic for the same purpose", async () => {
    const make = () =>
      new StubLlmClient({
        ledger: new CallLedger(),
        context: { features: { hasIntroSummary: 0.7, statisticsDensity: 0.4, listDensity: 0.3, authoritySignalDensity: 0.5, entityClarityScore: 0.8 } },
      });
    const a = await make().complete({
      system: "", user: "", schema: TrialResultSchema, model: "fast", purpose: "trial:p:0",
    });
    const b = await make().complete({
      system: "", user: "", schema: TrialResultSchema, model: "fast", purpose: "trial:p:0",
    });
    expect(a.data.prominenceScore).toBe(b.data.prominenceScore);
    expect(a.data.mentioned).toBe(b.data.mentioned);
  });

  it("returns valid RewriteResult", async () => {
    const client = new StubLlmClient({ ledger: new CallLedger() });
    const out = await client.complete({
      system: "", user: "", schema: RewriteResultSchema, model: "smart", purpose: "rewrite",
    });
    expect(out.data.bulletBlock.length).toBeGreaterThan(0);
    expect(out.data.faqBlock.length).toBeGreaterThan(0);
  });
});
