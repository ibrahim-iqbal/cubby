# D4 acceptance test set — recall@3

Fixed set of 20 (dump, query) pairs (SPEC §9), canonical source
[`src/testdata/queries.mjs`](../src/testdata/queries.mjs). Queries are
paraphrase-heavy — most share few or zero words with their dump — to test
whether retrieval actually works by meaning, not just keyword luck.

**Method:** each dump is embedded once; each query is ranked against all
20 dumps (not just its own pair) under three scorers — semantic-only
(pure cosine), hybrid (`0.7*semantic + 0.3*lexical`, the shipped
default), and lexical-only (the manual-mode floor). A query "hits" if its
own dump lands in the top 3.

## Result (run live, real EmbeddingGemma, 2026-10-20)

| Scorer | Recall@3 |
|---|---|
| semantic-only | **20/20 — 100%** |
| hybrid (shipped) | **20/20 — 100%** |
| lexical-only (manual-mode floor) | 14/20 — 70% |

**Honest read:** on this 20-item set, semantic already hits the ceiling,
so hybrid doesn't need to pull it up here — the real value of hybrid is
the guarantee it gives on exact-keyword queries the test set doesn't
happen to probe (SPEC §8's whole point). The number that actually
separates this from keyword search is the lexical-only column: 6 misses,
all genuine paraphrases with no shared vocabulary.

**Limits of this result, stated plainly:** 20 items is a small, hand-written
set, and 100% on it is not a claim that semantic recall is perfect at
scale or on harder paraphrases — it's a claim that it clearly beats
keyword matching on exactly the cases that matter for this product. A
larger or adversarial set could still find misses; this is the fixed set
this project commits to re-running, not a ceiling claim.

## Lexical-only misses (the 6 cases keyword search gets wrong)

| query | dump |
|---|---|
| refund deadline for the apartment booking | Airbnb Lisbon — free cancellation until Jan 3 |
| sherlock holmes address | 123 Baker Street, London NW1 6XE |
| what flowers should I get for mother | mom's birthday is March 14, she likes tulips |
| how do I reach the property manager | landlord's number: 555-0199, text don't call |
| generate a self-signed TLS certificate | openssl req -x509 -newkey rsa:4096 ... |
| what time is my teeth cleaning | dentist appointment moved to 2:30pm Thursday, same office |

## The 20 pairs

| # | type | dump | query |
|---|---|---|---|
| 1 | note | Airbnb Lisbon — free cancellation until Jan 3 | refund deadline for the apartment booking |
| 2 | cmd | docker run --rm -it -v $(pwd):/app node:22 npm install | set up dependencies in a container |
| 3 | note | wifi password: Sunflower92! | what's the network password |
| 4 | link | news.ycombinator.com ... rust borrow checker thread | that hacker news post about ownership in rust |
| 5 | addr | 123 Baker Street, London NW1 6XE | sherlock holmes address |
| 6 | cmd | git rebase -i HEAD~3 to squash the last three commits | combine my recent commits into one |
| 7 | note | mom's birthday is March 14, she likes tulips | what flowers should I get for mother |
| 8 | cmd | npm run build && npm run preview | how do I test the production build locally |
| 9 | link | figma.com/file/abc123/onboarding-flow | link to the onboarding design |
| 10 | note | flight confirmation: UA 2201, SFO to JFK, seat 14C, June 9 7am | when's my flight to new york |
| 11 | addr | 192 Maple Ave, Austin TX 78701 — new office lease starts Feb 1 | where's the new office |
| 12 | cmd | kubectl rollout restart deployment/api -n prod | restart the production api pods |
| 13 | note | landlord's number: 555-0199, text don't call | how do I reach the property manager |
| 14 | note | recipe note: double the yeast if the kitchen's below 65F | cold kitchen bread tip |
| 15 | link | github.com/facebook/react/pull/28000 compiler discussion | that PR about react's compiler |
| 16 | note | car registration renewal due Aug 30, DMV online portal | when do I need to renew my car tags |
| 17 | cmd | openssl req -x509 -newkey rsa:4096 ... -days 365 | generate a self-signed TLS certificate |
| 18 | note | dentist appointment moved to 2:30pm Thursday, same office | what time is my teeth cleaning |
| 19 | addr | 450 Ocean Dr, Miami Beach FL 33139 — bachelor trip airbnb | address for the miami rental |
| 20 | cmd | psql -h localhost -U admin -d cubby_dev | command to connect to the dev db |
