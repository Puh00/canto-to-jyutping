import http from 'node:http';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const previewBase = process.argv[2] ?? 'http://127.0.0.1:4173';
const results = [];

for (const entry of await readdir('test-results', { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.endsWith('-chromium')) continue;
  let record;
  try {
    record = JSON.parse(await readFile('test-results/' + entry.name + '/network.json', 'utf8'));
  } catch {
    continue;
  }
  const paths = [...new Set(record.responses
    .filter(response => response.url.startsWith('http'))
    .map(response => new URL(response.url).pathname))];
  const assets = [];
  for (const pathname of paths) {
    const asset = await new Promise((resolve, reject) => {
      http.get(new URL(pathname, previewBase), { headers: { 'accept-encoding': 'gzip' } }, response => {
        let bytes = 0;
        response.on('data', chunk => { bytes += chunk.length; });
        response.on('error', reject);
        response.on('end', () => resolve({
          path: pathname,
          bytes,
          encoding: response.headers['content-encoding'] ?? 'identity',
          status: response.statusCode,
        }));
      }).on('error', reject);
    });
    if (asset.status !== 200) throw new Error(JSON.stringify(asset));
    assets.push(asset);
  }
  results.push({
    engine: record.engine,
    method: 'Measured HTTP response bodies from local Vite preview, Accept-Encoding gzip; excludes headers and local blob URLs.',
    assets,
    totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
  });
}

if (!['tesseract', 'paddle'].every(engine => results.some(result => result.engine === engine))) {
  throw new Error('Run the complete photo browser tests before measuring both engines.');
}
await writeFile('docs/validation/ocr-asset-transfer.json', JSON.stringify(results, null, 2) + '\n');
console.log(results.map(({ engine, totalBytes }) => ({ engine, totalBytes })));
