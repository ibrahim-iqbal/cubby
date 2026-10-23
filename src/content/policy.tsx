// Privacy policy content — direct, honest, verifiable. Not legalese.
// Content lives in TSX so links/code stay first-class, not escaped markdown.
export function PolicyContent() {
  return (
    <div className="prose">
      <h2>what leaves your device</h2>
      <p>
        On first load, one HTTPS request to <code>huggingface.co</code> for the EmbeddingGemma model
        shards (~300MB total). The service worker caches those shards, so the weights are not
        downloaded again. A small model config file may still be requested from the same host each
        time the page loads. Like any web request, this lets Hugging Face see your IP address and
        browser.
      </p>

      <h2>what stays</h2>
      <p>
        Every dump you save, every embedding vector cubby computes for it, and every setting you
        change — all persisted in your browser's own IndexedDB and localStorage, on your device.
      </p>

      <h2>what's never sent</h2>
      <p>
        Your dumps, your queries, your clipboard, your settings, your usage patterns — none of it
        is transmitted anywhere. No analytics. No telemetry. No error reporting. No cookies. There
        is no cubby server to send them to.
      </p>

      <h2>how to verify</h2>
      <p>
        Open DevTools → Network tab and let the page load. Then clear the log and use the app:
        dump a note, ask a question, change the theme. You will see no new requests. The only
        traffic is at page load, and it goes to the model host. This is checkable in your own
        browser, not just stated here.
      </p>

      <h2>if you delete the app</h2>
      <p>
        Clearing your browser's site data for the cubby origin wipes everything cubby knows.
        There is no server copy to restore from. Export your cubby to JSON periodically if that
        matters to you (settings → data → export).
      </p>

      <h2>model license</h2>
      <p>
        The embedding model is Google's EmbeddingGemma, used under the{' '}
        <a href="https://ai.google.dev/gemma/terms" target="_blank" rel="noreferrer">
          Gemma Terms of Use
        </a>
        . Weights are fetched from the public{' '}
        <a
          href="https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX"
          target="_blank"
          rel="noreferrer"
        >
          onnx-community/embeddinggemma-300m-ONNX
        </a>{' '}
        mirror. This project does not redistribute them.
      </p>

      <h2>contact</h2>
      <p>
        Issues or questions:{' '}
        <a href="https://github.com/ibrahim-iqbal/cubby-hf26-wk3/issues" target="_blank" rel="noreferrer">
          github.com/ibrahim-iqbal/cubby-hf26-wk3/issues
        </a>
        .
      </p>
    </div>
  );
}
