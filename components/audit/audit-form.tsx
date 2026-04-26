"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const PHASES = [
  "Fetching page…",
  "Extracting features…",
  "Running trials…",
  "Generating recommendations…",
];

const SEED = {
  url: "https://www.salesforce.com/crm/what-is-crm/",
  topic: "what is a CRM",
  prompts: [
    "what does a CRM do",
    "best CRM for small teams",
    "how does a CRM help sales",
    "is a CRM worth it for small business",
    "CRM vs spreadsheet for sales",
  ].join("\n"),
  runsPerPrompt: 3,
};

export function AuditForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [prompts, setPrompts] = useState("");
  const [runsPerPrompt, setRuns] = useState(3);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setPhase(0);
    const phaseTimer = setInterval(
      () => setPhase((p) => Math.min(p + 1, PHASES.length - 1)),
      4000,
    );
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          topic,
          prompts: prompts.split("\n").map((p) => p.trim()).filter(Boolean),
          runsPerPrompt,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "audit failed");
      router.push(`/audit/${json.auditId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "audit failed");
      setLoading(false);
    } finally {
      clearInterval(phaseTimer);
    }
  }

  function loadSeed() {
    setUrl(SEED.url);
    setTopic(SEED.topic);
    setPrompts(SEED.prompts);
    setRuns(SEED.runsPerPrompt);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} required type="url"
          className="w-full rounded-md border px-3 py-2" placeholder="https://example.com/page" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Topic</label>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} required
          className="w-full rounded-md border px-3 py-2" placeholder="best CRM for small teams" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Prompts (one per line)</label>
        <textarea value={prompts} onChange={(e) => setPrompts(e.target.value)} required rows={6}
          className="w-full rounded-md border px-3 py-2 font-mono text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Runs per prompt</label>
        <input type="number" min={1} max={10} value={runsPerPrompt}
          onChange={(e) => setRuns(Number(e.target.value))}
          className="w-32 rounded-md border px-3 py-2" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50">
          {loading ? PHASES[phase] : "Run audit"}
        </button>
        <button type="button" onClick={loadSeed} disabled={loading}
          className="rounded-md border px-4 py-2">
          Use example
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
