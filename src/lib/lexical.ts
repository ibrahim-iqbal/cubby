export function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export function lexicalScore(queryTokens: string[], text: string): number {
  if (queryTokens.length === 0) return 0;
  const itemTokens = new Set(tokenize(text));
  const hits = queryTokens.filter((t) => itemTokens.has(t)).length;
  return hits / queryTokens.length;
}
