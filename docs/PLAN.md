# cubby — PLAN

Name: **cubby**. Checked for prominent GitHub collisions before locking
(CubbyFlow ★305 was the closest hit — low enough to proceed). Repo is
**private** until the submission window; made public later only on
explicit instruction.

## The one-liner

Toss anything into your cubby with zero effort; ask for it later in
plain words; the model does the remembering; nothing leaves the device.

## Goals (what "done" means)

1. A static web app, deployed live on Render, that loads an open-weight
   embedding model in-browser and works fully offline after first load.
2. **Dump:** paste any text/link/snippet, one keypress saves it, no tags
   or folders required. Embedded on save, stored locally.
3. **Share-to-cubby:** on mobile, the OS Share sheet can send text/links
   straight into cubby without opening the app — the lowest-friction
   capture path there is (PWA Web Share Target).
4. **Ask:** a command bar that ranks the cubby by a hybrid of semantic
   (embedding cosine) and lexical score against a plain-language query,
   so an exact word match never loses to a weak semantic guess.
   Highlights the hit, copies/opens on Enter.
5. **Keyboard-first:** the whole loop (focus, type, arrow, copy) works
   without the mouse.
6. **Themes:** light + dark, and a picker across 5 named themes, both
   persisted.
7. An honest measurement of retrieval quality on a fixed test set, with
   the failures written up (the HushQuote-style honesty table).
8. A DEV post that shows the lazy payoff with a real number.

## Non-goals (explicitly out, say so in the post)

- **No generation.** `cubby` does not write summaries or answers. It
  retrieves. (Optional: one-line highlight of the matched span — pure
  string work, not model generation. Kept minimal.)
- **No background daemon / OS clipboard watching** in v1. You paste into
  the app; it does not read your system clipboard in the background.
  (That's the sticky desktop version — a post-hackathon note.)
- **No image/OCR ingestion** in v1. Text only. "Screenshot-of-text"
  support is a later lever (needs an on-device OCR/vision model).
- **No sync, no account, no cloud.** Single device. Export/import JSON is
  the only portability.
- **No server.** If a feature needs a backend, it is out of scope.

## Day plan (challenge window: Oct 19–25, submit Oct 25 23:59 PDT)

- **D1 — shell + manual mode.** Scaffold React 19 + Vite. Build the dump
  box + ask bar + results list + theme system (all 5 themes, light/dark)
  against a **mock scorer** (keyword stand-in, already prototyped). No
  model yet. Deploy to Render on day one — every day ends on a live URL.
  Manual mode (keyword search) is a working, submittable product by
  itself: the floor.
- **D2 — real embeddings.** Wire transformers.js + EmbeddingGemma.
  Embed-on-save, cosine search, first-run model download with progress.
  Verify the model id + ONNX availability first (RISKS R1). Replace the
  mock scorer; keep it as the offline/unsupported-device fallback.
- **D3 — persistence + offline + capture.** IndexedDB for items + vectors.
  Service worker to precache shell + model (offline PWA). Export/import
  JSON. Delete item. Settings persistence. **Share-to-cubby**: manifest
  `share_target` + a `/share` route that writes straight to the store
  without opening the full UI — verify on a real Android device (iOS
  Safari's Web Share Target support is weaker; document the gap honestly
  rather than claim it works everywhere).
- **D4 — measure + polish.** Build the fixed query/expected-hit test set
  (the "20 transcripts" equivalent), run it, record recall and the
  misses honestly — including a before/after on **hybrid ranking**
  (semantic-only vs semantic+lexical) so the lift is a real measured
  number, not a claim. Polish motion, keyboard, empty states, a11y. Code
  freeze D4 night.
- **D5 — writing only.** The DEV post. The heaviest judging criterion
  (Writing Quality) gets protected, uninterrupted time.

## Judging alignment (why each goal earns a criterion)

- **Writing Quality (weighted most):** the honest retrieval-quality table
  + a specific personal story + the real number. D5 is writing-only.
- **Relevance to theme:** "rewards laziness" is the core loop — dump with
  zero effort, recall by asking. Show the effort saved (a number).
- **Creativity:** the minimal + terminal aesthetic + the "don't organize,
  just ask" inversion of the notes-app genre.
- **Technical Execution:** on-device embeddings, offline PWA, real
  cosine search, measured recall — not a toy.
- **Open innovation:** the model is a file you run, not a service you
  rent; private data never leaves the device; works with no signal.

## Prize categories to declare

- **Best Use of Gemma** — EmbeddingGemma is the entire retrieval engine;
  every ranked result exists because the model embedded it on-device.
- **Best Use of Render** — static site, auto-deploys on push to `main`.
- (Optional) **.tech domain** — cheap category add if a domain is wired.

## Decisions log

- 2026-10-20: Idea chosen (cubby / dump-and-ask local memory) over the
  subscription-finder (one-and-done, low retention) and the kinetic
  receipt (wrong for a daily-use tool). Daily-use recall is the reason to
  return; semantic retrieval plays to the small model's strength, the
  opposite risk profile of HushQuote's generation gamble.
- 2026-10-20: Aesthetic = minimal + terminal/mono soul, 5 themes ×
  light/dark. Calm enough for a 20×/day tool; distinctive via craft, not
  a gimmick skin; the terminal layer argues "local and private" on sight.
- 2026-10-20: Model = EmbeddingGemma in-browser via transformers.js
  (retrieval), **not** a GGUF generation model via wllama. Different job,
  different library.
- Commit style: clean conventional commits, GPG-signed, `-s` sign-off
  where a repo needs it. **No AI-attribution trailers** (per the
  ibrahim-iqbal identity rule).
- 2026-10-20: Name locked to **cubby** after a collision check (closest hit:
  CubbyFlow ★305, low enough to proceed). Scope enhanced with **A**
  (Share-to-cubby, PWA Web Share Target) and **B** (hybrid semantic+lexical
  ranking) — both promoted from "later lever" / RISKS mitigation to core
  goals, folded into D3/D4.
