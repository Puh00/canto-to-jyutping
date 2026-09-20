export type OcrEngine = 'tesseract' | 'paddle';
export type OcrProgress = { stage: 'loading' | 'recognizing'; progress?: number };
export type OcrResult = {
  text: string;
  initializationMs: number;
  recognitionMs: number;
  reused: boolean;
};
export type OcrRequest = { image: ImageData; blob: Blob; engine: OcrEngine; assetBase: string };
export type OcrResponse =
  | { type: 'progress'; value: OcrProgress }
  | { type: 'result'; value: OcrResult }
  | { type: 'error'; message: string };
