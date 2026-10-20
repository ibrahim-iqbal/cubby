# cubby — ARCHITECTURE

## 1. Shape of the thing

A single-page static app. No backend, ever. Everything runs in the tab:
the model, the vectors, the search, the storage.

```
┌───────────────────────────────────────────────┐
│  browser tab (static site served by Render)    │
│                                                 │
│  React 19 UI  ──dump──▶  embed(query/item)      │
│      ▲                        │ transformers.js │
│      │                        ▼ EmbeddingGemma  │
│   results  ◀──cosine──  vectors in IndexedDB    │
│                                                 │
│  settings → localStorage   shell+model → SW cache
└───────────────────────────────────────────────┘
          no network after first load
```

## 2. Stack

- **UI:** React 19 + Vite, TypeScript. Static build, no SSR.
- **Model runtime:** `@huggingface/transformers` (transformers.js v3+),
  `feature-extraction` pipeline, WebGPU device with WASM fallback.
- **Model:** EmbeddingGemma (300M), pinned to
  `onnx-community/embeddinggemma-300m-ONNX` (**verified D2 live in the
  browser**, see RISKS R1 — the `-ONNX` suffix matters, the bare name
  doesn't exist). `dtype: 'q8'`.
- **Storage:** IndexedDB (`idb` thin wrapper or hand-rolled) for items +
  vectors; localStorage for settings.
- **Search:** cosine similarity in plain JS/TypedArrays.
- **Offline:** a service worker precaches the app shell and the model
  shards; `vite-plugin-pwa` or a hand-written SW.
- **Capture:** `manifest.webmanifest` `share_target` + a `/share` route
  for the OS Share sheet (Android-solid, iOS-weak — see §4.3).
- **Deploy:** Render static site, build `npm ci && npm run build`,
  publish `dist`, auto-deploy on push to `main`.

## 3. The embedding model

- **Why embeddings, not generation:** the product is retrieval. Small
  open models are strong at producing a sentence embedding and weak at
  writing prose. EmbeddingGemma is purpose-built for this and is small
  enough to ship to the tab. This inverts HushQuote's risk: there, the
  model's generation weakness was the whole fight; here, the model only
  does the thing it's good at.
- **Dimensions / Matryoshka:** EmbeddingGemma supports Matryoshka
  representation — the full 768-dim vector can be truncated to 512 / 256 /
  128 with graceful quality loss. v1 stores **256-dim** (truncate +
  renormalize), the D2 starting point; the exact dim can still be
  re-measured against the D4 test set vs storage/speed.
- **Prompt/instruction format:** pinned from the model card —
  document prefix `title: none | text: `, query prefix
  `task: search result | query: `. Items are embedded with the document
  prefix at dump time; the search box with the query prefix. Confirmed
  live D2: a paraphrase query sharing zero words with a dumped item still
  ranked it top.
- **Normalization:** store L2-normalized vectors so cosine reduces to a
  dot product.

## 4. Pipelines

### 4.1 Dump → store
1. User submits text. Detect coarse `type` by regex (url / shell-ish /
   address-ish / else note) for the glyph only.
2. Create the `CubbyItem`, write it to IndexedDB immediately (never block
   on the model).
3. Queue an embed: `embed(DOCUMENT_PREFIX + text)` → L2-normalize →
   truncate to `dim` → write `vector` back onto the item.
4. The item is searchable the moment its vector lands; until then it's
   stored and excluded from semantic ranking (still visible in recent).

### 4.2 Ask → rank (hybrid)
1. Debounce the query (~120ms).
2. `embed(QUERY_PREFIX + query)` → normalize → truncate to `dim`.
3. Per item: `semantic` = cosine (dot product) vs the item vector;
   `lexical` = normalized overlap of query tokens found in item text
   (plain string split + set intersection, no model call).
4. `score = 0.7 * semantic + 0.3 * lexical` (weights tuned against the D4
   test set, not guessed; record the chosen weights here once set).
5. Sort by `score` desc, apply the min-score floor, cap at 8.
6. Render with the same lexical overlap driving the highlight — rank and
   highlight now share one lexical signal instead of disagreeing.

### 4.3 Share-to-cubby → store
1. OS Share sheet → `/share?title=&text=&url=` (GET, per the Web Share
   Target spec declared in `manifest.webmanifest`).
2. The `/share` route concatenates the shared fields into `text`, runs
   the same regex type-detection and IndexedDB write as a manual dump
   (step 4.1.2), then redirects to `/` with the new item visible in
   recent — no extra screen, no manual paste.
3. Embedding queues exactly as in 4.1.3; the share path never blocks on
   the model.
4. Platforms without Web Share Target support never register the share
   target — the OS simply won't offer cubby in the Share sheet; no
   broken state, just absence (document this, don't hide it).

### 4.4 First load
1. Shell renders instantly; manual (keyword) search works at once.
2. Model shards download with progress UI (cover state).
3. On ready, warm the pipeline with one throwaway embed, then flip
   semantic search on.

## 5. Storage model

- **IndexedDB `items`**: keyed by `id`. Vectors stored as `ArrayBuffer`
  (Float32). On app start, load all items into memory once (a few
  thousand small vectors is trivial), search in RAM, persist writes.
- **localStorage `cubby.settings.v1`**: `{theme, mode}`. Read in a tiny
  inline `<head>` script before first paint to set `data-theme` /
  `data-mode` and avoid a flash.
- **Versioned keys** (`.v1`) so a schema change can migrate, not corrupt.

## 6. Failure / fallback ladder

1. **No WebGPU** → transformers.js WASM backend (slower first embed, fine
   for query-time single embeds).
2. **Model fails to load / unsupported** → the app stays fully usable in
   **manual mode**: keyword search over the raw text (the D1 scorer is
   the permanent floor, not throwaway). An honest banner explains
   semantic search is off.
3. **IndexedDB blocked** (private window, quota) → in-memory session only,
   with a clear "not saved across reloads" notice; never silently lose
   data pretending it saved.
4. **Huge cubby** (tens of thousands) → brute-force cosine starts to cost;
   LATER lever: an approximate index (HNSW in wasm) or dim reduction.
   v1 documents the ceiling rather than pre-optimizing.

## 7. Performance budget (verify D2, real device)

- First load: model download is the cost (hundreds of MB class); shell +
  manual mode usable in <1s regardless.
- Query embed (warm): target sub-100ms WebGPU, sub-400ms WASM.
- Search over ~2–5k items: cosine in RAM, target <20ms.
- Numbers get measured on a real device D2 and tabled in the post.

## 8. What stays out of the architecture (and why)

- **No vector DB service, no server search** — defeats the privacy pitch
  and the offline guarantee.
- **No generation model loaded** — not needed; doubles download for a
  feature we deliberately don't ship.
- **No telemetry/analytics** — "nothing uploaded" must be literally true
  and checkable in the network tab.
