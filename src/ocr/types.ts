export type OcrProgress = { stage: 'loading' | 'recognizing' };
export type OcrResult = {
  text: string;
  initializationMs: number;
  recognitionMs: number;
  reused: boolean;
};
export type OcrRequest = { image: ImageData; assetBase: string };
export type OcrResponse =
  | { type: 'progress'; value: OcrProgress }
  | { type: 'result'; value: OcrResult }
  | { type: 'error'; message: string };
