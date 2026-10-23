*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

## What I Built

**cubby** is a memory bank for the things I copy and then lose: a wifi password, a `docker run` one-liner, a flight confirmation number, an address. You do two things with it.

- **Dump.** Paste anything and press enter. No title, no tag, no folder.
- **Ask.** Later, type what you remember, in your own words. They don't have to be the words you saved it with.

An open-weight embedding model, EmbeddingGemma 300M, runs inside the browser tab and ranks what you saved by meaning. There is no server, no account and no API key.

On my 20-item test set, semantic search found the right item **20 out of 20 times**. Plain keyword search found it **14 out of 20**. The six it missed are queries like *"how do I reach the property manager"* against a note that says *"landlord's number: 555-0199, text don't call."*

Who gets to be lazier: anyone who has ever said "I know I saved that somewhere" and then scrolled for ten minutes. The only job left for you is to paste.

![cubby, the UI at a glance](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/01-hero.jpg)

## Demo

**Live:** <https://cubby-6mn8.onrender.com> (first load downloads the model, about 300 MB, once)

![dump, ask, copy, in under 5 seconds](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/02-loop.gif)

A 10-second intro clip is [in the repo](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/blob/main/docs/design/post/00-intro.mp4).

## Code

{% embed https://github.com/ibrahim-iqbal/cubby-hf26-wk3 %}

MIT licensed. React 19 + Vite, a static site with no backend.

## How I Built It

### The model only measures meaning. It never writes a word.

The week before this I shipped [HushQuote](https://dev.to/ibrahimiqbal/hushquote-quotes-that-stay-yours-3ldl), which asked a 270M model to *generate* structured text. The write-up is mostly a list of ways it hallucinated. The lesson: a small open model is reliable at one thing, turning text into an embedding, and unreliable at writing prose. So cubby only asks it for the thing it is good at.

| Job | Who does it | Why |
|---|---|---|
| Items that share your exact words | Plain lexical overlap (prefix / substring / exact) | Must be exact. Keyword hits are the floor the model can't drop below |
| Items that mean the same thing in different words | **EmbeddingGemma 300M, in the browser** | The one thing a small model earns its place for |
| Which wins when they disagree | A fixed `0.7·semantic + 0.3·lexical` blend | A tuned weight, not a per-query judgment |
| Writing anything in your results | Nobody | Small models hallucinate; retrieval doesn't |

![Architecture: everything inside the box runs in your browser tab](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/diagram-architecture.png)

Saving never waits on the model. The item is written first and its vector is filled in behind it:

![Dump flow: the item is saved first, the vector backfills](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/diagram-dump.png)

Asking blends two scores, so an exact keyword is never beaten by a weak semantic guess:

![Ask flow: semantic and lexical scores blended 70/30](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/diagram-ask.png)

### The test set, in full

20 fixed (dump, query) pairs. Each query is ranked against the **whole** 20-item corpus, so a hit means the right item rose above 19 distractors. Method and every row: [`test/queries.md`](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/blob/main/test/queries.md).

| Scorer | Recall@3 |
|---|---|
| semantic only (EmbeddingGemma cosine) | **20/20** |
| hybrid (shipped: `0.7·semantic + 0.3·lexical`) | **20/20** |
| lexical only (plain keyword search) | 14/20 |

Twenty items is small, and I wrote the paraphrases myself. This is a measured result on the exact case the product exists for, not a claim about harder queries at scale. I'm committing to the same fixed set for future runs rather than moving the goalposts.

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

- **A 300 MB first load.** A service worker (via `vite-plugin-pwa`) caches the weights, so later visits are instant and work offline. On a slow connection the first load is a real wait, so the UI shows a live log of every shard as it lands instead of a fake progress bar.
- **Matryoshka truncation to 256 dimensions.** EmbeddingGemma emits 768-dim vectors. I keep the first 256 and renormalize, which the model is trained to allow. Each item's vector is a third the size, and recall on the test set did not change.
- **Task prefixes.** The model is trained with task prefixes, so cubby always adds `task: search result | query: ` to an ask and `title: none | text: ` to a dump.
- **Lexical matching had to work on characters, not whole words.** The first version needed a full-word match, so typing "doc" found nothing until you finished "docker". It now scores exact (1.0), prefix (0.9) and substring (0.6) per query token.
- **Fallback.** If the model fails to load, cubby drops to keyword-only search and says so in the footer and the model card. You lose paraphrase matching, not the app.

### Checking the privacy claim yourself

"Nothing uploaded" is easy to say. Here is what I actually measured on the live site, and how you can repeat it.

1. Open the [live app](https://cubby-6mn8.onrender.com) with DevTools open on the Network tab.
2. On the very first visit you'll see the ~300 MB model download from `huggingface.co`. On later visits the weights come from the cache, but a small `generation_config.json` request to `huggingface.co` can still appear **at page load**. Hugging Face can see your IP address and browser when that happens, the same as for any web request.
3. Once the page has loaded, clear the log. Dump a note, ask a question, switch the theme. In my run, that produced **zero** new requests.

I did not test the export button. It makes a local file and has no reason to touch the network, but I haven't confirmed it.

![Illustration of the Network panel: one model fetch at load, nothing after. Drawn by me, not a screenshot, so repeat the steps above in your own DevTools](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/05-network-proof.jpg)

## Why Does Open Innovation Matter?

Four things in cubby only work because the weights are open:

- **The model is a file, not a service.** The app ships it as a static asset. There is no API key, no per-call bill, no vendor who can change the pricing, and no outage that isn't mine. A hosted embedding API would have required sending every note you save to someone's server, which is the problem I set out to avoid.
- **I could see what was inside it.** Matryoshka truncation and the task prefixes are documented behaviour of the open model, and I could test both myself. Truncating a closed model's embeddings to save space is not something I could have checked.
- **Privacy you can inspect.** Because inference happens in your tab, the claim "your notes stay here" is something you can verify in DevTools, as above, instead of something you take on trust.
- **It works with no signal.** The app shell and the weights are both cached. Closed APIs stop working on a plane or in a basement. This doesn't.

## The Lazy Payoff

- **Saving costs nothing to think about.** One paste and one keypress. There are no fields: no title, no tag, no folder. Every notes app I've left asked me to organize first, and that is the work I always skipped.
- **Finding costs one sentence.** On my test set, keyword search sent me hunting in 6 queries out of 20. EmbeddingGemma sent me hunting in none (right item in the top 3).
- **It's fast once warm.** In one run on the live site (headless browser, model already cached, one saved item), the right result was on screen about 170 ms after I entered the query. That is a single measurement, not a benchmark, and it will grow with a bigger collection.
- **The slow part happens once.** The 300 MB download is the sloth's one big effort. After that, embedding happens quietly in the background while you carry on.

I'm not going to claim hours saved. I haven't measured that, and a number I made up would not belong in a post about checking claims.

## What's honestly still missing

- Text only. No images and no OCR.
- No sync between devices. Export and import of JSON is the only way to move data, on purpose, because there is no server to sync through.
- Hybrid ranking narrows the cases where semantic and lexical scores disagree, but it doesn't remove them.
- The test set is 20 items. It is the fixed set I'll keep re-running, not proof of anything at scale.
- **Android Share-to-cubby** is implemented through the PWA share target in the web manifest, but I have not tested it on a physical phone. iOS Safari's support for share targets is weak, so on iPhone you paste manually.

![Illustration of the Android share sheet. Not captured on a device: I haven't tested this on a phone yet](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/04-share-sheet.jpg)

## Prize Categories

- **Best Use of Gemma.** EmbeddingGemma 300M is the whole retrieval engine. Every ranked result exists because that model embedded the note on-device, with task-prefixed inputs and 256-dim Matryoshka truncation. It never generates text.
- **Best Use of Render.** A static site with no backend, deployed from the repo's `render.yaml` blueprint and redeployed on every push.

## Try it

- Live: <https://cubby-6mn8.onrender.com>
- Repo: <https://github.com/ibrahim-iqbal/cubby-hf26-wk3>
- Five themes (terminal, paper, mono, cobalt, ember), each in light and dark, checked for WCAG AA contrast with `test/contrast.mjs`:

![The five themes in light and dark](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/03-themes.jpg)
