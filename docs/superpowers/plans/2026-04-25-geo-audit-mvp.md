# GEO Audit MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working single-URL GEO audit tool: form → audit pipeline → results page with score cards, diagnosis, rewrites, and a call ledger. Stub-first; real OpenAI swappable via env var.

**Architecture:** Next.js 16 App Router. One `auditPipeline` orchestrator composes pure modules (ingest, features, scoring, diagnosis, aggregation) plus two LLM-touching modules (`runTrials`, `recommend`). LLM access is behind an `LlmClient` interface with `Stub` and `OpenAI` implementations selected by `LLM_PROVIDER` env. Single-shot in-memory `Map` bridges form page → results page.

**Tech Stack:** Next.js 16.2.4, React 19, TypeScript, Tailwind v4, Bun, Zod, jsdom, @mozilla/readability, OpenAI SDK, Vitest (tests).

**Required reading before writing code:**
- The design spec at `docs/superpowers/specs/2026-04-25-geo-audit-mvp-design.md` is the source of truth for product/architecture decisions.
- `CLAUDE.md` decisions log at the bottom of the file.
- `AGENTS.md`: Next.js 16 has breaking changes from training data. **`params` is `Promise<{...}>` in both route handlers and dynamic pages — must be `await`ed.** Check `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` and `page.md` if uncertain.

**Conventions:**
- Bun for package manager. Use `bun add` / `bun add -d` / `bun run`. Do not generate a `package-lock.json`.
- Tailwind v4 is already configured in the scaffold; do not touch `globals.css` or `postcss.config.mjs` unless a task explicitly says to.
- Tests live in `tests/` mirroring `lib/` paths. Run with `bun run test`.
- Each task ends with a commit. Commit message format: `feat(area): summary` or `chore(area): summary`.

---

## File Structure

```
app/
  layout.tsx                          # untouched
  page.tsx                            # REPLACED — form page (client)
  audit/[id]/page.tsx                 # NEW — results page (server)
  api/
    audit/route.ts                    # NEW — POST runs audit
components/audit/
  audit-form.tsx                      # NEW — client form
  score-cards.tsx                     # NEW
  feature-bars.tsx                    # NEW
  prompt-results-table.tsx            # NEW
  diagnosis-panel.tsx                 # NEW
  rewrite-panel.tsx                   # NEW
  call-ledger-panel.tsx               # NEW
lib/
  models/audit.ts                     # zod schemas + types
  ingest/fetchPage.ts
  ingest/extractReadableContent.ts
  features/extractFeatures.ts         # 10 heuristics
  features/scoreFeatures.ts           # composite factors
  evaluation/runPromptTrials.ts
  evaluation/aggregateResults.ts
  evaluation/scoring.ts               # final scores
  diagnosis/diagnoseAudit.ts          # rule-based
  rewrite/generateRecommendations.ts
  llm/client.ts                       # LlmClient interface + factory
  llm/stubClient.ts
  llm/openaiClient.ts
  llm/ledger.ts
  prompts/systemPrompts.ts
  storage/auditStore.ts               # in-memory Map with TTL
  pipeline/auditPipeline.ts           # orchestrator
  utils/text.ts                       # truncation, paragraph cut, word counts
  utils/stats.ts                      # variance, normalization, seeded rng
tests/
  features/extractFeatures.test.ts
  features/scoreFeatures.test.ts
  evaluation/aggregateResults.test.ts
  evaluation/scoring.test.ts
  diagnosis/diagnoseAudit.test.ts
  llm/stubClient.test.ts
  llm/ledger.test.ts
  utils/text.test.ts
  utils/stats.test.ts
.env.example                          # NEW
.env.local                            # NEW (gitignored)
```

**Files NOT tested:** route handlers (smoke-tested manually), components (visual), `fetchPage` (network-bound), `openaiClient` (real network), `auditPipeline` (smoke-tested e2e). Pure logic is tested.

---

## Task 1: Project setup, deps, env, Vitest

**Files:**
- Create: `.env.example`, `.env.local`, `vitest.config.ts`
- Modify: `package.json`, `.gitignore`, `tsconfig.json`

- [ ] **Step 1: Add runtime + dev deps**

```bash
bun add jsdom @mozilla/readability zod openai
bun add -d vitest @types/jsdom @vitest/ui
```

- [ ] **Step 2: Add scripts to package.json**

In `package.json` `"scripts"`, add `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 4: Add path alias to `tsconfig.json`**

In `compilerOptions`, ensure `"baseUrl": "."` and `"paths": { "@/*": ["./*"] }`. The scaffold may already have this — preserve any existing values, only add what's missing.

- [ ] **Step 5: Create `.env.example`**

```
LLM_PROVIDER=stub
OPENAI_API_KEY=
```

- [ ] **Step 6: Create `.env.local`** (will be gitignored automatically by Next's default `.gitignore`, but verify)

```
LLM_PROVIDER=stub
OPENAI_API_KEY=
```

Confirm `.env*.local` is in `.gitignore` (Next's default has it). If not, add it.

- [ ] **Step 7: Run typecheck and tests to verify scaffold**

```bash
bun run lint
bun run test
```

Expected: lint passes, vitest reports "no test files found" (we haven't written any yet — that's fine, exits 0 with `--passWithNoTests` only if configured; if it fails because of no tests, add `passWithNoTests: true` to vitest config).

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore(setup): add deps, vitest, env scaffolding"
```

---

## Task 2: Shared types and Zod schemas (`lib/models/audit.ts`)

**Files:**
- Create: `lib/models/audit.ts`

- [ ] **Step 1: Write the file**

```ts
// lib/models/audit.ts
import { z } from "zod";

export const AuditInputSchema = z.object({
  url: z.string().url(),
  topic: z.string().min(1),
  prompts: z.array(z.string().min(1)).min(1).max(20),
  runsPerPrompt: z.number().int().min(1).max(10).default(3),
});
export type AuditInput = z.infer<typeof AuditInputSchema>;

export type ExtractedPage = {
  url: string;
  title: string;
  metaDescription?: string;
  headings: { level: number; text: string }[];
  paragraphs: string[];
  lists: string[][];
  tables: string[][];
  outboundLinkCount: number;
  sameDomainLinkCount: number;
  fullText: string;
};

export type PageFeatures = {
  hasIntroSummary: number;
  headingDepthScore: number;
  listDensity: number;
  contentLengthScore: number;
  statisticsDensity: number;
  authoritySignalDensity: number;
  externalSourceSignal: number;
  technicalTermDensity: number;
  readabilityScore: number;
  entityClarityScore: number;
};

export type CompositeFactors = {
  extractability: number;
  factualDensity: number;
  structureChunkability: number;
  authorityTrustSignals: number;
  entityKeywordClarity: number;
};

export const TrialResultSchema = z.object({
  mentioned: z.boolean(),
  evidenceUsed: z.boolean(),
  prominenceScore: z.number().min(0).max(1),
  notes: z.string().max(280),
});
export type TrialResult = z.infer<typeof TrialResultSchema>;

export type PromptTrialResult = TrialResult & {
  prompt: string;
  runIndex: number;
};

export type AggregatedPromptResult = {
  prompt: string;
  mentionRate: number;
  evidenceUseRate: number;
  avgProminence: number;
  variance: number;
};

export type AuditScores = {
  visibilityScore: number;
  stabilityScore: number;
  featureReadinessScore: number;
  geoReadinessScore: number;
};

export type DiagnosisItem = {
  label: string;
  severity: "high" | "medium" | "low";
  explanation: string;
};

export const RewriteResultSchema = z.object({
  revisedIntro: z.string(),
  bulletBlock: z.array(z.string()).min(1).max(8),
  faqBlock: z.array(z.object({ q: z.string(), a: z.string() })).min(1).max(6),
});
export type RewriteResult = z.infer<typeof RewriteResultSchema>;

export type LedgerEntry = {
  index: number;
  model: "fast" | "smart" | "stub";
  purpose: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costEstimateUsd: number;
};

export type AuditResponse = {
  auditId: string;
  input: AuditInput;
  page: ExtractedPage;
  features: PageFeatures;
  composites: CompositeFactors;
  trials: PromptTrialResult[];
  aggregated: AggregatedPromptResult[];
  scores: AuditScores;
  diagnosis: DiagnosisItem[];
  rewrite: RewriteResult;
  ledger: LedgerEntry[];
  totals: {
    calls: number;
    totalLatencyMs: number;
    totalCostUsd: number;
  };
  createdAt: string;
};
```

- [ ] **Step 2: Typecheck**

```bash
bun run lint
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add lib/models/audit.ts
git commit -m "feat(models): add zod schemas and shared audit types"
```

---

## Task 3: Utility helpers (`lib/utils/text.ts`, `lib/utils/stats.ts`) with tests

**Files:**
- Create: `lib/utils/text.ts`, `lib/utils/stats.ts`
- Test: `tests/utils/text.test.ts`, `tests/utils/stats.test.ts`

- [ ] **Step 1: Write `lib/utils/text.ts`**

```ts
// lib/utils/text.ts
export function wordCount(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length;
}

/** Truncate to ~maxTokens (chars/4 heuristic), cleanly at paragraph boundary. */
export function truncateAtParagraph(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  const sliced = text.slice(0, maxChars);
  const lastPara = sliced.lastIndexOf("\n\n");
  return lastPara > maxChars * 0.5 ? sliced.slice(0, lastPara) : sliced;
}

/** Flesch reading ease, mapped to 0..1 with peak around 60–70. */
export function fleschReadingEase(text: string): number {
  const sentences = (text.match(/[.!?]+/g) ?? []).length || 1;
  const words = wordCount(text) || 1;
  const syllables = countSyllables(text) || 1;
  const flesch =
    206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  // Map: 0 → 0, 65 → 1, 100 → 0.7 (over-easy), <0 → 0
  if (flesch <= 0) return 0;
  if (flesch >= 100) return 0.7;
  if (flesch <= 65) return flesch / 65;
  return 1 - ((flesch - 65) / 35) * 0.3;
}

function countSyllables(text: string): number {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  let total = 0;
  for (const w of words) {
    const groups = w.match(/[aeiouy]+/g) ?? [];
    let n = groups.length;
    if (w.endsWith("e") && n > 1) n -= 1;
    total += Math.max(1, n);
  }
  return total;
}

export function trigrams(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const out: string[] = [];
  for (let i = 0; i + 2 < words.length; i++) {
    out.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return out;
}
```

- [ ] **Step 2: Write `lib/utils/stats.ts`**

```ts
// lib/utils/stats.ts
export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / xs.length;
}

/** Map [0..0.25] variance into [1..0] stability. */
export function normalizedVarianceToStability(v: number): number {
  return clamp01(1 - v / 0.25);
}

/** Deterministic seeded RNG (mulberry32). */
export function seededRng(seedStr: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let t = h >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 3: Write `tests/utils/text.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { wordCount, truncateAtParagraph, fleschReadingEase } from "@/lib/utils/text";

describe("wordCount", () => {
  it("counts words", () => {
    expect(wordCount("hello world foo")).toBe(3);
    expect(wordCount("   ")).toBe(0);
  });
});

describe("truncateAtParagraph", () => {
  it("returns input when short", () => {
    expect(truncateAtParagraph("short", 100)).toBe("short");
  });
  it("cuts on paragraph boundary when possible", () => {
    const para = "a".repeat(200) + "\n\n" + "b".repeat(200);
    const out = truncateAtParagraph(para, 50); // 200 chars max
    expect(out.endsWith("a".repeat(200))).toBe(true);
  });
});

describe("fleschReadingEase", () => {
  it("returns 0..1", () => {
    const score = fleschReadingEase("This is a simple sentence. It has small words.");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 4: Write `tests/utils/stats.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { clamp01, mean, variance, seededRng } from "@/lib/utils/stats";

describe("clamp01", () => {
  it("clamps", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe("mean/variance", () => {
  it("computes basic stats", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(variance([1, 2, 3])).toBeCloseTo(2 / 3, 5);
  });
});

describe("seededRng", () => {
  it("is deterministic for same seed", () => {
    const a = seededRng("abc");
    const b = seededRng("abc");
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
  it("differs across seeds", () => {
    expect(seededRng("a")()).not.toBe(seededRng("b")());
  });
});
```

- [ ] **Step 5: Run tests**

```bash
bun run test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/utils tests/utils
git commit -m "feat(utils): add text and stats helpers with tests"
```

---

## Task 4: LLM ledger (`lib/llm/ledger.ts`) with tests

**Files:**
- Create: `lib/llm/ledger.ts`
- Test: `tests/llm/ledger.test.ts`

- [ ] **Step 1: Write `lib/llm/ledger.ts`**

```ts
// lib/llm/ledger.ts
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
```

- [ ] **Step 2: Write `tests/llm/ledger.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { CallLedger } from "@/lib/llm/ledger";

describe("CallLedger", () => {
  it("records and totals", () => {
    const l = new CallLedger();
    l.record({ model: "fast", purpose: "trial", latencyMs: 100, tokensIn: 10, tokensOut: 5, costEstimateUsd: 0.001 });
    l.record({ model: "smart", purpose: "rewrite", latencyMs: 200, tokensIn: 50, tokensOut: 30, costEstimateUsd: 0.01 });
    expect(l.list()).toHaveLength(2);
    expect(l.list()[0].index).toBe(1);
    const t = l.totals();
    expect(t.calls).toBe(2);
    expect(t.totalLatencyMs).toBe(300);
    expect(t.totalCostUsd).toBeCloseTo(0.011, 4);
  });
});
```

- [ ] **Step 3: Run tests, commit**

```bash
bun run test
git add lib/llm/ledger.ts tests/llm/ledger.test.ts
git commit -m "feat(llm): add call ledger"
```

---

## Task 5: LLM client interface + factory (`lib/llm/client.ts`)

**Files:**
- Create: `lib/llm/client.ts`

- [ ] **Step 1: Write the file**

```ts
// lib/llm/client.ts
import type { ZodSchema } from "zod";
import type { CallLedger } from "@/lib/llm/ledger";

export type LlmModel = "fast" | "smart";

export type LlmCompleteArgs<T> = {
  system: string;
  user: string;
  schema: ZodSchema<T>;
  model: LlmModel;
  purpose: string;
  temperature?: number;
};

export type LlmCompleteResult<T> = {
  data: T;
  usage: { tokensIn: number; tokensOut: number; costEstimateUsd: number };
  latencyMs: number;
};

export interface LlmClient {
  complete<T>(args: LlmCompleteArgs<T>): Promise<LlmCompleteResult<T>>;
}

export type LlmFactoryDeps = {
  ledger: CallLedger;
  // Used by the stub to make outputs feature-correlated.
  context?: { features?: Record<string, number> };
};

export async function createLlmClient(deps: LlmFactoryDeps): Promise<LlmClient> {
  const provider = process.env.LLM_PROVIDER ?? "stub";
  if (provider === "openai") {
    const { OpenAiLlmClient } = await import("./openaiClient");
    return new OpenAiLlmClient(deps);
  }
  const { StubLlmClient } = await import("./stubClient");
  return new StubLlmClient(deps);
}
```

- [ ] **Step 2: Typecheck**

```bash
bun run lint
```

Expected: passes (note: `openaiClient` and `stubClient` don't exist yet — but dynamic `import()` only fails at runtime, not at type-check, when the modules don't exist. If TS errors, add `// @ts-expect-error` on those lines temporarily — Tasks 6 and 16 create the files. Remove the suppressions when files exist.)

If type errors appear, prefer to defer this task's commit until Task 6 lands and re-typecheck. Otherwise:

- [ ] **Step 3: Commit**

```bash
git add lib/llm/client.ts
git commit -m "feat(llm): add LlmClient interface and factory"
```

---

## Task 6: Stub LLM client (`lib/llm/stubClient.ts`) with tests

**Files:**
- Create: `lib/llm/stubClient.ts`
- Test: `tests/llm/stubClient.test.ts`

- [ ] **Step 1: Write `lib/llm/stubClient.ts`**

```ts
// lib/llm/stubClient.ts
import type {
  LlmClient,
  LlmCompleteArgs,
  LlmCompleteResult,
  LlmFactoryDeps,
} from "./client";
import { TrialResultSchema, RewriteResultSchema } from "@/lib/models/audit";
import { seededRng, clamp01 } from "@/lib/utils/stats";

export class StubLlmClient implements LlmClient {
  constructor(private deps: LlmFactoryDeps) {}

  async complete<T>(args: LlmCompleteArgs<T>): Promise<LlmCompleteResult<T>> {
    const start = Date.now();
    let data: unknown;
    if (args.schema === TrialResultSchema) {
      data = this.fakeTrial(args.purpose);
    } else if (args.schema === RewriteResultSchema) {
      data = this.fakeRewrite();
    } else {
      // Generic fallback: try to satisfy schema with a best-effort empty value.
      data = args.schema.parse({});
    }
    const parsed = args.schema.parse(data) as T;
    const latencyMs = 4 + Math.floor(Math.random() * 6);
    const usage = { tokensIn: 0, tokensOut: 0, costEstimateUsd: 0 };
    this.deps.ledger.record({
      model: "stub",
      purpose: args.purpose,
      latencyMs,
      ...usage,
    });
    return { data: parsed, usage, latencyMs: Date.now() - start + latencyMs };
  }

  private fakeTrial(purpose: string) {
    const f = this.deps.context?.features ?? {};
    const rng = seededRng(purpose); // purpose includes "trial:<prompt>:<runIndex>"
    const featureReadiness = clamp01(
      0.3 * (f.hasIntroSummary ?? 0.5) +
        0.2 * (f.statisticsDensity ?? 0.5) +
        0.2 * (f.listDensity ?? 0.5) +
        0.15 * (f.authoritySignalDensity ?? 0.5) +
        0.15 * (f.entityClarityScore ?? 0.5),
    );
    const jitter = (rng() - 0.5) * 0.25;
    const mentionProb = clamp01(0.3 + 0.4 * featureReadiness + jitter);
    const evidenceProb = clamp01(
      mentionProb * (0.5 + 0.5 * (f.statisticsDensity ?? 0.5)),
    );
    const prominenceScore = clamp01(
      0.2 +
        0.6 * (f.hasIntroSummary ?? 0.5) +
        0.2 * (f.listDensity ?? 0.5) +
        (rng() - 0.5) * 0.2,
    );
    return {
      mentioned: rng() < mentionProb,
      evidenceUsed: rng() < evidenceProb,
      prominenceScore,
      notes:
        prominenceScore > 0.6
          ? "Strong intro and clear topic focus."
          : "Weaker structure; would only appear as a secondary mention.",
    };
  }

  private fakeRewrite() {
    return {
      revisedIntro:
        "[stub] A focused 2-sentence summary of the page's main claim and audience, written for an answer engine to lift verbatim.",
      bulletBlock: [
        "[stub] Key fact 1 with a concrete number.",
        "[stub] Key fact 2 with a clear comparison.",
        "[stub] Key fact 3 referencing a credible source.",
      ],
      faqBlock: [
        { q: "[stub] What is this page about?", a: "[stub] One-sentence answer." },
        { q: "[stub] Who is it for?", a: "[stub] One-sentence answer." },
      ],
    };
  }
}
```

- [ ] **Step 2: Write `tests/llm/stubClient.test.ts`**

```ts
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
```

- [ ] **Step 3: Run tests**

```bash
bun run test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add lib/llm/stubClient.ts tests/llm/stubClient.test.ts
git commit -m "feat(llm): add feature-correlated stub client with deterministic seeding"
```

---

## Task 7: Page ingestion (`lib/ingest/`)

**Files:**
- Create: `lib/ingest/fetchPage.ts`, `lib/ingest/extractReadableContent.ts`

- [ ] **Step 1: Write `lib/ingest/fetchPage.ts`**

```ts
// lib/ingest/fetchPage.ts
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { extractReadableContent } from "./extractReadableContent";
import type { ExtractedPage } from "@/lib/models/audit";

const FETCH_TIMEOUT_MS = 15_000;
const UA = "GeoAuditBot/0.1 (+https://example.com)";

export async function fetchPage(url: string): Promise<ExtractedPage> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) throw new Error(`fetch ${url} → non-HTML (${ct})`);
    html = await res.text();
  } finally {
    clearTimeout(t);
  }

  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const reader = new Readability(doc.cloneNode(true) as Document);
  const article = reader.parse();
  const readableHtml = article?.content ?? doc.body.innerHTML;
  const title = article?.title ?? doc.title ?? url;
  const metaDescription = doc
    .querySelector('meta[name="description"]')
    ?.getAttribute("content") ?? undefined;

  // Count outbound links from the ORIGINAL document (Readability strips many).
  const targetHost = new URL(url).hostname;
  let outbound = 0, sameDomain = 0;
  doc.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    try {
      const linkUrl = new URL(href, url);
      if (linkUrl.hostname === targetHost) sameDomain++;
      else outbound++;
    } catch {
      /* ignore malformed */
    }
  });

  const readableDom = new JSDOM(readableHtml);
  const extracted = extractReadableContent(readableDom.window.document);

  return {
    url,
    title,
    metaDescription,
    headings: extracted.headings,
    paragraphs: extracted.paragraphs,
    lists: extracted.lists,
    tables: extracted.tables,
    outboundLinkCount: outbound,
    sameDomainLinkCount: sameDomain,
    fullText: extracted.fullText,
  };
}
```

- [ ] **Step 2: Write `lib/ingest/extractReadableContent.ts`**

```ts
// lib/ingest/extractReadableContent.ts
type Extracted = {
  headings: { level: number; text: string }[];
  paragraphs: string[];
  lists: string[][];
  tables: string[][];
  fullText: string;
};

export function extractReadableContent(doc: Document): Extracted {
  const headings: Extracted["headings"] = [];
  doc.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
    headings.push({
      level: Number(h.tagName.slice(1)),
      text: (h.textContent ?? "").trim(),
    });
  });

  const paragraphs = Array.from(doc.querySelectorAll("p"))
    .map((p) => (p.textContent ?? "").trim())
    .filter((t) => t.length > 0);

  const lists: string[][] = [];
  doc.querySelectorAll("ul,ol").forEach((list) => {
    const items = Array.from(list.querySelectorAll(":scope > li"))
      .map((li) => (li.textContent ?? "").trim())
      .filter((t) => t.length > 0);
    if (items.length > 0) lists.push(items);
  });

  const tables: string[][] = [];
  doc.querySelectorAll("table").forEach((table) => {
    const rows = Array.from(table.querySelectorAll("tr"))
      .map((tr) =>
        Array.from(tr.querySelectorAll("th,td"))
          .map((c) => (c.textContent ?? "").trim())
          .join(" | "),
      )
      .filter((r) => r.length > 0);
    if (rows.length > 0) tables.push(rows);
  });

  const fullText = paragraphs.join("\n\n");
  return { headings, paragraphs, lists, tables, fullText };
}
```

- [ ] **Step 3: Typecheck (no test — network-bound)**

```bash
bun run lint
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add lib/ingest
git commit -m "feat(ingest): add fetchPage and readable-content extraction"
```

---

## Task 8: Feature extraction (`lib/features/extractFeatures.ts`) with tests

**Files:**
- Create: `lib/features/extractFeatures.ts`
- Test: `tests/features/extractFeatures.test.ts`

- [ ] **Step 1: Write `lib/features/extractFeatures.ts`**

```ts
// lib/features/extractFeatures.ts
import type { ExtractedPage, PageFeatures } from "@/lib/models/audit";
import { clamp01 } from "@/lib/utils/stats";
import { wordCount, fleschReadingEase } from "@/lib/utils/text";

const AUTHORITY_PHRASES = [
  /\baccording to\b/gi,
  /\bstud(y|ies)\b/gi,
  /\bresearch(?:ers)?\b/gi,
  /\bsurvey\b/gi,
  /\bdata (?:from|shows?)\b/gi,
  /\b(?:dr|prof)\.\s+[A-Z]/g,
];

const STAT_PATTERNS = [
  /\d+(?:\.\d+)?\s?%/g,
  /\$\s?\d+(?:[.,]\d+)?/g,
  /\d+(?:\.\d+)?\s?(?:million|billion|bn|m|k|×|x)\b/gi,
  /\b\d{4}\b/g, // years
];

export function extractFeatures(
  page: ExtractedPage,
  topic: string,
): PageFeatures {
  const words = wordCount(page.fullText);
  const w100 = Math.max(1, words / 100);

  const hasIntroSummary = computeIntroSummary(page);
  const headingDepthScore = computeHeadingDepth(page);
  const listDensity = computeListDensity(page);
  const contentLengthScore = computeContentLength(words);
  const statisticsDensity = clamp01(countMatches(page.fullText, STAT_PATTERNS) / w100 / 5);
  const authoritySignalDensity = clamp01(
    countMatches(page.fullText, AUTHORITY_PHRASES) / w100 / 3,
  );
  const externalSourceSignal = clamp01(
    page.outboundLinkCount / Math.max(1, page.sameDomainLinkCount + page.outboundLinkCount) * 1.5,
  );
  const technicalTermDensity = computeTechnicalTermDensity(page.fullText, topic, w100);
  const readabilityScore = fleschReadingEase(page.fullText);
  const entityClarityScore = computeEntityClarity(page, topic);

  return {
    hasIntroSummary,
    headingDepthScore,
    listDensity,
    contentLengthScore,
    statisticsDensity,
    authoritySignalDensity,
    externalSourceSignal,
    technicalTermDensity,
    readabilityScore,
    entityClarityScore,
  };
}

function computeIntroSummary(page: ExtractedPage): number {
  const first = page.paragraphs[0];
  if (!first) return 0;
  const w = wordCount(first);
  if (w < 40 || w > 250) return 0;
  // No question-mark heading immediately above the first paragraph.
  if (page.headings[0]?.text?.includes("?")) return 0.5;
  return 1;
}

function computeHeadingDepth(page: ExtractedPage): number {
  const levels = new Set(page.headings.map((h) => h.level));
  if (levels.has(2) && levels.has(3)) return 1;
  if (levels.has(2)) return 0.6;
  if (levels.has(1)) return 0.2;
  return 0;
}

function computeListDensity(page: ExtractedPage): number {
  const listItems = page.lists.reduce((a, l) => a + l.length, 0);
  const tableRows = page.tables.reduce((a, t) => a + t.length, 0);
  const blocks = page.paragraphs.length + listItems + tableRows;
  if (blocks === 0) return 0;
  return clamp01((listItems + tableRows) / blocks);
}

function computeContentLength(words: number): number {
  if (words < 300) return 0.2;
  if (words < 800) return 0.6;
  if (words <= 2500) return 1;
  return 0.7;
}

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) {
    const m = text.match(p);
    if (m) n += m.length;
  }
  return n;
}

function computeTechnicalTermDensity(text: string, topic: string, w100: number): number {
  const terms = topic.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (terms.length === 0) return 0;
  const lower = text.toLowerCase();
  let count = 0;
  for (const t of terms) {
    if (t.length < 3) continue;
    const re = new RegExp(`\\b${escapeRegex(t)}\\b`, "g");
    count += (lower.match(re) ?? []).length;
  }
  return clamp01(count / w100 / 5);
}

function computeEntityClarity(page: ExtractedPage, topic: string): number {
  const topicTerms = (topic.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length > 2,
  );
  if (topicTerms.length === 0) return 0;
  const titleLower = (page.title ?? "").toLowerCase();
  const titleHits = topicTerms.filter((t) => titleLower.includes(t)).length;
  const lead = (page.paragraphs[0] ?? "").toLowerCase().slice(0, 600);
  const leadHits = topicTerms.filter((t) => lead.includes(t)).length;
  const titleScore = titleHits / topicTerms.length;
  const leadScore = leadHits / topicTerms.length;
  return clamp01(0.5 * titleScore + 0.5 * leadScore);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

- [ ] **Step 2: Write `tests/features/extractFeatures.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { extractFeatures } from "@/lib/features/extractFeatures";
import type { ExtractedPage } from "@/lib/models/audit";

const base: ExtractedPage = {
  url: "https://example.com/x",
  title: "Best CRM for Small Teams",
  headings: [{ level: 2, text: "Overview" }, { level: 3, text: "Pricing" }],
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
```

- [ ] **Step 3: Run tests**

```bash
bun run test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add lib/features/extractFeatures.ts tests/features/extractFeatures.test.ts
git commit -m "feat(features): add 10 deterministic page-feature heuristics"
```

---

## Task 9: Composite scoring (`lib/features/scoreFeatures.ts`) with tests

**Files:**
- Create: `lib/features/scoreFeatures.ts`
- Test: `tests/features/scoreFeatures.test.ts`

- [ ] **Step 1: Write `lib/features/scoreFeatures.ts`**

```ts
// lib/features/scoreFeatures.ts
import type { CompositeFactors, PageFeatures } from "@/lib/models/audit";
import { clamp01 } from "@/lib/utils/stats";

export function computeComposites(f: PageFeatures): CompositeFactors {
  return {
    extractability: clamp01(0.6 * f.hasIntroSummary + 0.4 * f.headingDepthScore),
    factualDensity: clamp01(0.6 * f.statisticsDensity + 0.4 * f.authoritySignalDensity),
    structureChunkability: clamp01(0.6 * f.listDensity + 0.4 * f.headingDepthScore),
    authorityTrustSignals: clamp01(0.5 * f.authoritySignalDensity + 0.5 * f.externalSourceSignal),
    entityKeywordClarity: clamp01(0.6 * f.entityClarityScore + 0.4 * f.technicalTermDensity),
  };
}

export function featureReadinessScore(c: CompositeFactors, f: PageFeatures): number {
  const base =
    0.3 * c.extractability +
    0.2 * c.factualDensity +
    0.2 * c.structureChunkability +
    0.15 * c.authorityTrustSignals +
    0.15 * c.entityKeywordClarity;
  // Small adjustments from the two unmapped features.
  const adj = 0.05 * f.contentLengthScore + 0.05 * f.readabilityScore;
  return clamp01(0.9 * base + adj);
}
```

- [ ] **Step 2: Write `tests/features/scoreFeatures.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { computeComposites, featureReadinessScore } from "@/lib/features/scoreFeatures";
import type { PageFeatures } from "@/lib/models/audit";

const f: PageFeatures = {
  hasIntroSummary: 1,
  headingDepthScore: 1,
  listDensity: 0.5,
  contentLengthScore: 1,
  statisticsDensity: 0.6,
  authoritySignalDensity: 0.4,
  externalSourceSignal: 0.5,
  technicalTermDensity: 0.7,
  readabilityScore: 0.8,
  entityClarityScore: 1,
};

describe("composites", () => {
  it("computes all five factors in [0,1]", () => {
    const c = computeComposites(f);
    for (const v of Object.values(c)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("featureReadinessScore is high for high inputs", () => {
    const c = computeComposites(f);
    expect(featureReadinessScore(c, f)).toBeGreaterThan(0.7);
  });
});
```

- [ ] **Step 3: Run tests, commit**

```bash
bun run test
git add lib/features/scoreFeatures.ts tests/features/scoreFeatures.test.ts
git commit -m "feat(features): add composite scoring and feature readiness score"
```

---

## Task 10: Prompt trial runner (`lib/evaluation/runPromptTrials.ts`)

**Files:**
- Create: `lib/evaluation/runPromptTrials.ts`, `lib/prompts/systemPrompts.ts`

- [ ] **Step 1: Write `lib/prompts/systemPrompts.ts`**

```ts
// lib/prompts/systemPrompts.ts
export const TRIAL_SYSTEM_PROMPT = `You are an answer-engine simulator.
You will be given the contents of one candidate web page and a user query.
Decide whether you would use this page when answering the query, and how prominently.
Respond as JSON matching the provided schema. Do not invent facts that aren't in the page.`;

export const REWRITE_SYSTEM_PROMPT = `You are a content editor specialised in optimising pages for AI answer engines.
Given a page, a list of diagnosed weaknesses, and a target feature profile, produce three concrete improvements:
a revised intro paragraph (2-3 sentences, factual, lift-ready), a bullet block of 3-6 high-density key points, and an FAQ block of 2-4 Q&A pairs.
Output JSON matching the provided schema. Do not invent facts that aren't supported by the page text.`;

export function buildTrialUserPrompt(args: {
  prompt: string;
  url: string;
  title: string;
  truncatedText: string;
}): string {
  return `<query>${args.prompt}</query>
<candidate_page url="${args.url}" title="${escapeXml(args.title)}">
${args.truncatedText}
</candidate_page>

Decide:
- mentioned: would this page appear in your answer at all?
- evidenceUsed: would you cite a specific fact, stat, or quote from it?
- prominenceScore: 0..1, how central would it be (1 = lead source, 0 = footnote at best)?
- notes: one short sentence — what made it strong or weak for this query.`;
}

export function buildRewriteUserPrompt(args: {
  url: string;
  title: string;
  truncatedText: string;
  diagnosis: { label: string; explanation: string }[];
  targetFeatures: string[];
}): string {
  const diagBullets = args.diagnosis
    .map((d, i) => `${i + 1}. ${d.label}: ${d.explanation}`)
    .join("\n");
  return `<page url="${args.url}" title="${escapeXml(args.title)}">
${args.truncatedText}
</page>

Top diagnosed weaknesses:
${diagBullets}

Target features to improve: ${args.targetFeatures.join(", ")}

Produce concrete improvements:
- revisedIntro: 2-3 sentences, factual and lift-ready
- bulletBlock: 3-6 short bullets, each with a number, comparison, or specific claim
- faqBlock: 2-4 short Q&A pairs that an answer engine could quote directly`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}
```

- [ ] **Step 2: Write `lib/evaluation/runPromptTrials.ts`**

```ts
// lib/evaluation/runPromptTrials.ts
import type { LlmClient } from "@/lib/llm/client";
import type { ExtractedPage, PromptTrialResult } from "@/lib/models/audit";
import { TrialResultSchema } from "@/lib/models/audit";
import {
  TRIAL_SYSTEM_PROMPT,
  buildTrialUserPrompt,
} from "@/lib/prompts/systemPrompts";
import { truncateAtParagraph } from "@/lib/utils/text";

export async function runPromptTrials(args: {
  llm: LlmClient;
  page: ExtractedPage;
  prompts: string[];
  runsPerPrompt: number;
}): Promise<PromptTrialResult[]> {
  const truncated = truncateAtParagraph(args.page.fullText, 3500);
  const out: PromptTrialResult[] = [];
  for (const prompt of args.prompts) {
    for (let runIndex = 0; runIndex < args.runsPerPrompt; runIndex++) {
      const purpose = `trial:${prompt}:${runIndex}`;
      const res = await args.llm.complete({
        system: TRIAL_SYSTEM_PROMPT,
        user: buildTrialUserPrompt({
          prompt,
          url: args.page.url,
          title: args.page.title,
          truncatedText: truncated,
        }),
        schema: TrialResultSchema,
        model: "fast",
        purpose,
        temperature: 0.7,
      });
      out.push({ ...res.data, prompt, runIndex });
    }
  }
  return out;
}
```

- [ ] **Step 3: Typecheck, commit**

```bash
bun run lint
git add lib/evaluation/runPromptTrials.ts lib/prompts/systemPrompts.ts
git commit -m "feat(eval): add prompt trial runner and prompt templates"
```

---

## Task 11: Aggregation (`lib/evaluation/aggregateResults.ts`) with tests

**Files:**
- Create: `lib/evaluation/aggregateResults.ts`
- Test: `tests/evaluation/aggregateResults.test.ts`

- [ ] **Step 1: Write `lib/evaluation/aggregateResults.ts`**

```ts
// lib/evaluation/aggregateResults.ts
import type { AggregatedPromptResult, PromptTrialResult } from "@/lib/models/audit";
import { mean, variance } from "@/lib/utils/stats";

export function aggregateResults(trials: PromptTrialResult[]): AggregatedPromptResult[] {
  const byPrompt = new Map<string, PromptTrialResult[]>();
  for (const t of trials) {
    const arr = byPrompt.get(t.prompt) ?? [];
    arr.push(t);
    byPrompt.set(t.prompt, arr);
  }
  return Array.from(byPrompt.entries()).map(([prompt, ts]) => {
    const proms = ts.map((t) => t.prominenceScore);
    return {
      prompt,
      mentionRate: ts.filter((t) => t.mentioned).length / ts.length,
      evidenceUseRate: ts.filter((t) => t.evidenceUsed).length / ts.length,
      avgProminence: mean(proms),
      variance: variance(proms),
    };
  });
}
```

- [ ] **Step 2: Write `tests/evaluation/aggregateResults.test.ts`**

```ts
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
```

- [ ] **Step 3: Run tests, commit**

```bash
bun run test
git add lib/evaluation/aggregateResults.ts tests/evaluation/aggregateResults.test.ts
git commit -m "feat(eval): aggregate per-prompt trial results"
```

---

## Task 12: Final scoring (`lib/evaluation/scoring.ts`) with tests

**Files:**
- Create: `lib/evaluation/scoring.ts`
- Test: `tests/evaluation/scoring.test.ts`

- [ ] **Step 1: Write `lib/evaluation/scoring.ts`**

```ts
// lib/evaluation/scoring.ts
import type {
  AggregatedPromptResult,
  AuditScores,
  CompositeFactors,
  PageFeatures,
} from "@/lib/models/audit";
import { clamp01, mean, normalizedVarianceToStability } from "@/lib/utils/stats";
import { featureReadinessScore } from "@/lib/features/scoreFeatures";

export function computeScores(args: {
  features: PageFeatures;
  composites: CompositeFactors;
  aggregated: AggregatedPromptResult[];
}): AuditScores {
  const ag = args.aggregated;
  const visibilityScore = clamp01(
    0.5 * mean(ag.map((a) => a.mentionRate)) +
      0.3 * mean(ag.map((a) => a.evidenceUseRate)) +
      0.2 * mean(ag.map((a) => a.avgProminence)),
  );
  const stabilityScore = normalizedVarianceToStability(mean(ag.map((a) => a.variance)));
  const featureReady = featureReadinessScore(args.composites, args.features);
  const geoReadinessScore = clamp01(
    0.5 * visibilityScore + 0.2 * stabilityScore + 0.3 * featureReady,
  );
  return {
    visibilityScore,
    stabilityScore,
    featureReadinessScore: featureReady,
    geoReadinessScore,
  };
}
```

- [ ] **Step 2: Write `tests/evaluation/scoring.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { computeScores } from "@/lib/evaluation/scoring";

const features = {
  hasIntroSummary: 1, headingDepthScore: 1, listDensity: 0.5, contentLengthScore: 1,
  statisticsDensity: 0.7, authoritySignalDensity: 0.5, externalSourceSignal: 0.5,
  technicalTermDensity: 0.6, readabilityScore: 0.8, entityClarityScore: 1,
};
const composites = {
  extractability: 1, factualDensity: 0.7, structureChunkability: 0.7,
  authorityTrustSignals: 0.5, entityKeywordClarity: 1,
};

describe("computeScores", () => {
  it("returns all four scores in [0,1]", () => {
    const s = computeScores({
      features, composites,
      aggregated: [
        { prompt: "p", mentionRate: 0.6, evidenceUseRate: 0.4, avgProminence: 0.6, variance: 0.02 },
      ],
    });
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("stability is high when variance is zero", () => {
    const s = computeScores({
      features, composites,
      aggregated: [
        { prompt: "p", mentionRate: 1, evidenceUseRate: 1, avgProminence: 1, variance: 0 },
      ],
    });
    expect(s.stabilityScore).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests, commit**

```bash
bun run test
git add lib/evaluation/scoring.ts tests/evaluation/scoring.test.ts
git commit -m "feat(eval): compute final visibility/stability/readiness/GEO scores"
```

---

## Task 13: Rule-based diagnosis (`lib/diagnosis/diagnoseAudit.ts`) with tests

**Files:**
- Create: `lib/diagnosis/diagnoseAudit.ts`
- Test: `tests/diagnosis/diagnoseAudit.test.ts`

- [ ] **Step 1: Write `lib/diagnosis/diagnoseAudit.ts`**

```ts
// lib/diagnosis/diagnoseAudit.ts
import type {
  AggregatedPromptResult,
  AuditScores,
  DiagnosisItem,
  PageFeatures,
} from "@/lib/models/audit";
import { mean } from "@/lib/utils/stats";

type Rule = (
  f: PageFeatures,
  ag: AggregatedPromptResult[],
  s: AuditScores,
) => DiagnosisItem | null;

const rules: Rule[] = [
  (f) =>
    f.hasIntroSummary < 0.5 && f.entityClarityScore < 0.4
      ? {
          label: "Weak extractability",
          severity: "high",
          explanation:
            "No clear intro summary and the topic isn't restated up top, so an answer engine can't lift a self-contained snippet.",
        }
      : null,
  (f, ag) => {
    const evid = mean(ag.map((a) => a.evidenceUseRate));
    return f.statisticsDensity < 0.2 && evid < 0.3
      ? {
          label: "Insufficient factual grounding",
          severity: "high",
          explanation:
            "Few numbers, percentages, or specific claims. Pages with concrete stats get cited as evidence more often.",
        }
      : null;
  },
  (f, ag) => {
    const prom = mean(ag.map((a) => a.avgProminence));
    return f.listDensity < 0.15 && prom < 0.4
      ? {
          label: "Poor chunkability",
          severity: "medium",
          explanation:
            "Content is mostly long prose. Bullets, tables, and short lists are easier for answer engines to lift verbatim.",
        }
      : null;
  },
  (f) =>
    f.authoritySignalDensity < 0.15
      ? {
          label: "Weak trust/corroboration cues",
          severity: "medium",
          explanation:
            "Few mentions of studies, surveys, or named experts. Authority signals make a page more quotable.",
        }
      : null,
  (_, ag) => {
    const v = mean(ag.map((a) => a.variance));
    return v > 0.06
      ? {
          label: "Narrow topic coverage / low robustness",
          severity: "medium",
          explanation:
            "Performance varies a lot across prompts and reruns. The page likely answers some queries well but fails on adjacent ones.",
        }
      : null;
  },
  (f) =>
    f.contentLengthScore < 0.4
      ? {
          label: "Content thinness",
          severity: "low",
          explanation:
            "Page is short relative to the topic. Longer, well-structured pages tend to surface more reliably.",
        }
      : null,
  (f) =>
    f.headingDepthScore < 0.4
      ? {
          label: "Flat structure",
          severity: "low",
          explanation:
            "Few or no h2/h3 headings. Hierarchical structure helps answer engines locate sub-topics.",
        }
      : null,
];

export function diagnoseAudit(
  features: PageFeatures,
  aggregated: AggregatedPromptResult[],
  scores: AuditScores,
): DiagnosisItem[] {
  const found = rules
    .map((r) => r(features, aggregated, scores))
    .filter((x): x is DiagnosisItem => x !== null);
  const order = { high: 0, medium: 1, low: 2 } as const;
  found.sort((a, b) => order[a.severity] - order[b.severity]);
  return found.slice(0, 5);
}
```

- [ ] **Step 2: Write `tests/diagnosis/diagnoseAudit.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { diagnoseAudit } from "@/lib/diagnosis/diagnoseAudit";

const goodFeatures = {
  hasIntroSummary: 1, headingDepthScore: 1, listDensity: 0.5, contentLengthScore: 1,
  statisticsDensity: 0.7, authoritySignalDensity: 0.5, externalSourceSignal: 0.5,
  technicalTermDensity: 0.7, readabilityScore: 0.8, entityClarityScore: 1,
};
const goodAg = [{ prompt: "p", mentionRate: 0.9, evidenceUseRate: 0.7, avgProminence: 0.8, variance: 0.01 }];
const goodScores = { visibilityScore: 0.8, stabilityScore: 0.95, featureReadinessScore: 0.9, geoReadinessScore: 0.85 };

describe("diagnoseAudit", () => {
  it("returns no issues for a strong page", () => {
    expect(diagnoseAudit(goodFeatures, goodAg, goodScores)).toHaveLength(0);
  });

  it("flags weak extractability", () => {
    const f = { ...goodFeatures, hasIntroSummary: 0, entityClarityScore: 0.1 };
    const out = diagnoseAudit(f, goodAg, goodScores);
    expect(out.some((d) => d.label === "Weak extractability" && d.severity === "high")).toBe(true);
  });

  it("returns at most 5 items, sorted by severity", () => {
    const f = { hasIntroSummary: 0, headingDepthScore: 0.1, listDensity: 0, contentLengthScore: 0.2,
      statisticsDensity: 0, authoritySignalDensity: 0, externalSourceSignal: 0,
      technicalTermDensity: 0, readabilityScore: 0.5, entityClarityScore: 0 };
    const out = diagnoseAudit(f, [{ prompt: "p", mentionRate: 0, evidenceUseRate: 0, avgProminence: 0, variance: 0.1 }], goodScores);
    expect(out.length).toBeLessThanOrEqual(5);
    if (out.length > 1) {
      const order = { high: 0, medium: 1, low: 2 } as const;
      for (let i = 1; i < out.length; i++) {
        expect(order[out[i - 1].severity]).toBeLessThanOrEqual(order[out[i].severity]);
      }
    }
  });
});
```

- [ ] **Step 3: Run tests, commit**

```bash
bun run test
git add lib/diagnosis tests/diagnosis
git commit -m "feat(diagnosis): rule-based diagnosis with severity ordering"
```

---

## Task 14: Rewrite recommendation (`lib/rewrite/generateRecommendations.ts`)

**Files:**
- Create: `lib/rewrite/generateRecommendations.ts`

- [ ] **Step 1: Write the file**

```ts
// lib/rewrite/generateRecommendations.ts
import type { LlmClient } from "@/lib/llm/client";
import type {
  DiagnosisItem,
  ExtractedPage,
  PageFeatures,
  RewriteResult,
} from "@/lib/models/audit";
import { RewriteResultSchema } from "@/lib/models/audit";
import {
  REWRITE_SYSTEM_PROMPT,
  buildRewriteUserPrompt,
} from "@/lib/prompts/systemPrompts";
import { truncateAtParagraph } from "@/lib/utils/text";

export async function generateRecommendations(args: {
  llm: LlmClient;
  page: ExtractedPage;
  diagnosis: DiagnosisItem[];
  features: PageFeatures;
}): Promise<RewriteResult> {
  const targets = pickTargetFeatures(args.features);
  const truncated = truncateAtParagraph(args.page.fullText, 3500);
  const res = await args.llm.complete({
    system: REWRITE_SYSTEM_PROMPT,
    user: buildRewriteUserPrompt({
      url: args.page.url,
      title: args.page.title,
      truncatedText: truncated,
      diagnosis: args.diagnosis.slice(0, 3),
      targetFeatures: targets,
    }),
    schema: RewriteResultSchema,
    model: "smart",
    purpose: "rewrite",
    temperature: 0.2,
  });
  return res.data;
}

function pickTargetFeatures(f: PageFeatures): string[] {
  return Object.entries(f)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([k]) => k);
}
```

- [ ] **Step 2: Typecheck, commit**

```bash
bun run lint
git add lib/rewrite
git commit -m "feat(rewrite): generate targeted recommendations via LlmClient"
```

---

## Task 15: Audit store (`lib/storage/auditStore.ts`)

**Files:**
- Create: `lib/storage/auditStore.ts`

- [ ] **Step 1: Write the file**

```ts
// lib/storage/auditStore.ts
import type { AuditResponse } from "@/lib/models/audit";

const TTL_MS = 10 * 60 * 1000; // 10 minutes

type Entry = { value: AuditResponse; expiresAt: number };

declare global {
  // Use globalThis so HMR doesn't blow the map away during dev.
  // eslint-disable-next-line no-var
  var __auditStore: Map<string, Entry> | undefined;
}

const store: Map<string, Entry> =
  globalThis.__auditStore ?? (globalThis.__auditStore = new Map());

function gc() {
  const now = Date.now();
  for (const [k, v] of store) if (v.expiresAt < now) store.delete(k);
}

export function putAudit(value: AuditResponse): void {
  gc();
  store.set(value.auditId, { value, expiresAt: Date.now() + TTL_MS });
}

export function getAudit(id: string): AuditResponse | null {
  gc();
  const e = store.get(id);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    store.delete(id);
    return null;
  }
  return e.value;
}
```

- [ ] **Step 2: Typecheck, commit**

```bash
bun run lint
git add lib/storage
git commit -m "feat(storage): in-memory audit store with TTL"
```

---

## Task 16: Audit pipeline orchestrator (`lib/pipeline/auditPipeline.ts`)

**Files:**
- Create: `lib/pipeline/auditPipeline.ts`

- [ ] **Step 1: Write the file**

```ts
// lib/pipeline/auditPipeline.ts
import { randomUUID } from "node:crypto";
import type { AuditInput, AuditResponse } from "@/lib/models/audit";
import { fetchPage } from "@/lib/ingest/fetchPage";
import { extractFeatures } from "@/lib/features/extractFeatures";
import { computeComposites } from "@/lib/features/scoreFeatures";
import { runPromptTrials } from "@/lib/evaluation/runPromptTrials";
import { aggregateResults } from "@/lib/evaluation/aggregateResults";
import { computeScores } from "@/lib/evaluation/scoring";
import { diagnoseAudit } from "@/lib/diagnosis/diagnoseAudit";
import { generateRecommendations } from "@/lib/rewrite/generateRecommendations";
import { CallLedger } from "@/lib/llm/ledger";
import { createLlmClient } from "@/lib/llm/client";

export async function runAuditPipeline(input: AuditInput): Promise<AuditResponse> {
  const ledger = new CallLedger();
  const page = await fetchPage(input.url);
  const features = extractFeatures(page, input.topic);
  const composites = computeComposites(features);

  const llm = await createLlmClient({ ledger, context: { features } });
  const trials = await runPromptTrials({
    llm,
    page,
    prompts: input.prompts,
    runsPerPrompt: input.runsPerPrompt,
  });
  const aggregated = aggregateResults(trials);
  const scores = computeScores({ features, composites, aggregated });
  const diagnosis = diagnoseAudit(features, aggregated, scores);
  const rewrite = await generateRecommendations({
    llm,
    page,
    diagnosis,
    features,
  });

  return {
    auditId: randomUUID(),
    input,
    page,
    features,
    composites,
    trials,
    aggregated,
    scores,
    diagnosis,
    rewrite,
    ledger: ledger.list(),
    totals: ledger.totals(),
    createdAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: Typecheck, commit**

```bash
bun run lint
git add lib/pipeline
git commit -m "feat(pipeline): compose end-to-end audit pipeline"
```

---

## Task 17: POST `/api/audit` route handler

**Files:**
- Create: `app/api/audit/route.ts`

- [ ] **Step 1: Write the file**

```ts
// app/api/audit/route.ts
import { NextResponse } from "next/server";
import { AuditInputSchema } from "@/lib/models/audit";
import { runAuditPipeline } from "@/lib/pipeline/auditPipeline";
import { putAudit } from "@/lib/storage/auditStore";

export const runtime = "nodejs"; // jsdom + readability need Node, not Edge.
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = AuditInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const audit = await runAuditPipeline(parsed.data);
    putAudit(audit);
    return NextResponse.json({ auditId: audit.auditId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "audit failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck, commit**

```bash
bun run lint
git add app/api
git commit -m "feat(api): POST /api/audit runs pipeline and stores result"
```

---

## Task 18: Audit results page (`app/audit/[id]/page.tsx`)

**Files:**
- Create: `app/audit/[id]/page.tsx`

This page is a server component. Reads from the audit store and passes data to the presentation components (Task 19). For now, render JSON if components don't exist yet — Task 19 will replace.

- [ ] **Step 1: Write the file**

```tsx
// app/audit/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAudit } from "@/lib/storage/auditStore";

export default async function AuditResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const audit = getAudit(id);
  if (!audit) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold">Audit not found or expired</h1>
        <p className="mt-4 text-zinc-600">
          Audits are kept in memory for 10 minutes. Run a new one.
        </p>
        <Link href="/" className="mt-6 inline-block rounded-md bg-black px-4 py-2 text-white">
          Back to form
        </Link>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-5xl p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{audit.page.title}</h1>
          <p className="text-sm text-zinc-600">
            {audit.page.url} · topic: <span className="font-medium">{audit.input.topic}</span>
          </p>
        </div>
        <Link href="/" className="rounded-md border px-3 py-1.5 text-sm">↻ Run again</Link>
      </header>
      {/* Placeholder render: replaced by components in Task 19. */}
      <pre className="overflow-auto rounded-md bg-zinc-100 p-4 text-xs">
        {JSON.stringify(audit, null, 2)}
      </pre>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck, commit**

```bash
bun run lint
git add app/audit
git commit -m "feat(ui): add audit results page (placeholder JSON view)"
```

---

## Task 19: Form page (`app/page.tsx`) and audit-form component

**Files:**
- Replace: `app/page.tsx`
- Create: `components/audit/audit-form.tsx`

- [ ] **Step 1: Write `components/audit/audit-form.tsx`**

```tsx
// components/audit/audit-form.tsx
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
```

- [ ] **Step 2: Replace `app/page.tsx`**

```tsx
// app/page.tsx
import { AuditForm } from "@/components/audit/audit-form";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">GEO Audit</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Single-URL Generative Engine Optimization audit.
      </p>
      <div className="mt-6">
        <AuditForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Smoke test**

```bash
bun run dev
```

Open `http://localhost:3000`, click "Use example", submit. Should redirect to `/audit/<uuid>` and show the JSON dump within a few seconds (stub mode).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/audit/audit-form.tsx
git commit -m "feat(ui): replace form page and wire submit → audit pipeline"
```

---

## Task 20: Presentation components

**Files:**
- Create: `components/audit/score-cards.tsx`, `feature-bars.tsx`, `prompt-results-table.tsx`, `diagnosis-panel.tsx`, `rewrite-panel.tsx`, `call-ledger-panel.tsx`
- Modify: `app/audit/[id]/page.tsx`

These are minimal, functional, unstyled-beyond-utilitarian. The user will redesign them in a separate frontend pass — this task ships them in usable form.

- [ ] **Step 1: `components/audit/score-cards.tsx`**

```tsx
import type { AuditScores } from "@/lib/models/audit";

const cards: { key: keyof AuditScores; label: string }[] = [
  { key: "geoReadinessScore", label: "GEO Readiness" },
  { key: "visibilityScore", label: "Visibility" },
  { key: "stabilityScore", label: "Stability" },
  { key: "featureReadinessScore", label: "Feature Readiness" },
];

function tone(v: number): string {
  if (v < 0.4) return "bg-red-50 text-red-900";
  if (v < 0.7) return "bg-amber-50 text-amber-900";
  return "bg-green-50 text-green-900";
}

export function ScoreCards({ scores }: { scores: AuditScores }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.key} className={`rounded-lg p-4 ${tone(scores[c.key])}`}>
          <div className="text-xs uppercase tracking-wide opacity-70">{c.label}</div>
          <div className="mt-1 text-2xl font-semibold">
            {(scores[c.key] * 100).toFixed(0)}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `components/audit/feature-bars.tsx`**

```tsx
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
```

- [ ] **Step 3: `components/audit/prompt-results-table.tsx`**

```tsx
import type { AggregatedPromptResult } from "@/lib/models/audit";

export function PromptResultsTable({ rows }: { rows: AggregatedPromptResult[] }) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-semibold">Prompt results</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="py-1 pr-4">Prompt</th>
            <th className="py-1 pr-4">Mentions</th>
            <th className="py-1 pr-4">Evidence</th>
            <th className="py-1 pr-4">Prominence</th>
            <th className="py-1">Var.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.prompt} className="border-t">
              <td className="py-1 pr-4">{r.prompt}</td>
              <td className="py-1 pr-4 tabular-nums">{(r.mentionRate * 100).toFixed(0)}%</td>
              <td className="py-1 pr-4 tabular-nums">{(r.evidenceUseRate * 100).toFixed(0)}%</td>
              <td className="py-1 pr-4 tabular-nums">{r.avgProminence.toFixed(2)}</td>
              <td className="py-1 tabular-nums">{r.variance.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: `components/audit/diagnosis-panel.tsx`**

```tsx
import type { DiagnosisItem } from "@/lib/models/audit";

const tone: Record<DiagnosisItem["severity"], string> = {
  high: "bg-red-50 text-red-900 border-red-200",
  medium: "bg-amber-50 text-amber-900 border-amber-200",
  low: "bg-zinc-50 text-zinc-900 border-zinc-200",
};

export function DiagnosisPanel({ items }: { items: DiagnosisItem[] }) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-semibold">Diagnosis</h2>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-600">No major issues detected.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((d) => (
            <li key={d.label} className={`rounded border p-3 text-sm ${tone[d.severity]}`}>
              <div className="font-medium">
                {d.label} <span className="opacity-70">· {d.severity}</span>
              </div>
              <div className="opacity-80">{d.explanation}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: `components/audit/rewrite-panel.tsx`**

```tsx
import type { RewriteResult } from "@/lib/models/audit";

export function RewritePanel({ rewrite }: { rewrite: RewriteResult }) {
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <h2 className="text-sm font-semibold">Suggested rewrites</h2>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Revised intro</h3>
        <p className="mt-1 text-sm">{rewrite.revisedIntro}</p>
      </section>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Bullet block</h3>
        <ul className="mt-1 list-disc pl-5 text-sm">
          {rewrite.bulletBlock.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      </section>
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">FAQ block</h3>
        <dl className="mt-1 space-y-2 text-sm">
          {rewrite.faqBlock.map((qa, i) => (
            <div key={i}>
              <dt className="font-medium">{qa.q}</dt>
              <dd className="text-zinc-700">{qa.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: `components/audit/call-ledger-panel.tsx`**

```tsx
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
```

- [ ] **Step 7: Update `app/audit/[id]/page.tsx` to use the components**

Replace the `<pre>` JSON dump with:

```tsx
// inside the return, after the <header>:
import { ScoreCards } from "@/components/audit/score-cards";
import { FeatureBars } from "@/components/audit/feature-bars";
import { PromptResultsTable } from "@/components/audit/prompt-results-table";
import { DiagnosisPanel } from "@/components/audit/diagnosis-panel";
import { RewritePanel } from "@/components/audit/rewrite-panel";
import { CallLedgerPanel } from "@/components/audit/call-ledger-panel";

// ...
<ScoreCards scores={audit.scores} />
<div className="grid gap-6 md:grid-cols-2">
  <DiagnosisPanel items={audit.diagnosis} />
  <RewritePanel rewrite={audit.rewrite} />
</div>
<FeatureBars features={audit.features} />
<PromptResultsTable rows={audit.aggregated} />
<CallLedgerPanel ledger={audit.ledger} totals={audit.totals} />
```

Replace the imports at the top of `app/audit/[id]/page.tsx` accordingly. Final structure should keep `import Link from "next/link"`, `notFound`, `getAudit`, plus the six new component imports.

- [ ] **Step 8: Smoke test**

```bash
bun run dev
```

Run an audit via the form. Verify all six panels render, ledger panel toggles open.

- [ ] **Step 9: Commit**

```bash
git add components/audit app/audit
git commit -m "feat(ui): add score, feature, diagnosis, rewrite, ledger components"
```

---

## Task 21: OpenAI client (`lib/llm/openaiClient.ts`)

**Files:**
- Create: `lib/llm/openaiClient.ts`

This task makes `LLM_PROVIDER=openai` work. Unit tests are skipped (real network); manual smoke test is the validation.

- [ ] **Step 1: Write the file**

```ts
// lib/llm/openaiClient.ts
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type {
  LlmClient,
  LlmCompleteArgs,
  LlmCompleteResult,
  LlmFactoryDeps,
  LlmModel,
} from "./client";

const MODEL_IDS: Record<LlmModel, string> = {
  fast: "gpt-5-mini",
  smart: "gpt-5",
};

// Cost estimates (USD per 1K tokens) — placeholder values; verify against
// OpenAI pricing page at runtime if accuracy matters. These are only used for
// the call-ledger display and have no effect on behaviour.
const COST_PER_1K: Record<LlmModel, { in: number; out: number }> = {
  fast: { in: 0.0003, out: 0.0012 },
  smart: { in: 0.005, out: 0.015 },
};

export class OpenAiLlmClient implements LlmClient {
  private client: OpenAI;
  constructor(private deps: LlmFactoryDeps) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
    this.client = new OpenAI({ apiKey: key });
  }

  async complete<T>(args: LlmCompleteArgs<T>): Promise<LlmCompleteResult<T>> {
    const start = Date.now();
    const completion = await this.client.chat.completions.parse({
      model: MODEL_IDS[args.model],
      temperature: args.temperature ?? 0.5,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      response_format: zodResponseFormat(args.schema, args.purpose),
    });
    const latencyMs = Date.now() - start;
    const parsed = completion.choices[0]?.message?.parsed as T | null;
    if (!parsed) throw new Error(`OpenAI returned no parsed payload for ${args.purpose}`);
    const tokensIn = completion.usage?.prompt_tokens ?? 0;
    const tokensOut = completion.usage?.completion_tokens ?? 0;
    const cost = COST_PER_1K[args.model];
    const costEstimateUsd = (tokensIn * cost.in + tokensOut * cost.out) / 1000;
    this.deps.ledger.record({
      model: args.model,
      purpose: args.purpose,
      latencyMs,
      tokensIn,
      tokensOut,
      costEstimateUsd,
    });
    return {
      data: parsed,
      usage: { tokensIn, tokensOut, costEstimateUsd },
      latencyMs,
    };
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
bun run lint
```

Expected: passes. If `openai/helpers/zod` import path differs in the installed `openai` SDK version, check `node_modules/openai/package.json` `"exports"` for the helpers entry and adjust. As of OpenAI Node SDK v4+, `openai/helpers/zod` is the documented path; if missing, use `openai/resources/beta/chat/completions` `parse` method or fall back to `client.chat.completions.create` with `response_format: { type: "json_schema", json_schema: { schema: zodToJsonSchema(args.schema), strict: true, name: args.purpose } }` and a manual `args.schema.parse(JSON.parse(content))` call.

- [ ] **Step 3: Manual smoke test**

```bash
# Add a real key to .env.local
echo "OPENAI_API_KEY=sk-..." >> .env.local
echo "LLM_PROVIDER=openai" >> .env.local
bun run dev
```

Run an audit through the UI with the example seed. Verify: results page renders, ledger shows real models (`gpt-5-mini`, `gpt-5`), latency > stub, cost > 0.

- [ ] **Step 4: Reset env to stub before committing**

Edit `.env.local` back to `LLM_PROVIDER=stub` so the default dev experience doesn't burn credits.

- [ ] **Step 5: Commit**

```bash
git add lib/llm/openaiClient.ts
git commit -m "feat(llm): add OpenAI client with structured outputs and cost estimation"
```

---

## Task 22: README + deploy notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md` with project-specific content**

```markdown
# GEO Audit MVP

Single-URL Generative Engine Optimization audit tool.

## Run locally

```bash
bun install
bun run dev
```

Open `http://localhost:3000` and click "Use example".

By default, runs in stub mode (no API key needed). To use real OpenAI:

```bash
echo 'LLM_PROVIDER=openai' >> .env.local
echo 'OPENAI_API_KEY=sk-...' >> .env.local
```

## Tests

```bash
bun run test
```

## Deploy

Vercel: connect the repo, set `OPENAI_API_KEY` and `LLM_PROVIDER=openai` in
project env vars, deploy. The audit route is configured for `runtime: "nodejs"`
and `maxDuration: 60` so it can run jsdom + multiple model calls.

## Architecture

See `docs/superpowers/specs/2026-04-25-geo-audit-mvp-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): replace scaffold readme with project notes"
```

---

## Task 23: End-to-end verification

- [ ] **Step 1: Clean run from scratch**

```bash
git status   # should be clean
bun run lint
bun run test
```

Both must pass.

- [ ] **Step 2: Stub-mode E2E**

```bash
LLM_PROVIDER=stub bun run dev
```

Open the form, click "Use example", submit. Expected:
- Redirect to `/audit/<uuid>` within 1–2 seconds.
- All four score cards visible.
- Diagnosis panel renders (may be empty for the seed example — that's fine).
- Suggested rewrites all marked `[stub]`.
- Ledger panel: 16 calls (5 prompts × 3 runs + 1 rewrite), all model `stub`.

- [ ] **Step 3: OpenAI-mode E2E**

Re-enable the real key, restart dev, run again. Expected:
- Latency 15–30s.
- Ledger shows real models and non-zero costs.
- Rewrite text is real (not `[stub]`).

- [ ] **Step 4: If both pass, that's done.** No further commit needed unless you tweaked something.

---

## Self-Review (run by the planner before handing off)

**Spec coverage check:** every spec section has at least one task:
- §2 Stack & deployment → Task 1 (deps, env), Task 17 (`runtime: "nodejs"`), Task 22 (README/deploy)
- §3 LLM stack → Tasks 4, 5, 6, 21 (ledger, interface/factory, stub, OpenAI)
- §4 Pipeline → Task 16
- §5 Ingestion → Task 7
- §6 Features → Task 8
- §7 Frontend → Tasks 18, 19, 20
- §8 Evaluator → Tasks 6, 10, 14, 21
- §9 Scoring → Tasks 9, 12
- §10 Observability (call ledger surfaced in UI) → Tasks 4, 20
- §11 Phasing → ordering of tasks 1–23
- §12 Definition of done → Task 23

**Type consistency check:** `LlmClient.complete` signature is identical in `client.ts`, `stubClient.ts`, `openaiClient.ts`, and at every call site. `AuditResponse` field names match between `models/audit.ts`, `auditPipeline.ts`, `auditStore.ts`, results page, and component props.

**Placeholder scan:** stub-rewrite content prefixed with `[stub]` is intentional (it's content, not a planning placeholder). No `TBD`/`TODO` in real code paths. Cost-per-1K values are explicitly noted as placeholder estimates with no behavioral effect.

**Open risks the implementer should be aware of:**
1. `openai` SDK API may have shifted slightly between versions. Task 21 Step 2 has a fallback path documented.
2. Tailwind v4 doesn't need a `tailwind.config.js`; the scaffold's `globals.css` `@import "tailwindcss"` is the configuration. Don't add a v3-style config.
3. Next 16 `params: Promise<...>` is enforced — every dynamic page/route handler must `await params`.
