# pile — SPEC

Features, flows, data shapes, acceptance criteria. Every feature here is
in scope for v1 unless marked LATER.

## 1. The two modes

The app has exactly one screen with two modes, toggled by a segmented
control and by keyboard. The command bar is always present.

### 1.1 Ask (default)
- Typing in the bar runs a live semantic search over the pile.
- Results are ranked by cosine similarity, best first, capped at 8.
- Each result shows: a type glyph, the content (with the matched span
  highlighted), its source/age line, and a match %.
- Empty query shows the most recent items ("recent").
- A result with low top-similarity shows an honest empty-ish state
  ("nothing close in your pile — try other words").

**Acceptance:**
- Query "cancellation policy" surfaces a dump that said "free
  cancellation until Jan 3" even though it doesn't contain the word
  "policy" (semantic, not keyword).
- Results update within ~150ms of a keystroke on a warm model (search is
  local vector math, not a model call per keystroke — embeddings are
  precomputed; only the *query* is embedded, debounced).

### 1.2 Dump
- One box. Paste or type anything. `Enter` saves and clears.
- No required tags, no folders, no title.
- On save: detect a coarse type (link / command / address / note) by
  cheap regex for the glyph only — never by model.
- The item is embedded (async, off the main thread where possible) and
  stored. A tiny "saved — forget it" confirmation, then the box is ready
  for the next dump.

**Acceptance:**
- Pasting a URL, pressing Enter, switching to Ask, and querying a word
  from the page title surfaces it.
- Saving never blocks the UI; if embedding is still running, the item is
  stored immediately and its vector backfills.

## 2. Keyboard contract

- `Cmd/Ctrl+K` — focus the command bar from anywhere.
- `↑ / ↓` — move the selection through results.
- `Enter` (Ask) — copy the selected result to clipboard (links also offer
  open); show a ✓ confirmation inline.
- `Enter` (Dump) — save the current box.
- `Esc` — clear the query / blur.
- `Tab` — toggle Ask/Dump (or the segmented control is clickable).

**Acceptance:** the full dump→ask→copy loop is completable without the
mouse.

## 3. Item lifecycle

- **Create** (dump).
- **Read** (appears in ask results / recent).
- **Copy / open** (Enter on a result).
- **Delete** (a per-row action, keyboard-reachable; confirmation only if
  the row isn't trivially re-addable — default no modal, with an undo
  toast).
- **No edit** in v1 (dumps are immutable; re-dump if wrong). LATER: edit.

## 4. Settings

- **Theme** — 5 named themes (see UI.md). Persisted.
- **Mode** — light / dark / system. Persisted. Default: system.
- **Export** — download the whole pile as JSON (items + metadata; vectors
  optional, re-embeddable on import).
- **Import** — load a pile JSON (merge or replace, user chooses).
- **Clear all** — wipe the pile (explicit confirm; irreversible, say so).
- **Model status** — show which model is loaded, download progress on
  first run, and the "on-device / offline" state.

## 5. First run

- On first load, show a calm cover state while the embedding model
  downloads, with real progress (MB / total) — the HushQuote cover
  pattern. The app shell and manual (keyword) search are usable
  immediately; semantic search unlocks when the model is ready.
- Copy explains it's a one-time download that stays on the device.

## 6. Offline

- After first load, the app works with no network: shell + model are
  cached by a service worker; all search is local.
- A small, honest indicator shows offline/online and "nothing uploaded".

## 7. Data shapes

```ts
// A saved item.
type PileItem = {
  id: string;            // nanoid
  text: string;          // the raw dumped content, verbatim
  type: 'note' | 'link' | 'cmd' | 'addr'; // coarse glyph hint, regex-derived
  createdAt: number;     // epoch ms
  vector?: Float32Array; // embedding; absent until backfilled
  dim?: number;          // vector length actually stored (see Matryoshka)
};

// Persisted settings (localStorage).
type Settings = {
  theme: 'terminal' | 'paper' | 'mono' | 'cobalt' | 'ember';
  mode: 'light' | 'dark' | 'system';
};

// A search result (computed, not stored).
type Hit = { item: PileItem; score: number }; // score = cosine [0..1]
```

- **Items + vectors** live in IndexedDB (one store `items`, vectors as
  `Float32Array` / `ArrayBuffer`). **Settings** live in localStorage
  (tiny, synchronous, read before paint to avoid theme flash).
- Export JSON omits vectors by default (portable + small); import
  re-embeds missing vectors.

## 8. Search semantics

- Only the **query** is embedded at search time (one model call, debounced
  ~120ms). Item vectors are precomputed at dump time.
- Rank = cosine similarity of query vector vs each item vector, brute
  force over all items (fine to low thousands; see RISKS for scaling).
- A minimum-score floor hides irrelevant results rather than always
  showing 8.
- Highlight = cheap client-side token overlap between query and the
  matched item, for the eye only — the *ranking* is semantic, the
  *highlight* is lexical. (Documented honestly; they can diverge.)

## 9. Acceptance test set (D4)

A fixed file `test/queries.md`: ~20 (dump, query, expected-hit) triples
spanning links, commands, addresses, notes, and *paraphrased* queries
(where the query shares no words with the dump). Recall@3 is measured and
reported in the post, with every miss named — the honesty table.

## 10. Honest limits (state in the post)

- Highlight is lexical, ranking is semantic — they can disagree; shown as
  a known behavior, not hidden.
- 300M embedding quality has a ceiling; paraphrase recall is measured, not
  assumed. Misses go in the table.
- v1 is single-device, text-only, no background capture — by design.
