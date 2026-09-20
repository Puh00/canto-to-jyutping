import type { OcrEngine, OcrProgress, OcrResponse, OcrResult } from './types';

export function createOcrSession(engine: OcrEngine) {
  const worker = engine === 'tesseract'
    ? new Worker(new URL('./tesseract.worker.ts', import.meta.url), { type: 'module' })
    : new Worker(new URL('./paddle.worker.ts', import.meta.url), { type: 'module' });
  let pending: { resolve: (result: OcrResult) => void; reject: (error: Error) => void; progress: (value: OcrProgress) => void } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  function dispose() {
    disposed = true;
    worker.terminate();
    clearTimeout(timer);
    pending?.reject(new DOMException('Reading canceled.', 'AbortError'));
    pending = null;
  }
  function fail(message: string) {
    pending?.reject(new Error(message));
    pending = null;
    dispose();
  }
  worker.onerror = event => { event.preventDefault(); fail('The photo reader could not start. Try again or choose the other reader.'); };
  worker.onmessage = ({ data }: MessageEvent<OcrResponse>) => {
    if (!pending) return;
    if (data.type === 'progress') pending.progress(data.value);
    else if (data.type === 'error') fail(data.message);
    else {
      clearTimeout(timer);
      pending.resolve(data.value);
      pending = null;
    }
  };
  return {
    recognize(image: ImageData, blob: Blob, progress: (value: OcrProgress) => void): Promise<OcrResult> {
      if (disposed) return Promise.reject(new Error('This photo reader has stopped. Choose the image again.'));
      if (pending) return Promise.reject(new Error('A photo is already being read.'));
      return new Promise((resolve, reject) => {
        pending = { resolve, reject, progress };
        timer = setTimeout(() => fail('Reading took too long. Try a smaller, clearer photo or the other reader.'), 180_000);
        worker.postMessage({ image, blob, engine, assetBase: new URL(import.meta.env.BASE_URL + 'ocr/', window.location.href).href });
      });
    },
    dispose,
  };
}
