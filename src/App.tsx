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

function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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

  // Debounced query embedding (ARCHITECTURE §4.2).
  useEffect(() => {
    if (modelStatus !== 'ready' || !query.trim()) {
      setQueryVector(null);
      return;
    }
    const t = setTimeout(() => {
      embedQuery(query).then(setQueryVector);
    }, QUERY_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, modelStatus]);

  const hits = useMemo(
    () => (modelStatus === 'unavailable' ? manualSearch(query, items) : hybridSearch(query, queryVector, items)),
    [query, queryVector, items, modelStatus],
  );

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
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await deleteItem(item.id);
    setUndoItem(item);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoItem(null), 5000);
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
    const mode = confirm('Merge with your current cubby? Cancel to replace it entirely.') ? 'merge' : 'replace';
    await importJSON(text, mode);
    setItems(await getAllItems());
  }

  async function handleClearAll() {
    if (!confirm('Clear your entire cubby? This cannot be undone.')) return;
    await clearAll();
    setItems([]);
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
          ? 'keyword search (fallback)'
          : 'on-device';

  return (
    <div className="shell">
      <header className="topbar">
        <span className="wordmark">cubby.</span>
        <div className="topbar-right">
          <span className="status-line" aria-hidden="true">
            ● local · offline · nothing uploaded
          </span>
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

      {showSettings && (
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
          </div>
        </div>
      )}

      {modelStatus === 'unavailable' && (
        <div className="banner">on-device search unavailable here; searching by keyword. your data still never leaves the device.</div>
      )}

      <div className="bar">
        <span className="prompt" aria-hidden="true">
          ❯
        </span>
        {mode === 'ask' ? (
          <input
            ref={barRef}
            className="bar-input"
            placeholder="ask your cubby…"
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
            value={dumpText}
            onChange={(e) => setDumpText(e.target.value)}
            onKeyDown={onBarKeyDown}
            autoFocus
          />
        )}
        <span className="hint" aria-hidden="true">
          {mode === 'ask' ? '↑↓  ↩ copy' : '↩ save'}
        </span>
      </div>

      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={mode === 'ask'} className={mode === 'ask' ? 'active' : ''} onClick={() => setMode('ask')}>
          ask
        </button>
        <button role="tab" aria-selected={mode === 'dump'} className={mode === 'dump' ? 'active' : ''} onClick={() => setMode('dump')}>
          dump
        </button>
      </div>

      {mode === 'ask' && (
        <>
          <div className="meta-line">
            {items.length === 0 ? 'nothing saved yet — switch to dump and paste anything.' : 'recent · paste to add, type to ask'}
          </div>
          <ul className="results" role="listbox" aria-label="Search results">
            {hits.length === 0 && query.trim() && (
              <li className="empty" role="status">nothing close in your cubby — try other words. it matches meaning, not exact text.</li>
            )}
            {hits.map((hit, i) => (
              <li
                key={hit.item.id}
                className={i === selected ? 'row selected' : 'row'}
                role="option"
                aria-selected={i === selected}
                onClick={() => handleCopy(hit.item)}
              >
                <span className="glyph" aria-hidden="true">
                  {hit.item.type}
                </span>
                <div className="content">
                  <div className="text">{hit.item.text}</div>
                  <div className="source">
                    {copied === hit.item.id ? '✓ copied' : `${hit.item.type} · ${timeAgo(hit.item.createdAt)}`}
                  </div>
                </div>
                <span className="match">{Math.round(hit.score * 100)}%</span>
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
              </li>
            ))}
          </ul>
        </>
      )}

      {undoItem && (
        <div className="toast">
          deleted
          <button onClick={handleUndo}>undo</button>
        </div>
      )}

      <footer className="footer">
        {footerLabel} · {items.length} items
      </footer>
    </div>
  );
}

export default App;
