# pile — RISKS

Each risk: a mitigation ladder (cheapest first), the day it's verified,
and the kill-switch if mitigation fails. No risk rides unexamined to D5.

## R1 — EmbeddingGemma ONNX in-browser may not be drop-in
The whole app assumes EmbeddingGemma runs in transformers.js. Need to
confirm: a working ONNX build on the HF hub, the correct model id, that
transformers.js's `feature-extraction` loads it, and the exact
query/document instruction prefixes.
Mitigation ladder:
1. **Verify the model first thing D1** — find the ONNX build
   (`onnx-community/embeddinggemma-300m` or equivalent), load it in a
   throwaway page, embed two strings, check cosine behaves. Pin the id +
   prefixes in ARCHITECTURE §3 before building UI around it.
2. **Fallback model** — if EmbeddingGemma won't load in-browser, use a
   proven transformers.js embedding model (e.g. a small `gte` / `e5` /
   `all-MiniLM` ONNX) and still declare Best Use of Gemma only if Gemma
   genuinely runs; otherwise drop that category claim honestly rather
   than fake it.
3. **Prefixes matter** — wrong query/document prefixes quietly tank
   recall. Measure with/without on the test set D2.
Verify: **D1 (load) + D2 (recall).** Kill-switch: swap to the fallback
embedding model; the app is identical, only the category claim changes.

## R2 — Model download size vs the "lazy / no-install" pitch
A 300M embedding model is a real download (hundreds of MB class). Nobody
lazy waits for a huge download.
Mitigation ladder:
1. **Quantize** — q8, drop to q4 if needed; measure recall delta on the
   test set, don't guess (q4 on a 300M model may cost more than on a 4B).
2. **Matryoshka dim** — store 256-dim vectors, smaller + faster cosine;
   measure recall vs 768.
3. **Lazy the model, not the app** — shell + manual keyword search usable
   in <1s; the model downloads in the background with honest progress and
   only unlocks semantic ranking when ready. The app is useful before the
   download finishes.
4. **Cache once** — service worker + browser cache so it's a one-time
   cost; the post leads with a GIF so judges see the payoff without
   waiting.
Verify: **D2** (size/speed on a real device, tabled). Kill-switch: R1
fallback to a smaller embedding model; worst case manual mode carries the
demo.

## R3 — Retrieval quality too weak (paraphrase misses)
A small embedding model may fail when the query shares no words with the
dump — the exact case that justifies semantic over keyword.
Mitigation ladder:
1. **Right prefixes + normalization** (R1.3) — the cheapest real lever.
2. **Dim/quant tuning** against the test set (R2.1–2).
3. **Hybrid rank** — blend semantic cosine with a cheap lexical (BM25-ish
   / token overlap) score so exact-word matches never rank below a weak
   semantic guess. Lexical is free and only helps.
4. **Honest measurement** — the D4 test set (`test/queries.md`, ~20
   paraphrase-heavy triples) gives Recall@3; every miss is named in the
   post. This is the HushQuote honesty table, and it's a *writing asset*,
   not a failure to hide.
Verify: **D4 sweep.** Kill-switch: lead the product on exact+semantic
hybrid (still better than plain search) and report the paraphrase ceiling
honestly; manual mode is the floor.

## R4 — IndexedDB / storage edge cases
Private windows, cleared storage, quota limits can make "saved" a lie.
Mitigation ladder:
1. **Wrap every read/write in try/catch**; never assume it persisted.
2. **Detect unavailable storage** → run in-memory for the session with a
   clear "not saved across reloads" notice. Never pretend a save
   succeeded (the HushQuote silent-data-loss lesson).
3. **Export/import JSON** so the user's pile is portable and backup-able
   regardless of browser state.
Verify: **D3** (private window + quota test). Kill-switch: in-memory mode
with the honest banner.

## R5 — Scaling: brute-force cosine on a big pile
Cosine over every vector per query is fine to low thousands; tens of
thousands starts to cost.
Mitigation ladder:
1. v1 targets realistic personal scale (hundreds–low thousands of dumps);
   brute force in RAM is sub-20ms there. Measure D2.
2. **Matryoshka dim** already cuts per-vector cost.
3. LATER: an approximate index (HNSW-in-wasm) or coarse pre-filter.
   Documented as the next lever, not pre-built.
Verify: **D2** (time at 5k synthetic items). Kill-switch: cap in-memory
search set + a "searching recent N" note; not expected to trigger at v1
scale.

## R6 — Schedule (solo, ~5 days)
Mitigation ladder:
1. **Manual mode D1** — a working keyword version is submittable even if
   the model integration craters entirely. The floor is a shippable
   product.
2. **Deploy D1** — Render live on day one; every day ends on a URL. No
   deploy-day surprise.
3. **Timebox model tasks** — any D2 model task overrunning gets parked
   behind manual mode, not extended.
4. **D5 is writing-only.** Code freeze D4 night.
Verify: continuous. Kill-switch: ship manual mode + the honest writeup if
the model path fails; the aesthetic + the "don't organize, just ask"
concept still stand.

## R7 — "Why open" must be literally true
The pitch is "nothing uploaded." It has to be checkable.
Mitigation ladder:
1. **No telemetry, no analytics, no fonts/CDN calls at runtime** after the
   model loads — audit the network tab; the only requests are the
   one-time model fetch (or none, offline).
2. **Say it where it's verifiable** — the post shows an empty network tab
   during a search; the UI's `local · offline` line isn't just copy.
Verify: **D4** (network-tab audit in the post). Kill-switch: none needed;
this is a build discipline, not a risk to trade off.

## Standing instruction
Any session that finds a new risk adds it here with a ladder + verify-day
+ kill-switch, and notes it in PLAN.md's decisions log.
