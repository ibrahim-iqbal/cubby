# cubby — SPEC

Features, flows, data shapes, acceptance criteria. Every feature here is
in scope for v1 unless marked LATER.

## 1. The two modes

The app has exactly one screen with two modes, toggled by a segmented
control and by keyboard. The command bar is always present.

### 1.1 Ask (default)
- Typing in the bar runs a live semantic search over the cubby.
- Results are ranked by cosine similarity, best first, capped at 8.
- Each result shows: a type glyph, the content (with the matched span
  highlighted), its source/age line, and a match %.
- Empty query shows the most recent items ("recent").
- A result with low top-similarity shows an honest empty-ish state
  ("nothing close in your cubby — try other words").

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

### 1.3 Share-to-cubby (mobile, PWA)
- `manifest.webmanifest` declares `share_target` (method GET, pointing at
  `/share`). The OS Share sheet (any app → Share → cubby) lands shared
  text/links on `/share`, which writes the item straight to the store —
  same path as a manual dump, zero extra UI — then redirects to Ask with
  the new item visible in "recent".
- Falls back silently to normal Dump on platforms without Web Share
  Target support (notably iOS Safari — call this out honestly in the
  post rather than claim universal support).

**Acceptance:** sharing a page from another app on an installed Android
PWA produces a new item without the app ever being opened manually.

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

- **Create** (dump, or Share-to-cubby on mobile).
- **Read** (appears in ask results / recent).
- **Copy / open** (Enter on a result).
- **Delete** (a per-row action, keyboard-reachable; confirmation only if
  the row isn't trivially re-addable — default no modal, with an undo
  toast).
- **No edit** in v1 (dumps are immutable; re-dump if wrong). LATER: edit.

## 4. Settings

- **Theme** — 5 named themes (see UI.md). Persisted.
- **Mode** — light / dark / system. Persisted. Default: system.
- **Export** — download the whole cubby as JSON (items + metadata; vectors
  optional, re-embeddable on import).
- **Import** — load a cubby JSON (merge or replace, user chooses).
- **Clear all** — wipe the cubby (explicit confirm; irreversible, say so).
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
type CubbyItem = {
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
type Hit = {
  item: CubbyItem;
  score: number;      // final blended score [0..1], used for ranking
  semantic: number;   // cosine similarity component
  lexical: number;    // token-overlap component
};
```

- **Items + vectors** live in IndexedDB (one store `items`, vectors as
  `Float32Array` / `ArrayBuffer`). **Settings** live in localStorage
  (tiny, synchronous, read before paint to avoid theme flash).
- Export JSON omits vectors by default (portable + small); import
  re-embeds missing vectors.

## 8. Search semantics (hybrid ranking)

- Only the **query** is embedded at search time (one model call, debounced
  ~120ms). Item vectors are precomputed at dump time.
- Two scores per item, blended into one rank:
  - **semantic** = cosine similarity of query vector vs item vector.
  - **lexical** = normalized token overlap (query words found in item
    text), cheap string work, no model call.
  - **score** = `0.7 * semantic + 0.3 * lexical` (weights are a tuning
    knob, not a contract — tune once against the D4 test set, record the
    final weights there rather than guessing in advance).
- Purpose: an exact keyword match never loses to a weak semantic guess —
  the lexical term acts as a floor, the semantic term supplies recall
  beyond exact words.
- Rank = blended score, brute force over all items (fine to low
  thousands; see RISKS for scaling).
- A minimum-score floor hides irrelevant results rather than always
  showing 8.
- Highlight uses the same lexical token-overlap, for the eye only —
  ranking already accounts for it, so highlight and rank no longer
  diverge the way a pure-cosine rank would.

## 9. Acceptance test set (D4)

A fixed file `test/queries.md`: ~20 (dump, query, expected-hit) triples
spanning links, commands, addresses, notes, and *paraphrased* queries
(where the query shares no words with the dump). Recall@3 is measured and
reported in the post, with every miss named — the honesty table. Run the
set twice: semantic-only and hybrid, so the blend's lift is a real
measured delta, not a claim.

## 10. Honest limits (state in the post)

- Hybrid ranking narrows but doesn't erase semantic/lexical disagreement
  on edge cases — shown as a known behavior, not hidden.
- 300M embedding quality has a ceiling; paraphrase recall is measured, not
  assumed. Misses go in the table.
- Share-to-cubby depends on OS/browser Web Share Target support
  (solid on Android, weak/absent on iOS Safari) — call this out rather
  than imply it works everywhere.
- v1 is single-device, text-only, no background capture — by design.
