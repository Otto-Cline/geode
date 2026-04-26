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
