# cubby

Dump anything. Ask anything. Nothing leaves your device.

`cubby` is a local-first memory for the things you save and lose — links,
notes, addresses, snippets, the wifi password, that command. You paste
them in with zero effort (no folders, no tags) — by paste or by the OS
Share sheet on mobile — and later ask for them in plain words. An
open-weight embedding model (**EmbeddingGemma**) runs entirely in your
browser tab and ranks your question against what you saved with a hybrid
of semantic meaning and keyword match, offline.

This is a submission for the [Hacktoberfest Open-Source AI Challenge:
Week 3 — Slow and Steady](https://dev.to/events/challenges/hacktoberfest-week3-2026-10-19).

## Why it exists

Everyone has the "I know I saved that somewhere" problem. You copy ~50
things a day and lose most of them. The usual fixes ask you to *organize*
— folders, tags, a system you abandon in a week. `cubby` asks for nothing:
dump it and forget it. The model does the remembering. You just ask.

The sloth thesis, literally: conserve your energy. Don't file. Don't tag.
Let the model find it.

## What makes it honest

- **Fully local.** Your dumps — passwords, addresses, private notes —
  never touch a server. The model is a file the app downloads once and
  runs in the tab. No account, no API key, no network call after load.
- **Plays to the model's real strength.** This is semantic *retrieval*
  (embeddings), not text *generation*. Small open models are genuinely
  good at retrieval and weak at writing prose — `cubby` only asks the
  model to do the thing it's good at.
- **Works offline.** After the first load, close the wifi. The shell and
  the model are cached; search keeps working on a plane.

## Status

Code complete through D4 (code freeze — see `docs/PLAN.md`'s decisions
log). See `docs/` for the full build:
- `docs/PLAN.md` — scope, non-goals, day-by-day plan, decisions log
- `docs/SPEC.md` — features, user flows, data shapes, acceptance criteria
- `docs/ARCHITECTURE.md` — model, embeddings, storage, search pipeline
- `docs/UI.md` — the minimal + terminal aesthetic, 5 themes × light/dark
- `docs/RISKS.md` — risk register with mitigations and kill-switches
- `test/queries.md` — the D4 recall measurement and honesty table

## Run it

```bash
npm ci
npm run dev       # dev server
npm run build     # production build + service worker
npm run preview   # serve the production build locally
```

## Deploy

`render.yaml` is a Render static-site blueprint (build `npm ci && npm run
build`, publish `dist`, SPA-rewrite every route to `index.html` so
`/share` and client-side navigation work). On Render: **New → Blueprint**,
point it at this repo. No environment variables or secrets needed — the
model downloads client-side from the Hugging Face hub at runtime.

## Stack

React 19 + Vite, static site on Render. `@huggingface/transformers`
(transformers.js) running EmbeddingGemma in-browser on WebGPU with a WASM
fallback. IndexedDB for items and vectors, cosine similarity in plain JS.
No backend of any kind.
