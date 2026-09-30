import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const allowed = new Set(['index.html', 'favicon.svg', 'notices.txt', 'audio-permission.txt', 'assets', 'ocr', 'audio']);
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
for (const name of ['notices.txt', 'audio-permission.txt']) {
  assert.equal(digest(await readFile(path.join(dist, name))),
    digest(await readFile(path.join(root, 'public', name))), name + ' publication checksum');
}
const audioPermission = await readFile(path.join(root, 'public/audio-permission.txt'), 'utf8');
assert((await readFile(path.join(dist, 'notices.txt'), 'utf8')).includes(audioPermission.trim()),
  'Published notices must retain the audio permission');
const audioLock = JSON.parse(await readFile(path.join(root, 'scripts/audio-assets.json'), 'utf8'));
const audioDirectory = path.join(dist, audioLock.directory);
const syllables = JSON.parse(await readFile(path.join(root, 'src/audio/syllables.json'), 'utf8'));
assert.equal(audioLock.assets.length, syllables.length, 'One recording per supported syllable');
assert.deepEqual(new Set(audioLock.assets.map(asset => asset.path)),
  new Set(syllables.map(reading => reading + '.mp3')), 'Recording inventory matches supported syllables');
assert.deepEqual(new Set(await readdir(audioDirectory)),
  new Set([...audioLock.assets.map(asset => asset.path), 'NOTICE.txt']), 'Only recordings and their notice are published');
assert.equal(await readFile(path.join(audioDirectory, 'NOTICE.txt'), 'utf8'), audioPermission,
  'The permission notice accompanies the recordings');
for (const asset of audioLock.assets) {
  assert(/^[a-z]+[1-6]\.mp3$/.test(asset.path), 'Invalid recording filename');
  const bytes = await readFile(path.join(audioDirectory, asset.path));
  assert.equal(bytes.length, asset.bytes, asset.path + ' size');
  assert.equal(digest(bytes), asset.sha256, asset.path + ' original recording checksum');
}
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
console.log('Verified Pages artifact: ' + totalBytes + ' bytes, including ' + audioLock.assets.length + ' original recordings, notices, pinned OCR models and WASM runtime.');
