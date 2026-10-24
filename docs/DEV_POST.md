*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

## What I Built

I copy things all day and lose most of them: a wifi password, a `docker run` one-liner, a flight confirmation number, an address. Every notes app has the same answer, *organize it first*: a title, a tag, a folder. That is the step I always skip.

**cubby** skips it. You do two things:

- **Dump.** Paste anything and press enter. No title, no tag, no folder.
- **Ask.** Later, type what you remember, in your own words. They don't have to be the words you saved it with.

An open-weight embedding model, EmbeddingGemma 300M, runs inside the browser tab and ranks what you saved by meaning. There is no server, no account and no API key.

On my 20-item test set, semantic search found the right item **20 out of 20 times**. Plain keyword search found it **14 out of 20**. The six it missed are queries like *"how do I reach the property manager"* against a note that says *"landlord's number: 555-0199, text don't call."*

Who gets to be lazier: anyone who has said "I know I saved that somewhere" and then gone looking. The only job left is to paste.

![cubby, the UI at a glance](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/01-hero.jpg)

## Demo

**Live:** <https://cubby-6mn8.onrender.com> (first load downloads the model, about 300 MB, once)

![dump, ask, copy, in under 5 seconds](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/02-loop.gif)

A 10-second intro clip is [in the repo](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/blob/main/docs/design/post/00-intro.mp4).

## Code

**Repo:** <https://github.com/ibrahim-iqbal/cubby-hf26-wk3>

MIT licensed. React 19 + Vite, a static site with no backend.

## How I Built It

### The model only measures meaning. It never writes a word.
Last week's [HushQuote](https://dev.to/ibrahimiqbal/hushquote-quotes-that-stay-yours-3ldl) asked a 270M model to *generate* text, and the write-up is mostly a list of ways it hallucinated. So cubby only asks a small open model for the thing it is reliable at: turning text into an embedding.

| Job | Who does it | Why |
|---|---|---|
| Items that share your exact words | Lexical overlap (prefix / substring / exact) | Keyword hits are the floor the model can't drop below |
| Items that mean the same thing in different words | **EmbeddingGemma 300M, in the browser** | The one thing a small model earns its place for |
| Which wins when they disagree | A fixed `0.7·semantic + 0.3·lexical` blend | A tuned weight, not a per-query judgment |
| Writing anything in your results | Nobody | Small models hallucinate; retrieval doesn't |

![Architecture: everything inside the box runs in your browser tab](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/diagram-architecture.png)

Saving never waits on the model: the item is written first and its vector is filled in behind it. Asking blends two scores, so an exact keyword is never beaten by a weak semantic guess:

![Ask flow: semantic and lexical scores blended 70/30](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/diagram-ask.png)

### The test set, in full

20 fixed (dump, query) pairs. Each query is ranked against the **whole** 20-item corpus, so a hit means the right item rose above 19 distractors. Method and every row: [`test/queries.md`](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/blob/main/test/queries.md).

| Scorer | Recall@3 |
|---|---|
| semantic only (EmbeddingGemma cosine) | **20/20** |
| hybrid (shipped: `0.7·semantic + 0.3·lexical`) | **20/20** |
| lexical only (plain keyword search) | 14/20 |

Twenty items is small, and I wrote the paraphrases myself. This is a measured result on the case the product exists for, not a claim about harder queries at scale. I'll keep re-running the same fixed set rather than moving the goalposts.

The six keyword misses, for the record:

| query | saved note |
|---|---|
| refund deadline for the apartment booking | Airbnb Lisbon — free cancellation until Jan 3 |
| sherlock holmes address | 123 Baker Street, London NW1 6XE |
| what flowers should I get for mother | mom's birthday is March 14, she likes tulips |
| how do I reach the property manager | landlord's number: 555-0199, text don't call |
| generate a self-signed TLS certificate | openssl req -x509 -newkey rsa:4096 ... |
| what time is my teeth cleaning | dentist appointment moved to 2:30pm Thursday |

### The parts that fought back

- **A 300 MB first load.** A service worker caches the weights, so later visits are instant and work offline. The first load is a real wait, so the UI shows a live log of each shard as it lands instead of a fake progress bar.
- **256 dimensions, not 768.** EmbeddingGemma emits 768-dim vectors. I keep the first 256 and renormalize (Matryoshka truncation, which the model is trained to allow). Each vector is a third the size and recall on the test set did not change. The model also wants task prefixes, so cubby adds `task: search result | query: ` to an ask and `title: none | text: ` to a dump.
- **Lexical matching had to work on characters, not whole words.** The first version needed a full-word match, so typing "doc" found nothing until you finished "docker". It now scores exact (1.0), prefix (0.9) and substring (0.6) per query token.
- **Fallback.** If the model fails to load, cubby drops to keyword-only search and says so in the footer. You lose paraphrase matching, not the app.

### Checking the privacy claim yourself
"Nothing uploaded" is easy to say, so here is what I measured on the live site and how to repeat it. Open the [live app](https://cubby-6mn8.onrender.com) with DevTools on the Network tab.

- **At load:** the first visit downloads the ~300 MB model from `huggingface.co`. Later visits use the cache, but a small `generation_config.json` request to `huggingface.co` can still appear, which lets Hugging Face see your IP address and browser like any web request.
- **After load:** clear the log, then dump a note, ask a question and switch the theme. In my run that produced **zero** new requests. I did not test the export button.

![Illustration of the Network panel: one model fetch at load, nothing after. Drawn by me, not a screenshot, so repeat the steps above in your own DevTools](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/05-network-proof.jpg)

## Why Does Open Innovation Matter?
- **The model is a file, not a service.** No API key, no per-call bill, no vendor who can change the pricing. A hosted embedding API would have meant sending every note you save to someone's server, which is the problem I set out to avoid.
- **Privacy you can inspect.** Inference happens in your tab, so "your notes stay here" is something you can check in DevTools, as above, instead of taking on trust.
- **I could test what was inside it.** The truncation and the task prefixes are documented behaviour of the open model, and I checked both against my own test set.
- **It works with no signal.** The app shell and the weights are cached, so it keeps working on a plane.

## The Lazy Payoff
- **Saving costs nothing to think about.** One paste and one keypress, with no title, tag or folder.
- **Finding costs one sentence.** On my test set, keyword search sent me hunting in 6 queries out of 20. EmbeddingGemma sent me hunting in none (right item in the top 3).
- **It's fast once warm.** In one run on the live site (headless browser, model cached, one saved item) the right result was on screen about 170 ms after I entered the query. That is a single measurement, not a benchmark, and it will grow with a bigger collection.
- **The slow part happens once.** The 300 MB download is the one big effort. After that, embedding happens quietly in the background.

I'm not claiming hours saved. I haven't measured that.

## What's honestly still missing
- Text only: no images, no OCR.
- No sync between devices. JSON export and import is the only way to move data, because there is no server to sync through.
- Hybrid ranking narrows the cases where the two scores disagree but doesn't remove them, and the test set is 20 items.
- **Android Share-to-cubby** is implemented through the PWA share target in the web manifest, but I have not tested it on a physical phone. iOS Safari's support is weak, so on iPhone you paste manually.

![Illustration of the Android share sheet. Not captured on a device: I haven't tested this on a phone yet](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/04-share-sheet.jpg)

## Prize Categories

- **Best Use of Gemma.** EmbeddingGemma 300M is the whole retrieval engine. Every ranked result exists because that model embedded the note on-device, with task-prefixed inputs and 256-dim Matryoshka truncation. It never generates text.
- **Best Use of Render.** A static site with no backend, deployed from the repo's `render.yaml` blueprint and redeployed on every push.

## Try it

- Live: <https://cubby-6mn8.onrender.com>
- Repo: <https://github.com/ibrahim-iqbal/cubby-hf26-wk3>
- Five themes, each in light and dark, checked for WCAG AA contrast with `test/contrast.mjs`:

![The five themes in light and dark](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/03-themes.jpg)
