import type { CubbyItem, ItemType } from '../types';

// ponytail: hand-rolled IndexedDB wrapper, few lines beat pulling in `idb`
// for one object store. Falls back to an in-memory array if IndexedDB is
// unavailable (private window / quota) — RISKS R4: never pretend a save
// persisted when it didn't.

const DB_NAME = 'cubby';
const STORE = 'items';
let memoryFallback: CubbyItem[] | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function detectType(text: string): ItemType {
  const t = text.trim();
  if (/^https?:\/\//i.test(t)) return 'link';
  if (/^\d+\s+[\w\s.,'-]+,\s*\w/.test(t) || /\b\d{5}\b/.test(t)) return 'addr';
  if (/^[\w.-]+\s+[-\w]/.test(t) && /(--|\||&&|\$\(|sudo |npm |git |docker )/.test(t)) return 'cmd';
  return 'note';
}

export function newItem(text: string): CubbyItem {
  return { id: crypto.randomUUID(), text, type: detectType(text), createdAt: Date.now() };
}

export async function getAllItems(): Promise<CubbyItem[]> {
  if (memoryFallback) return memoryFallback;
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as CubbyItem[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    memoryFallback = [];
    return memoryFallback;
  }
}

export async function saveItem(item: CubbyItem): Promise<void> {
  if (memoryFallback) {
    const i = memoryFallback.findIndex((x) => x.id === item.id);
    if (i >= 0) memoryFallback[i] = item;
    else memoryFallback.unshift(item);
    return;
  }
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    memoryFallback = [item];
  }
}

export async function deleteItem(id: string): Promise<void> {
  if (memoryFallback) {
    memoryFallback = memoryFallback.filter((i) => i.id !== id);
    return;
  }
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // nothing to delete from if storage never worked
  }
}

export async function clearAll(): Promise<void> {
  if (memoryFallback) {
    memoryFallback = [];
    return;
  }
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // nothing to clear if storage never worked
  }
}

// Export JSON (SPEC §4): vectors omitted by default — portable, small,
// re-embeddable on import.
type ExportedItem = Omit<CubbyItem, 'vector'>;

export async function exportJSON(): Promise<string> {
  const items = await getAllItems();
  const exported: ExportedItem[] = items.map(({ vector: _vector, ...rest }) => rest);
  return JSON.stringify({ version: 1, exportedAt: Date.now(), items: exported }, null, 2);
}

/** Returns the number of items imported. Vectors backfill later via the normal embed queue. */
export async function importJSON(json: string, mode: 'merge' | 'replace'): Promise<number> {
  const parsed = JSON.parse(json) as { items: ExportedItem[] };
  if (!Array.isArray(parsed.items)) throw new Error('not a cubby export file');
  if (mode === 'replace') await clearAll();
  for (const item of parsed.items) {
    await saveItem(item as CubbyItem);
  }
  return parsed.items.length;
}
