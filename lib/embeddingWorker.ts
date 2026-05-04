// lib/embeddingWorker.ts
import { pipeline, env } from '@huggingface/transformers';

// HARDWARE FIX: Disable the strict Cache API to prevent 'Failed to execute add on Cache' errors.
// The browser's native HTTP cache will still keep the downloads fast without crashing.
env.allowLocalModels = false;
env.useBrowserCache = false; 
;(env.backends.onnx as any).wasm.proxy = false;
;(env.backends.onnx as any).wasm.numThreads = 1;

class VectorSingleton {
  static task = 'feature-extraction';
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: any = null;
  static async getInstance(progress_callback: Function) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task as any, this.model, { 
          dtype: 'fp32',
          progress_callback
      } as any); 
    }
    return this.instance;
  }
}

self.addEventListener('message', async (e: MessageEvent) => {
  const { type, chunks, text } = e.data;

  if (type === 'EMBED_CHUNKS') {
    const extractor = await VectorSingleton.getInstance((data: any) => self.postMessage({ type: 'PROGRESS', data }));
    const vectors: any[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        const output = await extractor(chunks[i].text, { pooling: 'mean', normalize: true, truncation: true, max_length: 512 } as any);
        vectors.push({ ...chunks[i], embedding: Array.from(output.data) });
      } catch (err) {
        console.warn("Skipped unreadable chunk");
      }
      if (i % 5 === 0) self.postMessage({ type: 'EMBED_PROGRESS', current: i + 1, total: chunks.length });
    }
    self.postMessage({ type: 'EMBED_COMPLETE', vectors });
  }

  if (type === 'EMBED_QUERY') {
    const extractor = await VectorSingleton.getInstance(() => {});
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    self.postMessage({ type: 'QUERY_EMBEDDED', embedding: Array.from(output.data) });
  }
});