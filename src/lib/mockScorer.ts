import type { CubbyItem, Hit } from '../types';
import { tokenize, lexicalScore, recentHits } from './lexical';

// Manual-mode floor (RISKS R3 kill-switch / ARCHITECTURE §6.2): pure
// keyword overlap, no model involved. Used when the embedding model is
// unavailable, and as the D1 placeholder before D2 wired real embeddings.

const MIN_SCORE = 0.001;
const MAX_RESULTS = 8;

export function search(query: string, items: CubbyItem[]): Hit[] {
  const q = tokenize(query);
  if (q.length === 0) return recentHits(items, MAX_RESULTS);
  return items
    .map((item) => {
      const lexical = lexicalScore(q, item.text);
      return { item, score: lexical, semantic: lexical, lexical };
    })
    .filter((h) => h.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}
