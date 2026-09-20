/// <reference lib="webworker" />
import { createPaddleReader } from './paddle';
import type { OcrRequest, OcrResponse } from './types';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let reader: Awaited<ReturnType<typeof createPaddleReader>> | undefined;
const send = (message: OcrResponse) => scope.postMessage(message);
scope.onmessage = async ({ data }: MessageEvent<OcrRequest>) => {
  try {
    const started = performance.now();
    const reused = !!reader;
    send({ type: 'progress', value: { stage: 'loading' } });
    reader ??= await createPaddleReader(data.assetBase);
    const ready = performance.now();
    send({ type: 'progress', value: { stage: 'recognizing' } });
    const text = await reader.recognize(data.image);
    send({ type: 'result', value: {
      text: text.trim(), initializationMs: ready - started,
      recognitionMs: performance.now() - ready, reused,
    } });
  } catch (error) {
    console.error('Local OCR failed:', error instanceof Error ? error.message : String(error));
    send({ type: 'error', message: 'The photo reader could not process the photo. Try a clearer image.' });
  }
};
