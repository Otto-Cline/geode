import type { PageFeatures } from "@/lib/models/audit";

export function FeatureBars({ features }: { features: PageFeatures }) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-semibold">Page features</h2>
      <ul className="space-y-2 text-sm">
        {Object.entries(features).map(([k, v]) => (
          <li key={k} className="flex items-center gap-3">
            <span className="w-44 font-mono text-xs">{k}</span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-200">
              <div className="h-full bg-zinc-700" style={{ width: `${v * 100}%` }} />
            </div>
            <span className="w-10 text-right tabular-nums">{v.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
