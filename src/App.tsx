import { useEffect, useMemo, useRef, useState } from 'react';
import type { CubbyItem, Settings, ThemeName } from './types';
import { applyTheme, loadSettings, saveSettings } from './lib/settings';
import { getAllItems, newItem, saveItem } from './lib/storage';
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
  const [showThemes, setShowThemes] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const [modelProgress, setModelProgress] = useState(0);
  const [queryVector, setQueryVector] = useState<Float32Array | null>(null);
  const barRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    applyTheme(settings);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    getAllItems().then(setItems);
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
        <button className="pill-btn" onClick={() => setShowThemes((v) => !v)} aria-label="Theme settings">
          ● local · offline · nothing uploaded
        </button>
      </header>

      {showThemes && (
        <div className="theme-picker" role="group" aria-label="Theme picker">
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
          <div className="mode-toggle">
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
          <ul className="results">
            {hits.length === 0 && query.trim() && (
              <li className="empty">nothing close in your cubby — try other words. it matches meaning, not exact text.</li>
            )}
            {hits.map((hit, i) => (
              <li key={hit.item.id} className={i === selected ? 'row selected' : 'row'} onClick={() => handleCopy(hit.item)}>
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
              </li>
            ))}
          </ul>
        </>
      )}

      <footer className="footer">
        {footerLabel} · {items.length} items
      </footer>
    </div>
  );
}

export default App;
