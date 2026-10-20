import type { CubbyItem, Hit } from '../types';

export function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Empty-query fallback shared by both scorers: most recent items first. */
export function recentHits(items: CubbyItem[], max: number): Hit[] {
  return [...items]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max)
    .map((item) => ({ item, score: 1, semantic: 1, lexical: 1 }));
}

// Substring/prefix scoring, not whole-token set intersection — so "lis"
// matches "lisbon" and "ub" matches "cubby". Exact word > prefix > inside.
// Scores sum per query token (max 1 per token), normalized by query length.
export function lexicalScore(queryTokens: string[], text: string): number {
  if (queryTokens.length === 0) return 0;
  const itemTokens = tokenize(text);
  let hits = 0;
  for (const q of queryTokens) {
    let best = 0;
    for (const it of itemTokens) {
      if (it === q) {
        best = 1;
        break;
      }
      if (it.startsWith(q)) best = Math.max(best, 0.9);
      else if (it.includes(q)) best = Math.max(best, 0.6);
    }
    hits += best;
  }
  return hits / queryTokens.length;
}
