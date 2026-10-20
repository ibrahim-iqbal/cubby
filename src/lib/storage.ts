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
    memoryFallback.unshift(item);
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

/** True once a save has fallen back to memory-only (not persisted across reloads). */
export function isMemoryOnly(): boolean {
  return memoryFallback !== null;
}
