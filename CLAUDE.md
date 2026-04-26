@AGENTS.md

````md
# GEO Audit MVP — Claude Code Plan

## Goal

Build a narrow, scientifically grounded MVP for **Generative Engine Optimization (GEO) auditing**.

The app should:

- take a **single URL**
- take a **topic + small prompt set**
- optionally take **competitor URLs**
- produce:
  - repeated-run visibility measurements
  - a feature-level page audit
  - diagnosis of likely GEO weaknesses
  - targeted rewrite suggestions

This is **not** a full GEO platform.  
It is a **single-URL audit tool** with a strong research basis and a clean demo surface.

---

## Product framing

> A GEO audit tool that measures how recommendation-ready a page is for answer engines, diagnoses why it underperforms, and generates targeted improvements.

We are **not** claiming to replicate ChatGPT’s hidden ranking or citation system exactly.  
We are building a **controlled audit framework** grounded in recent GEO papers:

1. **Repeated measurement matters**  
   Visibility in AI search is stochastic, so one-off measurements are misleading.

2. **Feature-level page properties matter**  
   Structure, factual density, list density, clarity, and authority signals are important.

3. **Diagnosis should come before rewriting**  
   Generic rewriting is weaker than targeted, page-specific fixes.

---

## Tech stack

Use **Next.js + TypeScript** for both frontend and backend.

Recommended:

- Next.js App Router
- TypeScript everywhere
- Tailwind for UI
- simple file/local JSON persistence for MVP, or SQLite if easy
- server-side routes in `app/api/...`
- no auth in MVP unless it’s trivial

---

## Non-goals

Do **not** build:

- full domain crawl
- long-running monitoring
- CMS integrations
- Search Console integrations
- background job orchestration if avoidable
- true browser-scale search engine simulation
- enterprise multi-user features

Keep the scope tight.

---

# High-level architecture

## User flow

1. User enters:

   - URL
   - topic
   - 5–10 prompts
   - optional competitor URLs

2. Backend:

   - fetches and extracts page content
   - computes feature vector
   - runs repeated prompt evaluations
   - aggregates visibility metrics
   - diagnoses weaknesses
   - generates rewrite suggestions

3. Frontend shows:
   - overall GEO readiness
   - visibility + stability
   - feature audit
   - top issues
   - suggested rewrite plan

---

## Core backend modules

### 1. Page ingestion

Input: URL  
Output:

- normalized text
- title
- meta description
- headings
- lists
- tables
- raw HTML snapshot if useful

### 2. Feature extraction

Compute interpretable page features like:

- intro summary present
- heading depth/quality
- list density
- content length
- stats / number density
- authority signal density
- external source mention density
- technical term density
- readability
- keyword/entity focus
- redundancy / fluff

### 3. Visibility evaluation

For each prompt:

- run repeated trials
- evaluate whether page content is:
  - selected
  - mentioned
  - used as evidence
  - prominent in final answer

If competitors are provided:

- compare target page vs competitor pages in the same evaluation

### 4. Aggregation + scoring

Compute:

- mention rate
- evidence use rate
- prominence score
- variance / stability
- feature readiness score
- overall GEO readiness score

### 5. Diagnosis

Map weak performance + weak features into a small set of reasons:

- weak extractability
- low factual density
- poor structure
- unclear entity focus
- weak authority signals
- poor comparison readiness
- insufficient topic coverage

### 6. Rewrite recommendation

Produce:

- prioritized fixes
- feature-target changes
- suggested revised intro / summary / bullets / FAQ / comparison block

---

# Suggested folder structure

```txt
src/
  app/
    page.tsx
    audit/
      page.tsx
    api/
      audit/route.ts
      extract/route.ts
      evaluate/route.ts
  components/
    audit/
      audit-form.tsx
      score-cards.tsx
      feature-table.tsx
      prompt-results-table.tsx
      diagnosis-panel.tsx
      rewrite-panel.tsx
  lib/
    models/
      audit.ts
    ingest/
      fetchPage.ts
      extractReadableContent.ts
    features/
      extractFeatures.ts
      scoreFeatures.ts
    evaluation/
      runPromptTrials.ts
      aggregateResults.ts
      scoring.ts
    diagnosis/
      diagnoseAudit.ts
    rewrite/
      generateRecommendations.ts
    prompts/
      systemPrompts.ts
    utils/
      text.ts
      stats.ts
      validation.ts
```
````

---

# Data model

## Audit input

```ts
type AuditInput = {
  url: string;
  topic: string;
  prompts: string[];
  competitorUrls?: string[];
  runsPerPrompt: number;
};
```

## Extracted page

```ts
type ExtractedPage = {
  url: string;
  title: string;
  metaDescription?: string;
  headings: string[];
  paragraphs: string[];
  lists: string[][];
  tables: string[][];
  fullText: string;
};
```

## Feature vector

```ts
type PageFeatures = {
  hasIntroSummary: number;
  headingDepthScore: number;
  listDensity: number;
  contentLengthScore: number;
  statisticsDensity: number;
  authoritySignalDensity: number;
  externalSourceSignal: number;
  technicalTermDensity: number;
  readabilityScore: number;
  keywordFocusScore: number;
  redundancyScore: number;
  entityClarityScore: number;
};
```

## Prompt trial result

```ts
type PromptTrialResult = {
  prompt: string;
  runIndex: number;
  mentioned: boolean;
  evidenceUsed: boolean;
  prominenceScore: number;
  notes?: string;
};
```

## Aggregated results

```ts
type AggregatedPromptResult = {
  prompt: string;
  mentionRate: number;
  evidenceUseRate: number;
  avgProminence: number;
  variance: number;
};

type AuditScores = {
  visibilityScore: number;
  stabilityScore: number;
  featureReadinessScore: number;
  geoReadinessScore: number;
};
```

## Diagnosis + recommendations

```ts
type DiagnosisItem = {
  label: string;
  severity: "high" | "medium" | "low";
  explanation: string;
};

type RecommendationItem = {
  priority: number;
  title: string;
  why: string;
  suggestedChange: string;
};
```

---

# Scoring approach

Keep the scoring simple and explicit.

## Visibility score

```ts
visibilityScore =
  0.5 * mentionRate + 0.3 * evidenceUseRate + 0.2 * prominenceScore;
```

## Stability score

Stability should decrease when variance across repeated runs is high.

```ts
stabilityScore = 1 - normalizedVariance;
```

## Feature readiness score

Weighted from interpretable page features:

```ts
featureReadinessScore =
  0.3 * extractability +
  0.2 * factualDensity +
  0.2 * structureChunkability +
  0.15 * authorityTrustSignals +
  0.15 * entityKeywordClarity;
```

## Final GEO readiness

```ts
geoReadinessScore =
  0.5 * visibilityScore + 0.2 * stabilityScore + 0.3 * featureReadinessScore;
```

Do not overcomplicate this for the MVP.

---

# Evaluation strategy

## Important constraint

We do **not** have access to the real internal ranking/citation logic of ChatGPT.

So the evaluation should be framed as:

- a **controlled proxy**
- repeated and structured
- useful for diagnosis, not a perfect simulation

## MVP evaluation method

For each prompt:

1. Provide the model with:
   - target page extracted content
   - optional competitor page summaries/content
   - prompt
2. Ask the model to answer the user query using the provided materials
3. Record whether the target page:
   - gets mentioned
   - gets used as evidence
   - has strong prominence

Repeated over multiple runs to estimate stability.

This is enough for a demo.

## Optional simplification

If full multi-document evaluation starts getting too big:

- start with **target page only**
- evaluate whether the page appears recommendation-ready for the prompt
- add competitor comparisons only after core flow works

That is safer.

---

# Phase plan

Keep phases small.  
Backend first.  
Do not jump ahead.

---

## Phase 0 — Project setup

### Goal

Create a minimal Next.js TypeScript app skeleton with clear module boundaries.

### Tasks

- initialize Next.js app with TypeScript
- add Tailwind
- create folder structure
- define shared types
- add a basic home page with “coming soon” audit form shell
- add linting / formatting if needed

### Deliverable

Project boots cleanly and has typed scaffolding.

### Done when

- app runs
- types compile
- no real logic yet

---

## Phase 1 — URL ingestion backend

### Goal

Fetch a URL and extract usable page content.

### Tasks

- implement `fetchPage(url)`
- implement `extractReadableContent(html)`
- parse:
  - title
  - meta description
  - headings
  - paragraphs
  - lists
  - tables if easy
- normalize whitespace
- return `ExtractedPage`

### API route

- `POST /api/extract`

### Deliverable

Given a URL, backend returns structured extracted content.

### Done when

- can input a real URL
- get clean extracted content JSON back
- extraction works on a few sample pages

### Notes

Keep this robust and simple.  
Do not overbuild crawling.

---

## Phase 2 — Feature extraction backend

### Goal

Turn extracted content into a feature vector inspired by GEO papers.

### Tasks

- implement `extractFeatures(extractedPage)`
- compute initial features:
  - `hasIntroSummary`
  - `headingDepthScore`
  - `listDensity`
  - `contentLengthScore`
  - `statisticsDensity`
  - `authoritySignalDensity`
  - `externalSourceSignal`
  - `technicalTermDensity`
  - `readabilityScore`
  - `keywordFocusScore`
  - `redundancyScore`
  - `entityClarityScore`
- implement simple normalization to 0–1

### API route

- optionally fold into `/api/audit`, but build module separately first

### Deliverable

A stable feature JSON object for a single page.

### Done when

- extracted content produces a readable feature vector
- logic is deterministic and easy to inspect

### Notes

Prefer transparent heuristics over fake sophistication.

---

## Phase 3 — Prompt trial evaluator backend

### Goal

Run repeated prompt evaluations for a single page.

### Tasks

- define evaluation prompt template
- implement `runPromptTrials()`
- input:
  - target page content
  - topic
  - prompts
  - runs per prompt
- output per trial:
  - `mentioned`
  - `evidenceUsed`
  - `prominenceScore`
  - short notes

### Deliverable

Backend can evaluate one page against a small prompt set and return trial-level results.

### Done when

- results exist for 5 prompts × N runs
- output format is stable
- no frontend dependency required

### Notes

This is a proxy evaluator.  
Be explicit in comments and docs that this is not a faithful replica of ChatGPT internals.

---

## Phase 4 — Aggregation + scoring backend

### Goal

Aggregate raw trial results into useful summary scores.

### Tasks

- implement `aggregateResults()`
- implement `scoring.ts`
- compute:
  - per-prompt mention rate
  - per-prompt evidence use rate
  - per-prompt average prominence
  - per-prompt variance
  - overall visibility score
  - overall stability score
  - feature readiness score
  - GEO readiness score

### Deliverable

A single backend response containing:

- extracted page
- feature vector
- prompt summary results
- top-level scores

### Done when

- one API call can return a coherent audit payload

---

## Phase 5 — Diagnosis backend

### Goal

Convert weak scores/features into a short, believable diagnosis.

### Tasks

- implement `diagnoseAudit()`
- create mapping rules like:
  - low intro summary + weak entity clarity → “weak extractability”
  - low stats density + low evidence use → “insufficient factual grounding”
  - low list density + low prominence → “poor chunkability”
  - low authority signals → “weak trust/corroboration cues”
  - unstable prompt performance → “narrow topic coverage / low robustness”
- output top 3–5 issues only

### Deliverable

A compact diagnosis block with severity and explanation.

### Done when

- diagnoses look plausible on a few sample pages
- output is short and specific

### Notes

Do not make this a giant reasoning engine.  
Simple rule-based diagnosis is fine for MVP.

---

## Phase 6 — Rewrite recommendation backend

### Goal

Generate targeted improvement suggestions from diagnosis + features.

### Tasks

- implement `generateRecommendations()`
- produce:
  - prioritized fix list
  - feature-target spec
  - one rewritten intro/summary block
  - one suggested bullet block or FAQ block
- keep recommendations modular, not full-page rewrites

### Deliverable

Actionable recommendation payload.

### Done when

- each audit returns a small set of concrete improvements
- rewrite suggestions align with diagnosis

### Notes

Prefer:

- intro summary
- bullet block
- comparison snippet
- FAQ block

Do not try to regenerate entire pages.

---

## Phase 7 — Single unified audit API

### Goal

Expose one clean endpoint that runs the full backend flow.

### Tasks

- implement `POST /api/audit`
- flow:
  1. ingest page
  2. extract features
  3. run prompt trials
  4. aggregate scores
  5. diagnose
  6. generate recommendations
- return a single typed response object

### Deliverable

One endpoint powers the whole MVP.

### Done when

- can send URL/topic/prompts
- get complete audit response back

---

## Phase 8 — Minimal frontend form

### Goal

Build the smallest usable frontend for running audits.

### Tasks

- create audit form with fields:
  - URL
  - topic
  - prompts
  - optional competitor URLs
  - runs per prompt
- submit to `/api/audit`
- show loading + error states

### Deliverable

A working input screen.

### Done when

- can run an audit from browser without manual API calls

### Notes

Keep this plain and reliable.

---

## Phase 9 — Results dashboard frontend

### Goal

Render the audit results cleanly.

### Tasks

Build these sections:

- score cards:
  - GEO readiness
  - visibility
  - stability
  - feature readiness
- prompt results table
- feature table or simple radar/bar chart
- diagnosis panel
- recommendations panel
- before/after rewrite snippet

### Deliverable

A demo-ready results page.

### Done when

- results are understandable in 30 seconds on screen share

### Notes

Clarity beats visual flair.

---

## Phase 10 — Polish for demo

### Goal

Make the MVP credible and easy to present tomorrow.

### Tasks

- add seed example inputs
- improve loading states
- add empty states
- add small explainer text:
  - “proxy evaluation”
  - “repeated runs”
  - “feature-level audit”
- test on 2–3 real URLs
- fix edge cases

### Deliverable

A demoable app that doesn’t feel brittle.

### Done when

- you can walk through:
  1. input
  2. audit run
  3. scores
  4. diagnosis
  5. rewrite plan

---

# Execution order rules

Claude should follow these rules strictly:

1. **Backend before frontend**
2. Complete one phase before starting the next
3. Keep files small and modular
4. Do not introduce infra complexity unless clearly necessary
5. Prefer deterministic heuristics over big speculative abstractions
6. If a phase starts expanding, cut scope instead of generalizing
7. Avoid premature competitor logic if single-page flow is not solid
8. Ship a narrow, believable demo rather than a broad half-built system

---

# Suggested first build target

If time is tight, aim to fully complete only this subset:

- Phase 0
- Phase 1
- Phase 2
- Phase 4
- Phase 5
- Phase 8
- Phase 9

And stub Phase 3 with a simplified evaluator if needed.

That still gives a solid demo:

- URL in
- feature audit
- scores
- diagnosis
- rewrite suggestions

---

# Nice-to-have only if ahead of schedule

- competitor comparison mode
- saved audit history
- downloadable markdown report
- visual radar chart
- side-by-side page diff
- multiple rewrite variants

---

# Definition of success

A successful MVP lets someone:

1. paste in a URL
2. choose a topic and a few prompts
3. run an audit
4. immediately understand:
   - how recommendation-ready the page is
   - where it is weak
   - what to change first

That is enough.

---

# Final instruction to Claude Code

Build this as a **tight, credible MVP**, not a platform.

Bias toward:

- small phases
- strong typing
- understandable logic
- backend correctness
- demo clarity

If a decision is ambiguous, choose the option that reduces scope and gets to a believable end-to-end audit faster.

```

---

# Decisions log (live)

Decisions made during brainstorming that override or refine the plan above. Append, don't edit history. Most recent at the bottom.

## Stack & deployment
- **Project layout:** `app/` at repo root (Next.js 16 App Router), not `src/app/` as the plan above shows. Adjust the plan's folder tree accordingly when implementing.
- **Runtime:** Next.js 16.2.4 + React 19 + Tailwind v4, Bun as package manager (bun.lock committed).
- **Deploy target:** Vercel. OpenAI key goes in Vercel project env vars.
- **Persistence:** none. Single-shot, in-memory. No JSON file, no SQLite. Audit is computed and returned in one request.
- **Auth:** none.

## LLM stack
- **Provider:** OpenAI only. No multi-provider abstraction beyond what's needed for the stub/real swap.
- **Models:** `gpt-5-mini` for high-volume prompt-trial runs, `gpt-5` for diagnosis + rewrite. Mapped behind `"fast" | "smart"` in the client.
- **Stub-first:** ship `StubLlmClient` first so the full pipeline runs end-to-end with no API key. Real `OpenAiLlmClient` added after stub works. Selected by `LLM_PROVIDER=stub|openai` env var, default `stub`.
- **Call ledger:** every LLM call logged with model, latency, token usage, cost estimate. **Surfaced in the UI** in a collapsible "evaluation log" panel on the results page.

## Scope cuts from the plan
- **Competitor mode: cut for v1.** Target page only. Re-add later if there's time.
- **Phase 3 evaluator:** stubbed first per the plan's "optional simplification" — real OpenAI evaluator after the stub pipeline works.

## Feature extraction
- **Ship 10 features, not 12.** Drop `redundancyScore` and `keywordFocusScore` — noisy on real pages and overlap with `entityClarityScore`. Spend the saved time on prompt quality.
- **Ingestion:** `@mozilla/readability` + `jsdom` for main-content extraction. Single library choice, single timeout, single error path.
- **All feature heuristics are pure functions** in one file, deterministic, unit-testable, no LLM calls in the feature layer.

## Pipeline shape
```
POST /api/audit → auditPipeline(input)
  → ingest.fetchPage
  → features.extract              (pure)
  → evaluation.runTrials          (uses LlmClient)
  → evaluation.aggregate          (pure)
  → scoring.score                 (pure)
  → diagnosis.diagnose            (pure, rule-based)
  → rewrite.recommend             (uses LlmClient)
```
Diagnosis is rule-based and pure — no LLM. Only `runTrials` and `recommend` call the model.

## Demo context
- Built for an interview demo. Should "look like real internal AI systems engineering": clean provider abstraction, structured outputs, observability via the call ledger, env-based config.

## Evaluator details
- **Stub is feature-correlated, not random.** Stub trial outputs derive from the actual `featureReadinessScore`, `statisticsDensity`, `hasIntroSummary`, `listDensity`, with seeded jitter on `(prompt, runIndex)` so the same audit is reproducible but stability/variance scoring is non-trivial.
- **Real evaluator:** structured-output JSON-schema call to OpenAI per trial. `temperature = 0.7` for trials (variance is required for stability scoring). `temperature = 0.2` for diagnosis/rewrite. Diagnosis is rule-based and pure — only `runTrials` and `recommend` call the LLM.
- **Page truncation:** trial prompts include only the first ~3500 tokens of extracted text, cleanly cut at paragraph boundary.

## Frontend
- **Routing:** form on `/`, results on a separate audit results page. Server keeps an in-memory `Map<auditId, AuditResponse>` with short TTL; results page reads by ID. Survives page reloads within session, not server restarts (fine for demo).
- **Honesty banner:** cut.
- **Loading UX:** single client-side spinner with rotating hardcoded phase labels (no SSE).
- **Look & feel:** deferred. User will specify visual direction when we reach the frontend phase; use the `frontend-design` skill at that point.

```
