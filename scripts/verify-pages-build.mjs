import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const allowed = new Set(['index.html', 'favicon.svg', 'notices.txt', 'assets', 'ocr']);
const entries = await readdir(dist);
assert.deepEqual(new Set(entries), allowed, 'Publish only the built site and public assets');
let totalBytes = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory)) {
    const file = path.join(directory, entry);
    const info = await lstat(file);
    assert(!info.isSymbolicLink(), 'Publication must not contain symlinks: ' + file);
    assert(!entry.startsWith('.') && !entry.endsWith('.map'), 'Unexpected private/source file: ' + file);
    if (info.isDirectory()) await inspect(file);
    else { assert(info.isFile()); totalBytes += info.size; }
  }
}
await inspect(dist);
assert(totalBytes < 1_000_000_000, 'Site exceeds GitHub Pages 1 GB limit');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const lock = JSON.parse(await readFile(path.join(root, 'scripts/ocr-assets.json'), 'utf8'));
for (const asset of lock.assets) {
  const bytes = await readFile(path.join(dist, 'ocr', asset.path));
  assert.equal(bytes.length, asset.bytes, asset.path + ' size');
  assert.equal(digest(bytes), asset.sha256, asset.path + ' checksum');
}
for (const name of ['ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.mjs']) {
  const source = await readFile(path.join(root, 'node_modules/onnxruntime-web/dist', name));
  const published = await readFile(path.join(dist, 'ocr/ort', name));
  assert.equal(digest(published), digest(source), name + ' runtime checksum');
}
console.log('Verified Pages artifact: ' + totalBytes + ' bytes, including pinned OCR models and WASM runtime.');
