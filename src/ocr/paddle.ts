import { PaddleOCR } from '@paddleocr/paddleocr-js';
import cvModule from '@techstark/opencv-js';

export async function createPaddleReader(assetBase: string) {
  const ocr = await PaddleOCR.create({
    worker: false,
    textDetectionModelName: 'PP-OCRv5_mobile_det',
    textRecognitionModelName: 'PP-OCRv5_mobile_rec',
    textDetectionModelAsset: { url: new URL('paddle/PP-OCRv5_mobile_det.tar', assetBase).href },
    textRecognitionModelAsset: { url: new URL('paddle/PP-OCRv5_mobile_rec.tar', assetBase).href },
    textDetectionBatchSize: 1,
    textRecognitionBatchSize: 1,
    textDetLimitType: 'max',
    textDetLimitSideLen: 1600,
    ortOptions: { backend: 'wasm', numThreads: 1, proxy: false, wasmPaths: new URL('ort/', assetBase).href },
  });
  // The initialized OpenCV export is thenable. Static import avoids dynamic-import assimilation.
  const cv = cvModule instanceof Promise ? await cvModule : cvModule;
  return {
    async recognize(image: ImageData) {
      const mat = new cv.Mat(image.height, image.width, cv.CV_8UC4);
      try {
        mat.data.set(image.data);
        const [result] = await ocr.predict(mat);
        return result?.items.map(item => item.text).join('\n') ?? '';
      } finally { mat.delete(); }
    },
  };
}

