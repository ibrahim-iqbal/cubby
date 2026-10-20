// Real embedding pipeline (ARCHITECTURE §3). Pinned per RISKS R1
// verification: onnx-community/embeddinggemma-300m-ONNX, feature-extraction
// task, task-prefixed inputs (query vs document), q8 quantized weights.
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export const MODEL_ID = 'onnx-community/embeddinggemma-300m-ONNX';
export const DOC_PREFIX = 'title: none | text: ';
export const QUERY_PREFIX = 'task: search result | query: ';
export const DIM = 256; // Matryoshka truncation — see ARCHITECTURE §3

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

type ProgressEvent = { status: string; file?: string; progress?: number };
type StatusListener = (status: ModelStatus, progress: number) => void;

let status: ModelStatus = 'idle';
let progress = 0;
let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;
// ponytail: single subscriber (App.tsx mount) — one callback slot, not a Set.
let listener: StatusListener | null = null;

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
  setStatus('loading', 0);
  pipelinePromise = pipeline('feature-extraction', MODEL_ID, {
    dtype: 'q8',
    progress_callback: (e: ProgressEvent) => {
      if (typeof e.progress === 'number') setStatus('loading', Math.min(e.progress / 100, 1));
    },
  })
    .then((p) => {
      setStatus('ready', 1);
      return p;
    })
    .catch((err) => {
      console.warn('EmbeddingGemma failed to load — falling back to manual mode', err);
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
