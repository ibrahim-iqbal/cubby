// Real embedding pipeline (ARCHITECTURE §3). Pinned per RISKS R1
// verification: onnx-community/embeddinggemma-300m-ONNX, feature-extraction
// task, task-prefixed inputs (query vs document), q8 quantized weights.
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export const MODEL_ID = 'onnx-community/embeddinggemma-300m-ONNX';
export const DOC_PREFIX = 'title: none | text: ';
export const QUERY_PREFIX = 'task: search result | query: ';
export const DIM = 256; // Matryoshka truncation — see ARCHITECTURE §3

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'unavailable';
export type LogLine = { t: number; msg: string };

type ProgressEvent = { status: string; file?: string; progress?: number; loaded?: number; total?: number };
type StatusListener = (status: ModelStatus, progress: number) => void;
type LogListener = (lines: readonly LogLine[]) => void;

let status: ModelStatus = 'idle';
let progress = 0;
let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;
// ponytail: single subscriber (App.tsx mount) — one callback slot, not a Set.
let listener: StatusListener | null = null;

// Real event log — rendered as a terminal-style stream in the side panel's
// "loading" state. Timestamps are elapsed-seconds since loadModel() was first
// called. Entries only ever append; the log is the honest, user-visible proof
// that the model fetch is the one and only outbound call cubby makes.
const logLines: LogLine[] = [];
let logListener: LogListener | null = null;
let loadStartMs = 0;
// Only log one progress heartbeat per file+decile (0, 10, 20, …) to keep the
// stream from scrolling off its own feet during download.
const seenMilestones = new Set<string>();

function appendLog(msg: string) {
  const t = loadStartMs ? (performance.now() - loadStartMs) / 1000 : 0;
  logLines.push({ t, msg });
  logListener?.(logLines);
}

export function onModelLog(fn: LogListener): () => void {
  logListener = fn;
  fn(logLines);
  return () => {
    if (logListener === fn) logListener = null;
  };
}

function setStatus(s: ModelStatus, p = progress) {
  status = s;
  progress = p;
  listener?.(status, progress);
}

export function onModelStatus(fn: StatusListener): () => void {
  listener = fn;
  fn(status, progress);
  return () => {
    if (listener === fn) listener = null;
  };
}

/** Kicks off (or returns) the model load. Never throws — resolves null on failure. */
export function loadModel(): Promise<FeatureExtractionPipeline | null> {
  if (pipelinePromise) return pipelinePromise.catch(() => null);
  loadStartMs = performance.now();
  setStatus('loading', 0);
  appendLog('fetching model weights (first load only — cached permanently after)…');
  pipelinePromise = pipeline('feature-extraction', MODEL_ID, {
    dtype: 'q8',
    progress_callback: (e: ProgressEvent) => {
      if (typeof e.progress === 'number') {
        setStatus('loading', Math.min(e.progress / 100, 1));
        const file = e.file ?? '';
        const decile = Math.floor(e.progress / 10) * 10;
        const key = `${file}@${decile}`;
        if (decile > 0 && decile < 100 && !seenMilestones.has(key)) {
          seenMilestones.add(key);
          const sizeStr = e.loaded && e.total
            ? ` (${(e.loaded / 1024 / 1024).toFixed(0)}MB / ${(e.total / 1024 / 1024).toFixed(0)}MB)`
            : '';
          const fileName = file ? ` ${file.split('/').pop()}` : '';
          appendLog(`  ${decile}%${fileName}${sizeStr}`);
        }
      }
      if (e.status === 'ready') appendLog(`  ✓ ${e.file ?? 'shard'}`);
    },
  })
    .then((p) => {
      appendLog('warming inference pipeline…');
      setStatus('ready', 1);
      appendLog('ready — nothing was uploaded.');
      return p;
    })
    .catch((err) => {
      console.warn('EmbeddingGemma failed to load — falling back to manual mode', err);
      appendLog(`error: ${String(err).slice(0, 80)}`);
      appendLog('falling back to keyword search (still local, still nothing uploaded).');
      setStatus('unavailable', 0);
      throw err;
    });
  return pipelinePromise.catch(() => null);
}

function truncateAndNormalize(data: Float32Array, dim: number): Float32Array {
  const v = data.slice(0, dim);
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

async function embed(text: string): Promise<Float32Array | null> {
  const extractor = await loadModel();
  if (!extractor) return null;
  const out = await extractor(text, { pooling: 'mean', normalize: false });
  return truncateAndNormalize(out.data as Float32Array, DIM);
}

export const embedDocument = (text: string) => embed(DOC_PREFIX + text);
export const embedQuery = (text: string) => embed(QUERY_PREFIX + text);

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both pre-normalized — dot product is cosine
}
