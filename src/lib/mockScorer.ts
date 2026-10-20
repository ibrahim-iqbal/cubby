import type { CubbyItem, Hit } from '../types';

// D1 mock scorer — keyword/token overlap stand-in for the real embedding
// pipeline (ARCHITECTURE §4.2 lands D2). Documented in SPEC/ARCHITECTURE
// as the permanent manual-mode floor, not a throwaway: if the model never
// loads, this is what search falls back to. Real version adds a semantic
// cosine term; here semantic === lexical since there's no model yet.

function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function lexicalScore(queryTokens: string[], text: string): number {
  if (queryTokens.length === 0) return 0;
  const itemTokens = new Set(tokenize(text));
  const hits = queryTokens.filter((t) => itemTokens.has(t)).length;
  return hits / queryTokens.length;
}

const MIN_SCORE = 0.001;
const MAX_RESULTS = 8;

export function search(query: string, items: CubbyItem[]): Hit[] {
  const q = tokenize(query);
  if (q.length === 0) {
    // empty query → most recent (SPEC §1.1)
    return [...items]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_RESULTS)
      .map((item) => ({ item, score: 1, semantic: 1, lexical: 1 }));
  }
  return items
    .map((item) => {
      const lexical = lexicalScore(q, item.text);
      return { item, score: lexical, semantic: lexical, lexical };
    })
    .filter((h) => h.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}
