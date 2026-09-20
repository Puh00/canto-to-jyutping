import { createPaddleReader } from './paddle';
import { serveRecognizer } from './worker-runner';

serveRecognizer(async assetBase => {
  const reader = await createPaddleReader(assetBase);
  return { recognize: ({ image }) => reader.recognize(image) };
});
