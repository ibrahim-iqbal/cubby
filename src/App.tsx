import { useEffect, useMemo, useRef, useState } from 'react';
import type { CubbyItem, Settings, ThemeName } from './types';
import { applyTheme, loadSettings, saveSettings } from './lib/settings';
import { getAllItems, newItem, saveItem, deleteItem, clearAll, exportJSON, importJSON } from './lib/storage';
import { embedDocument, embedQuery, loadModel, onModelStatus, type ModelStatus } from './lib/embeddings';
import { search as hybridSearch } from './lib/hybridScorer';
import { search as manualSearch } from './lib/mockScorer';
import './App.css';

type Mode = 'ask' | 'dump';

const THEMES: ThemeName[] = ['terminal', 'paper', 'mono', 'cobalt', 'ember'];
const QUERY_DEBOUNCE_MS = 120;
const ROW_EXIT_MS = 160; // keep in sync with .row-collapse transition duration in App.css

const EXAMPLES = [
  'wifi password: Sunflower92',
  'https://example.com/the-article-i-was-reading',
  'docker run --rm -it -v $(pwd):/app node:22 npm install',
  '123 Baker Street, London NW1 6XE',
];

// Monochrome, terminal-native glyphs — scannable at a glance in a way
// three rows reading "note" / "note" / "note" never were.
const TYPE_GLYPHS: Record<string, string> = {
  note: '≡',
  link: '↗',
  cmd: '$',
  addr: '◉',
};

function typeCounts(items: CubbyItem[]): string {
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.type] = (counts[i.type] ?? 0) + 1;
  const labels: Record<string, string> = { note: 'notes', link: 'links', cmd: 'commands', addr: 'addresses' };
  return Object.entries(counts)
    .map(([type, n]) => `${n} ${labels[type] ?? type}`)
    .join(' · ');
}

function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Two-way smooth open/close via CSS grid-rows (0fr <-> 1fr) — no JS height
// measurement, no animation library. Content stays mounted so collapsing
// is a real animation, not an instant unmount; `inert` keeps it out of
// tab order and screen readers while closed.
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={`collapse${open ? ' open' : ''}`} inert={!open}>
      <div className="collapse-inner">{children}</div>
    </div>
  );
}

// Spotlight glyph layer: a fixed grid of monochrome terminal chars behind
// the shell, hidden by a mask that only reveals ~120px around the cursor.
// All visual work is CSS (mask-image: radial-gradient); JS only writes two
// CSS vars from mousemove, rAF-throttled so it fires once per frame.
function CursorGlyphs() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia('(hover: hover)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('reduced');
      return;
    }
    let frame = 0;
    let x = -9999;
    let y = -9999;
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        el.style.setProperty('--mx', `${x}px`);
        el.style.setProperty('--my', `${y}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return <div ref={ref} className="cursor-glyphs" aria-hidden="true" />;
}

function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [items, setItems] = useState<CubbyItem[]>([]);
  const [mode, setMode] = useState<Mode>('ask');
  const [query, setQuery] = useState('');
  const [dumpText, setDumpText] = useState('');
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const [modelProgress, setModelProgress] = useState(0);
  const [queryVector, setQueryVector] = useState<Float32Array | null>(null);
  const [undoItem, setUndoItem] = useState<CubbyItem | null>(null);
  const [pendingImport, setPendingImport] = useState<{ text: string } | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return localStorage.getItem('cubby.seenIntro.v1') !== '1';
    } catch {
      return true;
    }
  });
  const barRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    applyTheme(settings);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    getAllItems().then(setItems);
  }, []);

  // Share-to-cubby (SPEC §1.3, ARCHITECTURE §4.3): the OS Share sheet GETs
  // /share?title=&text=&url= per manifest.webmanifest's share_target. Write
  // straight to the store, no extra screen, then clean the URL.
  useEffect(() => {
    if (window.location.pathname !== '/share') return;
    const p = new URLSearchParams(window.location.search);
    const parts = [p.get('title'), p.get('text'), p.get('url')].filter(Boolean);
    const text = parts.join(' — ').trim();
    window.history.replaceState(null, '', '/');
    if (!text) return;
    const item = newItem(text);
    saveItem(item).then(() => {
      setItems((prev) => [item, ...prev]);
      embedDocument(text).then((vector) => {
        if (!vector) return;
        const withVector = { ...item, vector };
        saveItem(withVector);
        setItems((prev) => prev.map((i) => (i.id === item.id ? withVector : i)));
      });
    });
  }, []);

  // Kick off the model load once on mount (SPEC §5: shell + manual search
  // usable immediately, semantic unlocks when ready).
  useEffect(() => {
    const unsub = onModelStatus((s, p) => {
      setModelStatus(s);
      setModelProgress(p);
    });
    loadModel();
    return unsub;
  }, []);

  // Debounced query embedding (ARCHITECTURE §4.2). Tracks in-flight state
  // so the UI can say "searching…" instead of looking broken — a
  // zero-shared-word query has nothing to show from the lexical side
  // alone while the semantic vector is still resolving (can take ~1-2s).
  const [searching, setSearching] = useState(false);
  const queryTokenRef = useRef(0);

  useEffect(() => {
    if (modelStatus !== 'ready' || !query.trim()) {
      setQueryVector(null);
      setSearching(false);
      return;
    }
    const myToken = ++queryTokenRef.current;
    setSearching(true);
    const t = setTimeout(() => {
      embedQuery(query).then((v) => {
        if (queryTokenRef.current !== myToken) return; // a newer query superseded this one
        setQueryVector(v);
        setSearching(false);
      });
    }, QUERY_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, modelStatus]);

  const hits = useMemo(
    () => (modelStatus === 'unavailable' ? manualSearch(query, items) : hybridSearch(query, queryVector, items)),
    [query, queryVector, items, modelStatus],
  );

  // Dump mode shows the cubby too (read-only recent list) — the screen
  // never goes empty just because you're mid-dump.
  const recentHits = useMemo(() => hybridSearch('', null, items), [items]);

  function useExample(text: string) {
    setMode('dump');
    setDumpText(text);
  }

  useEffect(() => setSelected(0), [query, mode]);

  async function handleDumpSubmit() {
    const text = dumpText.trim();
    if (!text) return;
    const item = newItem(text);
    await saveItem(item);
    setItems((prev) => [item, ...prev]);
    setDumpText('');
    // Embed off the critical path — save never blocks on the model (SPEC §1.2).
    embedDocument(text).then((vector) => {
      if (!vector) return;
      const withVector = { ...item, vector };
      saveItem(withVector);
      setItems((prev) => prev.map((i) => (i.id === item.id ? withVector : i)));
    });
  }

  async function handleDelete(item: CubbyItem) {
    setRemovingIds((prev) => new Set(prev).add(item.id));
    await deleteItem(item.id);
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      setUndoItem(item);
      clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndoItem(null), 5000);
    }, ROW_EXIT_MS);
  }

  async function handleUndo() {
    if (!undoItem) return;
    await saveItem(undoItem);
    setItems((prev) => [undoItem, ...prev]);
    setUndoItem(null);
    clearTimeout(undoTimer.current);
  }

  async function handleExport() {
    const json = await exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cubby-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    setPendingImport({ text });
  }

  async function resolveImport(mode: 'merge' | 'replace') {
    if (!pendingImport) return;
    await importJSON(pendingImport.text, mode);
    setItems(await getAllItems());
    setPendingImport(null);
  }

  async function handleClearAll() {
    if (!confirm('Clear your entire cubby? This cannot be undone.')) return;
    await clearAll();
    setItems([]);
  }

  function dismissIntro() {
    setShowIntro(false);
    try {
      localStorage.setItem('cubby.seenIntro.v1', '1');
    } catch {
      // not persisted — intro just reappears next load, harmless
    }
  }

  async function handleCopy(item: CubbyItem) {
    try {
      await navigator.clipboard.writeText(item.text);
    } catch {
      // clipboard permission denied — the row still shows the text to select manually
    }
    setCopied(item.id);
    setTimeout(() => setCopied(null), 1400);
  }

  function onBarKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (mode === 'dump') {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleDumpSubmit();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = hits[selected];
      if (hit) handleCopy(hit.item);
    } else if (e.key === 'Escape') {
      setQuery('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setMode('dump');
    }
  }

  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        barRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, []);

  const footerLabel =
    modelStatus === 'ready'
      ? 'EmbeddingGemma · on-device'
      : modelStatus === 'loading'
        ? `loading model… ${Math.round(modelProgress * 100)}%`
        : modelStatus === 'unavailable'
          ? 'keyword search (no model)'
          : 'on-device';

  return (
    <>
      <CursorGlyphs />
      <div className="shell">
        <header className="topbar">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">
            ❯
          </span>
          <span className="wordmark">cubby.</span>
        </span>
        <div className="topbar-right">
          <span className="status-line">● local · offline · nothing uploaded</span>
          <button
            className="settings-btn"
            onClick={() => setShowSettings((v) => !v)}
            aria-expanded={showSettings}
            aria-label={showSettings ? 'Close settings' : 'Open settings'}
          >
            settings
          </button>
        </div>
      </header>

      <Collapse open={showIntro}>
        <div className="intro">
          <p>
            <strong>dump</strong> anything — no tags, no title, just paste and press ↩.{' '}
            <strong>ask</strong> for it back later, in your own words — it matches by meaning, not
            exact text.
          </p>
          <button onClick={dismissIntro}>got it</button>
        </div>
      </Collapse>

      <Collapse open={showSettings}>
        <div className="settings-panel" role="group" aria-label="Settings">
          <div className="settings-section">
            <span className="settings-label">theme</span>
            <div className="settings-row">
              {THEMES.map((t) => (
                <button
                  key={t}
                  className={`swatch${settings.theme === t ? ' active' : ''}`}
                  data-theme={t}
                  onClick={() => setSettings((s) => ({ ...s, theme: t }))}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-section">
            <span className="settings-label">mode</span>
            <div className="settings-row">
              {(['light', 'dark', 'system'] as const).map((m) => (
                <button
                  key={m}
                  className={settings.mode === m ? 'active' : ''}
                  onClick={() => setSettings((s) => ({ ...s, mode: m }))}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-section">
            <span className="settings-label">data</span>
            <div className="settings-row">
              <button onClick={handleExport}>export</button>
              <button onClick={() => importRef.current?.click()}>import</button>
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportFile(f);
                  e.target.value = '';
                }}
              />
              <button className="danger" onClick={handleClearAll}>
                clear all
              </button>
            </div>
            <Collapse open={!!pendingImport}>
              <div className="import-choice">
                <span>merge with your cubby, or replace it entirely?</span>
                <div className="settings-row">
                  <button onClick={() => resolveImport('merge')}>merge</button>
                  <button className="danger" onClick={() => resolveImport('replace')}>
                    replace
                  </button>
                  <button onClick={() => setPendingImport(null)}>cancel</button>
                </div>
              </div>
            </Collapse>
          </div>
        </div>
      </Collapse>

      <Collapse open={modelStatus === 'loading'}>
        <div className="banner">
          setting up on-device search… this downloads once and stays on your device
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.round(modelProgress * 100)}%` }} />
          </div>
        </div>
      </Collapse>

      <Collapse open={modelStatus === 'unavailable'}>
        <div className="banner">on-device search unavailable here; searching by keyword. your data still never leaves the device.</div>
      </Collapse>

      <div className={`bar bar-${mode}`}>
        <span className="prompt" aria-hidden="true">
          {mode === 'ask' ? '❯' : '+'}
        </span>
        {mode === 'ask' ? (
          <input
            ref={barRef}
            className="bar-input"
            placeholder="ask your cubby…"
            aria-label="Ask your cubby"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onBarKeyDown}
            autoFocus
          />
        ) : (
          <input
            ref={barRef}
            className="bar-input"
            placeholder="paste a link, note, address, snippet — anything. press ↩ and forget it."
            aria-label="Dump text, link, or anything else"
            value={dumpText}
            onChange={(e) => setDumpText(e.target.value)}
            onKeyDown={onBarKeyDown}
            autoFocus
          />
        )}
        <span className="hint" aria-hidden="true">
          {mode === 'ask' ? (
            <>
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              <kbd>↩</kbd>
              <span className="hint-label">copy</span>
            </>
          ) : (
            <>
              <kbd>↩</kbd>
              <span className="hint-label">save</span>
            </>
          )}
        </span>
      </div>

      <div className="segmented">
        <button aria-pressed={mode === 'ask'} className={mode === 'ask' ? 'active' : ''} onClick={() => setMode('ask')}>
          ask
        </button>
        <button aria-pressed={mode === 'dump'} className={mode === 'dump' ? 'active' : ''} onClick={() => setMode('dump')}>
          dump
        </button>
      </div>

      {items.length === 0 ? (
        mode === 'ask' ? (
          <div className="meta-line">nothing saved yet — switch to dump and paste anything.</div>
        ) : (
          <>
            <div className="meta-line">your cubby is empty — try one of these, or paste your own</div>
            <ul className="results" aria-label="Examples">
              {EXAMPLES.map((ex) => (
                <li key={ex} className="row example-row" onClick={() => useExample(ex)}>
                  <span className="glyph" aria-hidden="true">
                    ·
                  </span>
                  <div className="content">
                    <div className="text">{ex}</div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )
      ) : (
        <>
          <div className="meta-line">
            {mode === 'ask' ? 'recent · paste to add, type to ask' : 'your cubby · switch to ask to search it'}
            {' — '}
            {typeCounts(items)}
          </div>
          <ul className="results" aria-label={mode === 'ask' ? 'Search results' : 'Recent items'}>
            {mode === 'ask' && hits.length === 0 && query.trim() && (
              <li className="empty" role="status">
                {searching ? 'searching by meaning…' : 'nothing close in your cubby — try other words. it matches meaning, not exact text.'}
              </li>
            )}
            {(() => {
              const list = mode === 'ask' ? hits : recentHits;
              const browsing = !query.trim(); // group only when not actively searching
              let prevType: string | null = null;
              return list.map((hit, i) => {
                const showDivider = browsing && hit.item.type !== prevType;
                prevType = hit.item.type;
                return (
                  <li key={hit.item.id} className={`row-collapse${removingIds.has(hit.item.id) ? '' : ' open'}`}>
                    <div>
                      {showDivider && (
                        <div className="type-divider" aria-hidden="true">
                          <span className="type-divider-label">
                            {hit.item.type === 'cmd' ? 'commands' : hit.item.type === 'addr' ? 'addresses' : `${hit.item.type}s`}
                          </span>
                        </div>
                      )}
                      <div
                        className={mode === 'ask' && i === selected ? 'row selected' : 'row'}
                        aria-current={mode === 'ask' && i === selected ? 'true' : undefined}
                        onClick={() => handleCopy(hit.item)}
                        style={mode === 'ask' ? { ['--row-score' as string]: hit.score } : undefined}
                      >
                        {mode === 'ask' && <span className="score-bar" aria-hidden="true" />}
                        <span className="glyph" aria-hidden="true" title={hit.item.type}>
                          {TYPE_GLYPHS[hit.item.type] ?? '•'}
                        </span>
                        <div className="content">
                          <div className="text">{hit.item.text}</div>
                          <div className="source">
                            {copied === hit.item.id ? '✓ copied' : timeAgo(hit.item.createdAt)}
                          </div>
                        </div>
                        <button
                          className="delete-btn"
                          aria-label={`Delete "${hit.item.text.slice(0, 40)}"`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(hit.item);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </li>
                );
              });
            })()}
          </ul>
        </>
      )}

      <Collapse open={!!undoItem}>
        <div className="toast">
          deleted
          <button onClick={handleUndo}>undo</button>
        </div>
      </Collapse>

      <footer className="footer" aria-live="polite">
        {footerLabel} · {items.length} items
      </footer>
      </div>
    </>
  );
}

export default App;
