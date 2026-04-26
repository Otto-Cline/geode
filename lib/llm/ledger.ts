import type { LedgerEntry } from "@/lib/models/audit";

export class CallLedger {
  private entries: LedgerEntry[] = [];

  record(entry: Omit<LedgerEntry, "index">): LedgerEntry {
    const indexed: LedgerEntry = { ...entry, index: this.entries.length + 1 };
    this.entries.push(indexed);
    return indexed;
  }

  list(): LedgerEntry[] {
    return [...this.entries];
  }

  totals() {
    return {
      calls: this.entries.length,
      totalLatencyMs: this.entries.reduce((a, e) => a + e.latencyMs, 0),
      totalCostUsd: this.entries.reduce((a, e) => a + e.costEstimateUsd, 0),
    };
  }
}
