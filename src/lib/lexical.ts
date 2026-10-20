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

export function lexicalScore(queryTokens: string[], text: string): number {
  if (queryTokens.length === 0) return 0;
  const itemTokens = new Set(tokenize(text));
  const hits = queryTokens.filter((t) => itemTokens.has(t)).length;
  return hits / queryTokens.length;
}
