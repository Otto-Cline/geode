# Geode

A single-URL Generative Engine Optimization (GEO) audit tool. Given a page URL, a topic, and a small prompt set, it measures how recommendation-ready the page is for AI answer engines, diagnoses why, and proposes targeted edits.

## Run locally

```bash
bun install
bun run dev
```

Open `http://localhost:3000`. Defaults to **stub mode** — no API key needed; the LLM calls return seeded synthetic data so the full pipeline runs end-to-end.

To use real OpenAI:

```env
# .env.local
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

## What happens during an audit

A `POST /api/audit` request runs this pipeline (see `lib/pipeline/auditPipeline.ts`):

| Step | Module | What it does |
|---|---|---|
| 1. **Ingest** | `lib/ingest/` | Fetches the URL with a 15s timeout and runs Mozilla Readability over the HTML to pull out clean headings, paragraphs, lists, tables, and outbound link counts. |
| 2. **Feature extraction** | `lib/features/extractFeatures.ts` | Computes 10 deterministic 0..1 page-level signals (intro summary, heading depth, list density, statistics density, authority signals, readability, entity clarity, etc.). No LLM. |
| 3. **Composite scoring** | `lib/features/scoreFeatures.ts` | Maps the 10 features into 5 weighted composites (extractability, factual density, chunkability, authority, entity clarity) and a single `featureReadinessScore`. |
| 4. **Prompt trials** | `lib/evaluation/runPromptTrials.ts` | For each user prompt × N runs, asks the LLM (acting as an answer engine) whether it would mention the page, cite evidence from it, and how prominently. Results in a `mentioned`/`evidenceUsed`/`prominenceScore` per trial. |
| 5. **Aggregation** | `lib/evaluation/aggregateResults.ts` | Per prompt: mention rate, evidence rate, mean prominence, variance across runs. |
| 6. **Final scores** | `lib/evaluation/scoring.ts` | Visibility (0.5·mentions + 0.3·evidence + 0.2·prominence), Stability (1 − normalized variance), Feature Readiness, and an overall **GEO Readiness** = 0.5·V + 0.2·S + 0.3·F. |
| 7. **Diagnosis** | `lib/diagnosis/diagnoseAudit.ts` | Pure rule-based — runs 7 thresholds over features+aggregates, returns top 5 issues sorted by severity. No LLM. |
| 8. **Rewrite** | `lib/rewrite/generateRecommendations.ts` | One structured LLM call. Returns: a surgical word-level revision of the intro, 1–3 paragraph-level surgical edits, 0–5 structural recommendations (heading inserts, summary boxes, comparison tables, schema.org JSON-LD, etc.), plus net-new bullet and FAQ blocks. |

Every LLM call is recorded in an in-process **Call Ledger** (model, latency, tokens, cost estimate) and surfaced in the UI as a collapsible "Evaluation log" panel.

The full audit response is held in an in-memory `Map<auditId, AuditResponse>` with a 10-minute TTL so the form page can submit, get back an ID, and route to `/audit/[id]`.

## Frontend at a glance

- `/` — form: URL, topic, prompts (one per line), runs per prompt. Includes a **"✨ Generate from topic"** button that hits `/api/generate-prompts` to populate prompts via the LLM, and a **"Use example"** seed.
- `/audit/[id]` — results, with these panels:
  - **Score cards** — GEO Readiness, Visibility, Stability, Feature Readiness (color-coded by tone)
  - **Diagnosis** — rule-based top-5, severity-coded
  - **Suggested edits** — intro diff, paragraph diffs, structural recommendation cards, bullet block, FAQ block
  - **Page features** — bar chart of all 10 features, hoverable for what each measures
  - **Prompt results** — per-prompt mention/evidence/prominence/spread table
  - **Evaluation log** — collapsible call ledger
- Every panel and metric has a hover tooltip explaining what it measures.

## LLM client

Behind one `LlmClient` interface (`lib/llm/client.ts`) with two implementations:
- **`StubLlmClient`** — deterministic, feature-correlated synthetic responses. Lets the entire pipeline run with no API key.
- **`OpenAiLlmClient`** — real OpenAI calls with structured outputs (zod → JSON-schema), auto cost estimation.

Selected by `LLM_PROVIDER=stub|openai` (default `stub`). Models: `gpt-5-mini` for high-volume trial runs, `gpt-5` for the rewrite call.

## Auth gate (production)

A shared-password gate guards every route when `AUTH_SECRET` is set:
- `middleware.ts` checks an HMAC-SHA256-signed cookie on every page and `/api/*` request
- `/login` page submits to `/api/login`, which compares against `DEMO_PASSWORD` and sets a 24h httpOnly cookie
- Locally, leave `AUTH_SECRET` unset and the middleware no-ops — `bun dev` works without sign-in

## Configuration

```env
# .env.local
LLM_PROVIDER=stub        # or "openai"
OPENAI_API_KEY=          # required when LLM_PROVIDER=openai
DEMO_PASSWORD=           # optional. Shared password for production.
AUTH_SECRET=             # optional. 32-byte hex (openssl rand -hex 32). Required if DEMO_PASSWORD is set.
```

## Tests

```bash
bun run test
```

30 tests covering the pure logic — feature extraction, scoring, aggregation, diagnosis, the stub client, and the helper utilities. Network-bound code (`fetchPage`, `OpenAiLlmClient`) and React components are exercised via the end-to-end smoke test.

## Deploy

Vercel: connect the repo, set the four env vars above (plus a generated `AUTH_SECRET` if you want the gate enabled), deploy. The audit route uses `runtime: "nodejs"` and `maxDuration: 60` so jsdom + multiple model calls have headroom. Set an OpenAI hard usage cap as a real safety net.

## Architecture

Full design spec in `docs/superpowers/specs/2026-04-25-geo-audit-mvp-design.md`. Implementation plan in `docs/superpowers/plans/2026-04-25-geo-audit-mvp.md`. Live decisions log appended to `CLAUDE.md`.
