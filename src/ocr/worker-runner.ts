/// <reference lib="webworker" />
import type { OcrProgress, OcrRequest, OcrResponse } from './types';

type Recognizer = { recognize: (input: Pick<OcrRequest, 'image' | 'blob'>) => Promise<string> };
export function serveRecognizer(create: (assetBase: string, progress: (value: OcrProgress) => void) => Promise<Recognizer>) {
  const scope = self as unknown as DedicatedWorkerGlobalScope;
  let reader: Recognizer | undefined;
  const send = (message: OcrResponse) => scope.postMessage(message);
  scope.onmessage = async ({ data }: MessageEvent<OcrRequest>) => {
    try {
      const started = performance.now();
      const reused = !!reader;
      send({ type: 'progress', value: { stage: 'loading' } });
      reader ??= await create(data.assetBase, value => send({ type: 'progress', value }));
      const ready = performance.now();
      send({ type: 'progress', value: { stage: 'recognizing' } });
      const text = await reader.recognize(data);
      send({ type: 'result', value: {
        text: text.trim(), initializationMs: ready - started,
        recognitionMs: performance.now() - ready, reused,
      } });
    } catch (error) {
      console.error('Local OCR failed:', error instanceof Error ? error.message : String(error));
      send({ type: 'error', message: 'This reader could not process the photo. Try a clearer image or choose the other reader.' });
    }
  };
}
