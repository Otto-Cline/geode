"use client";
import { useState } from "react";
import type { LedgerEntry } from "@/lib/models/audit";

export function CallLedgerPanel({
  ledger,
  totals,
}: {
  ledger: LedgerEntry[];
  totals: { calls: number; totalLatencyMs: number; totalCostUsd: number };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2 text-left text-sm"
      >
        {open ? "▼" : "▶"} Evaluation log ({totals.calls} calls ·{" "}
        {(totals.totalLatencyMs / 1000).toFixed(1)}s · ~$
        {totals.totalCostUsd.toFixed(3)})
      </button>
      {open && (
        <table className="w-full border-t text-xs">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-3 py-1">#</th>
              <th className="px-3 py-1">Model</th>
              <th className="px-3 py-1">Purpose</th>
              <th className="px-3 py-1">Latency</th>
              <th className="px-3 py-1">Tok in/out</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((e) => (
              <tr key={e.index} className="border-t">
                <td className="px-3 py-1 font-mono">{e.index}</td>
                <td className="px-3 py-1">{e.model}</td>
                <td className="px-3 py-1 font-mono">{e.purpose}</td>
                <td className="px-3 py-1 tabular-nums">{e.latencyMs}ms</td>
                <td className="px-3 py-1 tabular-nums">
                  {e.tokensIn}/{e.tokensOut}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
