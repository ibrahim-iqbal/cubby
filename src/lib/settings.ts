import type { Settings } from '../types';

const KEY = 'cubby.settings.v1';
const DEFAULTS: Settings = { theme: 'terminal', mode: 'system' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS; // ponytail: storage can throw in private mode, default covers it
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // not saved across reloads; app stays usable in-memory (RISKS R4)
  }
}

/** Resolves 'system' against the OS preference for applying data-mode. */
export function resolveMode(mode: Settings['mode']): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(s: Settings) {
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.dataset.mode = resolveMode(s.mode);
}
