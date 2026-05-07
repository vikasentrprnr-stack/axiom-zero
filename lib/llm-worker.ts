// lib/llm-worker.ts
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

// This file runs in a completely separate background thread.
// It intercepts messages from the main UI, runs the heavy WebGPU math, 
// and sends the text back without ever freezing the screen.
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};