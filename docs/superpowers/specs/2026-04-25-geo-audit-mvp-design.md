# GEO Audit MVP — Design Spec

**Date:** 2026-04-25
**Status:** Approved (brainstorming)
**Owner:** cline.o@northeastern.edu
**Context:** Built for an interview demo. Single-URL Generative Engine Optimization (GEO) audit tool, framed and engineered like an internal AI system at a real company.

This spec captures the decisions made during brainstorming. It refines and overrides the original `CLAUDE.md` plan where they conflict; both should be read together. The decisions log at the bottom of `CLAUDE.md` is the live record of further changes.

---

## 1. Goal

Take a single URL plus a topic and a small prompt set, and produce:

- repeated-trial visibility measurements
- a feature-level page audit
- a short, rule-based diagnosis of likely GEO weaknesses
- targeted rewrite suggestions (revised intro, bullet block, FAQ block)

Out of scope: full crawls, monitoring, CMS or Search Console integrations, multi-user features, competitor mode (cut for v1).

## 2. Stack & deployment

- **Next.js 16.2.4** + React 19 + Tailwind v4, Bun as package manager.
- **Project layout:** `app/` at repo root (Next.js 16 App Router). The original plan's `src/app/` tree is replaced by an `app/`-rooted equivalent.
- **Deploy:** Vercel. OpenAI API key in Vercel project env vars.
- **Persistence:** none. Single-shot, in-memory. Audit is computed and returned in one request. A short-TTL server-side `Map<auditId, AuditResponse>` is used to bridge the form page and the results page (see §7).
- **Auth:** none.
- **Reading prerequisite:** `node_modules/next/dist/docs/` — Next.js 16 has breaking changes from training data. Implementation must heed deprecation notices.

## 3. LLM stack

- **Provider:** OpenAI only. No multi-provider abstraction.
- **Models:** `gpt-5-mini` for high-volume prompt-trial runs; `gpt-5` for the rewrite call. Diagnosis is rule-based and does not call the LLM. Mapped behind `"fast" | "smart"` in the client.
- **Stub-first:** ship `StubLlmClient` first so the full pipeline runs end-to-end with no API key. `OpenAiLlmClient` follows. Selected by `LLM_PROVIDER=stub|openai`, default `stub`.
- **Structured outputs:** all real LLM calls use OpenAI JSON-schema mode. Zod schemas in code → JSON schema at call site. No free-text parsing.
- **Call ledger:** every LLM call is logged in-process with `{ model, purpose, latencyMs, tokensIn, tokensOut, costEstimateUsd }`. Surfaced in the UI in a collapsible "evaluation log" panel on the results page.
- **Temperatures:** `0.7` for trials (variance is required for stability scoring), `0.2` for rewrite.
- **Page truncation:** trial prompts include only the first ~3500 tokens of extracted text, cleanly cut at a paragraph boundary. A `chars / 4` heuristic for token count is acceptable; no need to pull in `js-tiktoken`.

### LlmClient interface

```ts
interface LlmClient {
  complete(args: {
    system: string;
    user: string;
    schema: ZodSchema;        // required for trial + rewrite
    model: "fast" | "smart";
    temperature?: number;
  }): Promise<{
    data: unknown;            // schema-parsed
    usage: { tokensIn: number; tokensOut: number; costEstimateUsd: number };
    latencyMs: number;
  }>;
}
```

## 4. Pipeline

```
POST /api/audit → auditPipeline(input) → { auditId, response }
  → ingest.fetchPage              network, jsdom + readability
  → features.extract              pure
  → evaluation.runTrials          uses LlmClient
  → evaluation.aggregate          pure
  → scoring.score                 pure
  → diagnosis.diagnose            pure, rule-based
  → rewrite.recommend             uses LlmClient
```

Only `runTrials` and `recommend` call the model. Everything else is deterministic and unit-testable.

### Folder layout (overrides the plan's `src/app/` tree)

```
app/
  page.tsx                    audit form
  audit/[id]/page.tsx         results
  api/
    audit/route.ts            POST: run audit, return id+payload
    audit/[id]/route.ts       GET: fetch cached audit by id
components/audit/
  audit-form.tsx
  score-cards.tsx
  feature-table.tsx
  prompt-results-table.tsx
  diagnosis-panel.tsx
  rewrite-panel.tsx
  call-ledger-panel.tsx
lib/
  models/audit.ts             shared types (zod schemas)
  ingest/fetchPage.ts
  ingest/extractReadableContent.ts
  features/extractFeatures.ts
  features/scoreFeatures.ts
  evaluation/runPromptTrials.ts
  evaluation/aggregateResults.ts
  evaluation/scoring.ts
  diagnosis/diagnoseAudit.ts
  rewrite/generateRecommendations.ts
  llm/client.ts               LlmClient interface + factory
  llm/stubClient.ts
  llm/openaiClient.ts
  llm/ledger.ts               in-memory ledger
  prompts/systemPrompts.ts
  storage/auditStore.ts       in-memory Map<id, AuditResponse> with TTL
  utils/text.ts
  utils/stats.ts
  utils/validation.ts
```

## 5. Ingestion

- `fetch` (built-in) → raw HTML, with timeout and a sane User-Agent.
- `@mozilla/readability` + `jsdom` → main-content extraction.
- A small parser pass over the readable DOM produces `{ headings[], paragraphs[], lists[][], tables[][] }`.
- Single library choice, single timeout, single error path.

## 6. Feature extraction (10 features, not 12)

All 0..1, all pure functions in `features/extractFeatures.ts`. `redundancyScore` and `keywordFocusScore` from the original plan are dropped — noisy and overlapping with `entityClarityScore`.

| Feature | Heuristic |
|---|---|
| `hasIntroSummary` | First paragraph 40–250 words AND no question mark in heading above it → 1 else 0 |
| `headingDepthScore` | Has h2s + at least one h3 → 1; only h2s → 0.6; only h1 → 0.2 |
| `listDensity` | `(list_items + table_rows) / total_blocks`, clamped |
| `contentLengthScore` | Piecewise: <300w→0.2, 300–800→0.6, 800–2500→1, >2500→0.7 |
| `statisticsDensity` | Regex count of `\d+%`, `\$\d`, `\d+(\.\d+)?\s?(million\|bn\|x\|×)` per 100 words |
| `authoritySignalDensity` | Counts of "according to", "study", "research", cited author names per 100 words |
| `externalSourceSignal` | Outbound `<a>` tags to non-same-domain hosts, normalized |
| `technicalTermDensity` | Topic terms (split from `input.topic`) per 100 words |
| `readabilityScore` | Flesch reading ease, mapped to 0..1 (target ~60–70) |
| `entityClarityScore` | Title contains topic terms AND first 100 words contain topic terms |

## 7. Frontend

- **Form on `/`** — single client component. Submits to `POST /api/audit`, gets `{ auditId }`, then `router.push('/audit/{auditId}')`.
- **Results on `/audit/[id]`** — server component reads the audit by ID from the in-memory store and renders. If missing/expired: render a small "Audit expired, run a new one" page with a link back to `/`.
- **In-memory store:** `Map<string, AuditResponse>`, ~10 minute TTL with lazy GC on access. Survives page reloads in-session, not server restarts. Acceptable for the demo.
- **Loading UX:** single client-side spinner during submit with rotating hardcoded phase labels — *"Fetching page… → Extracting features… → Running N trials… → Generating recommendations…"*. No SSE; if asked, the answer is "yes, that's the upgrade path."
- **Visual style:** deferred. User will specify when we reach the frontend phase; the `frontend-design` skill is invoked at that point.
- **Components:** `audit-form`, `score-cards`, `feature-table`, `prompt-results-table`, `diagnosis-panel`, `rewrite-panel`, `call-ledger-panel`.
- **Honesty banner:** cut.
- **Seed example button** in the form autofills a real public URL + topic + 5 prompts so the demo is one click.

## 8. Evaluator behaviour

### Stub (`StubLlmClient`)

Feature-correlated, seeded by `(prompt, runIndex)`:

```
mentionProb   = 0.3 + 0.4 * featureReadinessScore + jitter(seed)
evidenceProb  = mentionProb * (0.5 + 0.5 * statisticsDensity)
prominence    = clamp(0.2 + 0.6 * hasIntroSummary + 0.2 * listDensity + jitter)
```

Thresholded into `mentioned: bool`, `evidenceUsed: bool`, `prominenceScore: 0..1`. Same audit is reproducible; cross-run jitter is enough that variance/stability scoring is non-trivial. Stub rewrite/diagnosis returns canned-but-shaped responses driven by the lowest-scoring features.

### Real (`OpenAiLlmClient`, trial path)

```
SYSTEM:
You are a search-answer engine. You will be given the contents of one
candidate web page and a user query. Decide whether you would use this
page when answering the query, and how prominently. Respond as JSON
matching the provided schema. Do not invent facts.

USER:
<query>{prompt}</query>
<candidate_page url="{url}" title="{title}">
{first ~3500 tokens, cut at paragraph}
</candidate_page>

Output (schema): { mentioned, evidenceUsed, prominenceScore, notes }
```

### Diagnosis (rule-based, pure)

In `diagnoseAudit.ts`, 6–8 rules with explicit thresholds, each returning at most one item. Output trimmed to top 3–5 by severity. Examples:

- `hasIntroSummary < 0.5 && entityClarityScore < 0.4` → "weak extractability" (high)
- `statisticsDensity < 0.2 && evidenceUseRate < 0.3` → "insufficient factual grounding" (high)
- `listDensity < 0.15 && avgProminence < 0.4` → "poor chunkability" (medium)
- `authoritySignalDensity < 0.15` → "weak trust/corroboration cues" (medium)
- `varianceAcrossPrompts > threshold` → "narrow topic coverage / low robustness" (medium)

### Rewrite (`gpt-5`, structured)

Single call. Input: `(extractedPage truncated, top 3 diagnosis items, target features to improve)`. Output schema: `{ revisedIntro: string, bulletBlock: string[], faqBlock: { q: string; a: string }[] }`. `temperature = 0.2`.

## 9. Scoring (unchanged from plan)

```ts
visibilityScore       = 0.5*mentionRate + 0.3*evidenceUseRate + 0.2*prominenceScore
stabilityScore        = 1 - normalizedVariance
featureReadinessScore = 0.3*extractability + 0.2*factualDensity
                      + 0.2*structureChunkability + 0.15*authorityTrustSignals
                      + 0.15*entityKeywordClarity
geoReadinessScore     = 0.5*visibilityScore + 0.2*stabilityScore + 0.3*featureReadinessScore
```

Composite factors are mapped from the 10 features as follows (defined inline in `scoring.ts`):

```
extractability        = 0.6*hasIntroSummary + 0.4*headingDepthScore
factualDensity        = 0.6*statisticsDensity + 0.4*authoritySignalDensity
structureChunkability = 0.6*listDensity + 0.4*headingDepthScore
authorityTrustSignals = 0.5*authoritySignalDensity + 0.5*externalSourceSignal
entityKeywordClarity  = 0.6*entityClarityScore + 0.4*technicalTermDensity
```

`contentLengthScore` and `readabilityScore` feed `featureReadinessScore` indirectly via a small `+ 0.05` adjustment each (or are wired in during implementation if they materially improve the diagnosis-driven UX). Implementer may tune these weights once tested on real pages — they are starting values, not invariants.

## 10. Observability

In-memory call ledger only — no external sink for v1. Surfaced in the UI as a collapsible panel on the results page showing total calls, total latency, total cost estimate, and a per-call table. The ledger is part of the `AuditResponse` payload, so it persists with the cached audit.

## 11. Phasing

Backend before frontend. Phase order from the plan stands, with these adjustments:

- **Phase 0:** scaffold matches Next 16 / `app/` layout, not `src/app/`.
- **Phase 3 (evaluator):** stub first, full pipeline must run end-to-end on stub before any OpenAI work.
- **Phase 7 (unified API):** also adds the in-memory audit store and `GET /api/audit/[id]`.
- **Phase 9 (results page):** uses `app/audit/[id]/page.tsx`, not inline render.
- **Real OpenAI evaluator** is introduced after Phase 9 once stub demo is solid; behind the `LLM_PROVIDER` env var.

## 12. Definition of done

A demoable run that:

1. Form on `/` → submit URL/topic/5 prompts/3 runs.
2. Lands on `/audit/[id]` within ~30s on real mode, ~2s on stub.
3. Shows score cards, diagnosis, recommendations, feature bars, prompt-results table, suggested rewrites, and a collapsible call ledger.
4. Works on a fresh `bun dev` with no API key (stub mode).
5. Works on Vercel with `LLM_PROVIDER=openai` and a real key.

## 13. Open items deferred to implementation

- Exact wording of system prompts for trial and rewrite calls.
- Cost-estimate constants per model (look up at implementation time).
- Seed example URL + prompts (pick a real public page during Phase 10 polish).
- Visual design — user will specify before frontend work begins.
