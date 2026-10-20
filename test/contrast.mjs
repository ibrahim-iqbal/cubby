// WCAG AA contrast check (UI.md: --fg on --bg, --accent on --bg, every
// theme x mode). AA text threshold: 4.5:1 normal text, 3:1 large/UI.
// ponytail: ~30 lines of math beats pulling in a contrast-checker package.

const themes = {
  terminal: {
    dark: { bg: '#0e0f11', fg: '#e8e9ea', accent: '#7ee0b8' },
    light: { bg: '#f6f7f5', fg: '#17181a', accent: '#12916a' },
  },
  paper: {
    dark: { bg: '#17150f', fg: '#ece6d8', accent: '#e0b06a' },
    light: { bg: '#f4efe3', fg: '#2a2419', accent: '#9a6a15' },
  },
  mono: {
    dark: { bg: '#101012', fg: '#ededed', accent: '#c9cacc' },
    light: { bg: '#f5f5f5', fg: '#161616', accent: '#3a3b3d' },
  },
  cobalt: {
    dark: { bg: '#0d1017', fg: '#e6e9f0', accent: '#5b9dff' },
    light: { bg: '#f3f5fa', fg: '#151826', accent: '#2f6fe0' },
  },
  ember: {
    dark: { bg: '#16100f', fg: '#efe3df', accent: '#e88f7a' },
    light: { bg: '#f6efec', fg: '#2a1e1b', accent: '#c25a3f' },
  },
};

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(hexA, hexB) {
  const [l1, l2] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

const FG_THRESHOLD = 4.5; // body text
const ACCENT_THRESHOLD = 3; // UI/large text — accent is never body copy here

let failures = 0;
for (const [theme, modes] of Object.entries(themes)) {
  for (const [mode, { bg, fg, accent }] of Object.entries(modes)) {
    const fgRatio = contrast(fg, bg);
    const accentRatio = contrast(accent, bg);
    const fgOK = fgRatio >= FG_THRESHOLD;
    const accentOK = accentRatio >= ACCENT_THRESHOLD;
    if (!fgOK || !accentOK) failures++;
    console.log(
      `${theme}/${mode}: fg ${fgRatio.toFixed(2)}:1 ${fgOK ? 'PASS' : 'FAIL'} · accent ${accentRatio.toFixed(2)}:1 ${accentOK ? 'PASS' : 'FAIL'}`,
    );
  }
}
console.log(failures === 0 ? '\nAll 5 themes x 2 modes pass WCAG AA.' : `\n${failures} combination(s) FAILED AA.`);
process.exit(failures === 0 ? 0 : 1);
