# cubby — UI

The aesthetic: **minimal, command-palette-first, with a terminal/mono
soul.** It must be calm enough to open 20× a day and distinctive through
craft, not a gimmick skin. The terminal layer (monospace query, prompt
glyph, blinking caret, a `local · offline` line) argues "runs on my
machine, nothing uploaded" on sight.

## Principles

1. **The ask is the product.** The command bar is the center of gravity,
   always present, always one keystroke away (`Cmd/Ctrl+K`).
2. **Dump is frictionless.** One box, Enter, done. No tags, no folders,
   no title field — ever. Asking for structure would break the thesis.
3. **Quiet by default.** Lots of whitespace, hairline borders, two type
   sizes, two weights (400/500). Restraint over options. "Too cluttered"
   is the failure mode.
4. **Motion is feedback, never decoration.** Every animation ties to a
   real state change and respects `prefers-reduced-motion`.
5. **The aesthetic carries the pitch.** Monospace + prompt + the local
   indicator = the privacy story, told visually.

## Layout (single screen)

```
  cubby.                         ● local · offline · nothing uploaded
  ┌───────────────────────────────────────────────────────────┐
  ❯ ask your cubby…                                   ↑↓  ↩ copy │
  └───────────────────────────────────────────────────────────┘
   [ ask ]  dump

   recent · paste to add, type to ask
   ───────────────────────────────────────────────────────────
   note   Airbnb Lisbon — free cancellation until Jan 3…    92%
          pasted · 4d ago
   cmd    docker run --rm -it -v $(pwd):/app …              88%
          snippet · 2d ago
   …

                       EmbeddingGemma · on-device      341 items
```

- Max content width ~620px, centered, generous vertical padding.
- Header: wordmark + the live `local` indicator.
- The bar: monospace input, a `❯` prompt glyph in the accent, a keyboard
  hint on the right.
- Segmented `ask / dump` control below the bar.
- A meta line (count · state) above the list.
- Results: dense rows (not cards), hairline dividers, a type glyph in
  mono, the content, a source/age line, a match %.
- Footer: model + item count, in mono.

## Type

- **Chrome / labels:** system sans (`-apple-system, Segoe UI, Inter`).
- **Query, results, glyphs, meta, footer:** monospace (`SF Mono, JetBrains
  Mono, Menlo, Consolas`). The mono is the terminal soul — use it for
  everything that reads as "the machine," sans only for soft labels.
- Two sizes in the content: 14–15px body, 11px meta. Two weights only.
- Sentence case everywhere. No ALL CAPS except the tiny mono meta labels
  where it reads as a terminal header, used sparingly.

## Motion (all ≤ 200ms, reduced-motion safe)

- Result rows: a quick fade/slide-in on first appearance, small per-row
  stagger. Not on every re-rank — only on mount.
- The caret blinks (the one ambient animation); off under reduced-motion.
- Copy confirmation: the source line swaps to "✓ copied" for ~1.4s.
- Theme switch: an instant swap (no cross-fade — themes are a setting,
  not a transition). Optional ~120ms color-token transition, off under
  reduced-motion.
- No decorative glow, gradient, mesh, or shadow-as-ornament.

## Theme architecture

- All color is CSS custom properties on `:root`.
- **Theme** is `:root[data-theme="<name>"]`; **mode** is
  `:root[data-mode="light"|"dark"]`. Each theme defines both modes.
- Default mode = system (`prefers-color-scheme`), overridable to
  light/dark. Default theme = `terminal`.
- Both persist in `localStorage` (`cubby.settings.v1`), read by a tiny
  inline `<head>` script before first paint to set `data-theme` /
  `data-mode` — no flash of the wrong theme.
- A theme picker in settings shows a live swatch per theme.
- **All 5 themes must pass WCAG AA** for `--fg` on `--bg` and `--accent`
  on `--bg` in both modes — adjust stops that fail rather than shipping a
  pretty-but-illegible theme.
  **VERIFIED D4** (`test/contrast.mjs`): all 10 combinations pass — fg
  ranges 13.4:1–16.6:1 (threshold 4.5:1), accent ranges 3.7:1–12.1:1
  (threshold 3:1, accent is never body text). No stops needed adjusting.

### Token set (9 per theme × mode)

`--bg` page · `--panel` raised input/row · `--line` hairline · `--line2`
stronger border · `--fg` primary text · `--dim` secondary · `--dimmer`
muted/meta · `--accent` the one accent · `--accent-dim` accent wash /
highlight background.

### The 5 themes

Values are a starting point (AA-verify D4). Each is one restrained accent
over a neutral ground — never a rainbow.

**1. terminal** — ink ground, green-phosphor accent (the default, the one
in the mock). Techy, calm, "it's running locally."

| token | dark | light |
|---|---|---|
| bg | #0e0f11 | #f6f7f5 |
| panel | #141619 | #ffffff |
| line | #232629 | #e6e7e3 |
| line2 | #2d3136 | #d9dad5 |
| fg | #e8e9ea | #17181a |
| dim | #8a8f96 | #5f656b |
| dimmer | #5c6269 | #8f949c |
| accent | #7ee0b8 | #12916a |
| accent-dim | #223029 | #dcefe6 |

**2. paper** — warm cream and ink, sepia/amber accent. Editorial, cozy,
the "notebook you dump into."

| token | dark | light |
|---|---|---|
| bg | #17150f | #f4efe3 |
| panel | #1e1b13 | #fbf7ec |
| line | #2c281d | #e6ddc9 |
| line2 | #38331f | #d8cdb3 |
| fg | #ece6d8 | #2a2419 |
| dim | #9b937f | #6e6450 |
| dimmer | #6b6454 | #9a8f77 |
| accent | #e0b06a | #9a6a15 |
| accent-dim | #302612 | #efe4cf |

**3. mono** — pure grayscale, no chroma. Ultra-minimal; the accent is a
steel/near-white so "one accent" still reads without color.

| token | dark | light |
|---|---|---|
| bg | #101012 | #f5f5f5 |
| panel | #17181a | #ffffff |
| line | #262729 | #e5e5e5 |
| line2 | #323335 | #d6d6d6 |
| fg | #ededed | #161616 |
| dim | #8c8d8f | #5f6061 |
| dimmer | #5d5e60 | #949496 |
| accent | #c9cacc | #3a3b3d |
| accent-dim | #2a2b2d | #e3e3e4 |

**4. cobalt** — cool slate, blue accent. Crisp, focused, "developer tool."

| token | dark | light |
|---|---|---|
| bg | #0d1017 | #f3f5fa |
| panel | #141824 | #ffffff |
| line | #212636 | #e2e6f0 |
| line2 | #2c3244 | #d2d8e6 |
| fg | #e6e9f0 | #151826 |
| dim | #878ea0 | #5c6478 |
| dimmer | #58607a | #929ab2 |
| accent | #5b9dff | #2f6fe0 |
| accent-dim | #182238 | #dde7fb |

**5. ember** — warm dark ground, dusty-rose/coral accent. Soft, human,
the cozy end of the range.

| token | dark | light |
|---|---|---|
| bg | #16100f | #f6efec |
| panel | #1f1716 | #fffaf8 |
| line | #2e2321 | #ecdcd6 |
| line2 | #3a2c29 | #dfc9c1 |
| fg | #efe3df | #2a1e1b |
| dim | #a2918c | #74605a |
| dimmer | #6e5d58 | #a08a83 |
| accent | #e88f7a | #c25a3f |
| accent-dim | #30201c | #f6e0d8 |

## Empty & edge states (write real copy, not apologies)

- **No cubby yet** (either mode, empty cubby): a dedicated onboarding
  block — "your cubby is empty — dump anything, no tags or folders," plus
  4 example-dump chips (one per type: note, link, cmd, addr) that prefill
  the dump box on click so a first-time user sees the loop immediately
  rather than reading about it.
- **No match** (Ask, query, nothing close): "nothing close in your cubby —
  try other words. it matches meaning, not exact text."
- **Dump mode idle, non-empty cubby:** the dump box placeholder still
  reads "paste a link, note, address, snippet — anything. press ↩ and
  forget it. no tags, no folders" — but below it the cubby's own recent
  items now stay visible (read-only, no match %, no selection highlight)
  so dump mode never goes to a blank screen once something's been saved.
- **Model loading:** the cover state — "setting up on-device search… this
  downloads once and stays on your device," with a real progress bar tied
  to live download percent, shown non-blocking above the bar (shell and
  manual search stay usable per SPEC §5).
- **Semantic off (fallback):** a quiet banner — "on-device search
  unavailable here; searching by keyword. your data still never leaves
  the device."
- **Meta-line, non-empty cubby:** always shows a type breakdown ("4 notes
  · 2 links · 1 cmd · 1 addr") alongside the mode hint, so the screen
  communicates real cubby state at a glance instead of just an item count
  buried in the footer.

## Accessibility

- Every icon-only control has an `aria-label`; the type glyphs are
  decorative (`aria-hidden`).
- Both command bar inputs have an explicit `aria-label` (ask / dump) —
  `placeholder` alone is never the accessible name.
- The `local · offline · nothing uploaded` status line is real product
  information, not decoration — it is not `aria-hidden`.
- Full keyboard operation (the keyboard contract in SPEC §2).
- Visible focus ring on the bar and the selected row; never suppressed.
- Respect `prefers-reduced-motion` on every animation.
- All interactive controls meet the WCAG 2.2 AA 24×24px touch-target
  minimum (verified live: delete 26×26, settings 75×28, tabs 44×28).
- The results list and ask/dump toggle use plain semantics (`<ul>`/`<li>`,
  `aria-pressed` buttons) rather than `listbox`/`tablist` roles — those
  ARIA patterns require wiring (`aria-activedescendant`, roving tabindex,
  linked tabpanels) this app doesn't implement; a half-applied pattern is
  worse than a plain one.
- Model-load progress is in an `aria-live="polite"` region so screen
  reader users hear it without re-polling.
- AA contrast on all 5 themes, both modes (D4 gate).
