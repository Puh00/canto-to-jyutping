import { createWorker, OEM } from 'tesseract.js';
import { serveRecognizer } from './worker-runner';

serveRecognizer(async (assetBase, progress) => {
  const worker = await createWorker(['chi_tra', 'eng'], OEM.LSTM_ONLY, {
    workerPath: new URL('tesseract/worker.min.js', assetBase).href,
    corePath: new URL('tesseract/', assetBase).href,
    langPath: new URL('tesseract/', assetBase).href,
    workerBlobURL: false,
    cachePath: 'canto-fast-806cd9a',
    logger: message => progress({
      stage: message.status === 'recognizing text' ? 'recognizing' : 'loading',
      progress: message.progress,
    }),
  });
  return { async recognize({ blob }) { return (await worker.recognize(blob)).data.text; } };
});
