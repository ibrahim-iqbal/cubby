// FAQ content. Short, concrete, honest. Each answer is 2–3 sentences max.
const QUESTIONS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: 'why is the first load ~300MB?',
    a: (
      <>
        The embedding model (EmbeddingGemma 300M, q8 quantized) is a one-time download. Your browser's
        service worker caches it permanently; the second load is instant and offline.
      </>
    ),
  },
  {
    q: "what happens if I clear my browser's site data?",
    a: (
      <>
        Everything cubby knows gets wiped — items, vectors, settings, cached model shards. There is no
        server copy. Export to JSON (settings → data → export) if that would hurt.
      </>
    ),
  },
  {
    q: 'does it work offline?',
    a: <>Yes, fully, after the first load. The app shell and the model are both service-worker-cached.</>,
  },
  {
    q: "why doesn't Share-to-cubby work on iPhone?",
    a: (
      <>
        iOS Safari's Web Share Target support is weak and unreliable. On Android it works cleanly. On
        iOS, open cubby and paste manually — same result, two more taps.
      </>
    ),
  },
  {
    q: 'can I sync between devices?',
    a: (
      <>
        No. cubby is single-device by design — syncing would require a server, which would break the
        "nothing uploaded" promise. Portability is via JSON export/import.
      </>
    ),
  },
  {
    q: 'is my data encrypted?',
    a: (
      <>
        It isn't transmitted, so transport encryption doesn't apply. On-device storage uses the
        browser's standard IndexedDB; full-disk encryption on your OS (FileVault, BitLocker, Android
        file-based encryption) covers it at rest.
      </>
    ),
  },
  {
    q: 'what if the model fails to load?',
    a: (
      <>
        cubby falls back to pure keyword search, labeled honestly in the footer and side panel. You
        can still dump and still ask — just without the semantic layer.
      </>
    ),
  },
  {
    q: 'how good is the search, really?',
    a: (
      <>
        On a fixed 20-item test set, semantic recall@3 is 20/20 vs. 14/20 for plain keyword. Full
        methodology and the six keyword-misses are in{' '}
        <a
          href="https://github.com/ibrahim-iqbal/cubby-hf26-wk3/blob/main/test/queries.md"
          target="_blank"
          rel="noreferrer"
        >
          test/queries.md
        </a>
        . 20 items is a small, hand-picked set — not a claim of perfection at scale.
      </>
    ),
  },
];

export function FaqContent() {
  return (
    <div className="prose faq">
      {QUESTIONS.map((item, i) => (
        <details key={i}>
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}
