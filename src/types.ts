// Shapes mirror docs/SPEC.md §7 and §8.

export type ItemType = 'note' | 'link' | 'cmd' | 'addr';

export type CubbyItem = {
  id: string;
  text: string;
  type: ItemType;
  createdAt: number;
  // vector/dim land in D2 once real embeddings exist.
};

export type ThemeName = 'terminal' | 'paper' | 'mono' | 'cobalt' | 'ember';
export type ModeName = 'light' | 'dark' | 'system';

export type Settings = {
  theme: ThemeName;
  mode: ModeName;
};

export type Hit = {
  item: CubbyItem;
  score: number;
  semantic: number;
  lexical: number;
};
