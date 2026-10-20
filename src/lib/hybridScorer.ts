import type { CubbyItem, Hit } from '../types';
import { tokenize, lexicalScore } from './lexical';
import { cosine } from './embeddings';

// Real hybrid ranking (SPEC §8, ARCHITECTURE §4.2): semantic cosine +
// lexical overlap, blended. Weights are a tuning knob — 0.7/0.3 is the
// starting point to tune against the D4 test set, not a final answer.
const SEMANTIC_WEIGHT = 0.7;
const LEXICAL_WEIGHT = 0.3;
const MIN_SCORE = 0.05;
const MAX_RESULTS = 8;

export function search(query: string, queryVector: Float32Array | null, items: CubbyItem[]): Hit[] {
  const q = tokenize(query);
  if (q.length === 0) {
    return [...items]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_RESULTS)
      .map((item) => ({ item, score: 1, semantic: 1, lexical: 1 }));
  }
  return items
    .map((item) => {
      const lexical = lexicalScore(q, item.text);
      // Item has no vector yet (embedding still queued) → lexical-only,
      // still visible (SPEC §1.1: searchable the moment its vector lands).
      const semantic = queryVector && item.vector ? cosine(queryVector, item.vector) : 0;
      const score = queryVector
        ? SEMANTIC_WEIGHT * semantic + LEXICAL_WEIGHT * lexical
        : lexical; // model unavailable this query — lexical carries the rank
      return { item, score, semantic, lexical };
    })
    .filter((h) => h.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);
}
