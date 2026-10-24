*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

## What I Built

I copy things all day and lose most of them: a wifi password, a `docker run` line, a flight confirmation, an address. Every notes app says the same thing, organize it first. Give it a title, a tag, a folder. That's the step I always skip.

**cubby** skips it. You paste something and press enter. Later you type what you remember, in your own words, and it finds the note. No title, no tag, no folder, no account, no server.

![cubby answering "how do I reach the property manager" with the landlord's number on top](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/01-hero.jpg)

That query found *"landlord's number: 555-0199, text don't call"*. The two share no words. An open-weight model, EmbeddingGemma 300M, runs inside the browser tab and ranks your notes by meaning.

On my 20-item test set it found the right note **20 out of 20** times. Plain keyword search found **14 out of 20**.

## Demo

**Live:** <https://cubby-6mn8.onrender.com> (the first load downloads the model, about 300 MB, once)

![typing a query and the right note rising to the top](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/02-loop.gif)

Everything above is a real capture of the live app with ten sample notes. It also fits a phone screen:

![cubby on a 390px-wide screen](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/06-mobile.jpg)

## Code

**Repo:** <https://github.com/ibrahim-iqbal/cubby-hf26-wk3>

MIT licensed. React 19 + Vite, a static site.

## How I Built It

### The model measures meaning. It never writes a word.
Last week's [HushQuote](https://dev.to/ibrahimiqbal/hushquote-quotes-that-stay-yours-3ldl) asked a 270M model to generate text, and most of that write-up is about how it hallucinated. So this time the model only does the one thing small models are reliable at: turning text into an embedding.

![Architecture: everything inside the box runs in your browser tab](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/diagram-architecture.png)

Saving never waits for the model. The note is stored first and its vector is filled in behind it. Asking blends two scores, so an exact keyword is never beaten by a weak semantic guess:

![Ask flow: semantic and lexical scores blended 70/30](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/diagram-ask.png)

The blend is a fixed `0.7 × semantic + 0.3 × lexical`.

### The test set

20 fixed (note, query) pairs. Each query is ranked against all 20 notes, so a hit means the right one beat 19 others. Every row is in [`test/queries.md`](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/blob/main/test/queries.md).

| Scorer | Right note in top 3 |
|---|---|
| semantic only | **20/20** |
| shipped hybrid | **20/20** |
| plain keyword | 14/20 |

Twenty is small and I wrote the paraphrases myself, so read this as "works on the case the app exists for", not "solves search". These are the six keyword misses:

| query | saved note |
|---|---|
| refund deadline for the apartment booking | Airbnb Lisbon, free cancellation until Jan 3 |
| sherlock holmes address | 123 Baker Street, London NW1 6XE |
| what flowers should I get for mother | mom's birthday is March 14, she likes tulips |
| how do I reach the property manager | landlord's number: 555-0199, text don't call |
| generate a self-signed TLS certificate | openssl req -x509 -newkey rsa:4096 ... |
| what time is my teeth cleaning | dentist appointment moved to 2:30pm Thursday |

### What fought back

- **300 MB on first load.** A service worker caches the weights, so later visits are instant and work offline. The first visit shows a live log of each shard instead of a fake progress bar.
- **256 dimensions, not 768.** I keep the first 256 of EmbeddingGemma's 768 and renormalize (Matryoshka truncation, which the model is trained for). Vectors are a third the size and recall on my set didn't change. The model also wants task prefixes, so a query gets `task: search result | query: ` and a saved note gets `title: none | text: `.
- **Word matching was too strict.** The first version needed a whole word, so "doc" found nothing until I'd typed "docker". It now scores exact, prefix and substring matches per token.
- **If the model fails to load,** cubby falls back to keyword search and says so in the footer.

### Checking the privacy claim yourself

"Nothing uploaded" is easy to claim, so I measured it. On the live build I loaded the page and let the model finish, then started logging network requests, saved ten notes, ran three searches and switched through all ten theme and mode combinations.

```
requests after load: 0
```

Two things to know. The first visit downloads the model from `huggingface.co`. And on later visits a small `generation_config.json` request to the same host can still show up, which lets Hugging Face see your IP and browser like any web request. To repeat the test, open DevTools, go to Network, clear the log after load, then use the app. I didn't test the export button.

## Why Does Open Innovation Matter?

- **The model is a file, not a service.** No API key, no per-call bill, nobody who can change the pricing. A hosted embedding API would mean sending every note you save to someone's server, which is the thing I wanted to avoid.
- **You can check the privacy claim.** Inference happens in your tab, so you can verify it in DevTools instead of taking my word.
- **I could test what was inside.** The truncation and the task prefixes are documented behaviour of the open model, and I checked both against my own test set.
- **It works offline.** The shell and the weights are cached, so it keeps working without signal.

## What it saves you

- Saving costs one paste and one keypress.
- Finding costs one sentence. On my set, keyword search sent me hunting for 6 of 20 notes; EmbeddingGemma sent me hunting for none.
- Once warm, one run on the live site showed results about 170 ms after I entered a query. That's one measurement, not a benchmark, and it will grow with a bigger collection.

I haven't measured hours saved, so I'm not claiming any.

## What's still missing

- Text only: no images, no OCR.
- No sync between devices. JSON export and import is the only way to move data.
- Hybrid ranking narrows the cases where the two scores disagree but doesn't remove them.
- Share-to-cubby on Android is implemented through the PWA share target, but I haven't tested it on a real phone, so I'm not showing a screenshot of it. Safari on iPhone has weak support, so paste manually there.

## Prize Categories

- **Best Use of Gemma.** EmbeddingGemma 300M is the whole retrieval engine. Every ranked result exists because that model embedded the note on-device. It never generates text.
- **Best Use of Render.** A static site with no backend, deployed from the repo's `render.yaml` blueprint and redeployed on every push.

## Try it

- Live: <https://cubby-6mn8.onrender.com>
- Repo: <https://github.com/ibrahim-iqbal/cubby-hf26-wk3>
- Five themes in light and dark, each checked for WCAG AA contrast with `test/contrast.mjs`:

![The five themes, dark on top and light below](https://github.com/ibrahim-iqbal/cubby-hf26-wk3/raw/main/docs/design/post/03-themes.jpg)
