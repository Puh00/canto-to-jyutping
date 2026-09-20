import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const target = path.join(root, 'public/ocr');
const lockPath = path.join(root, 'scripts/ocr-assets.json');
const lock = JSON.parse(await readFile(lockPath, 'utf8'));
const digest = data => createHash('sha256').update(data).digest('hex');
const record = process.argv.includes('--record');
for (const asset of lock.assets) {
  const destination = path.join(target, asset.path);
  await mkdir(path.dirname(destination), { recursive: true });
  let bytes;
  try { bytes = await readFile(destination); } catch {}
  if (!bytes || (asset.sha256 && digest(bytes) !== asset.sha256)) {
    console.log('Downloading ' + asset.path);
    const response = await fetch(asset.url, { signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw new Error(asset.url + ': HTTP ' + response.status);
    bytes = Buffer.from(await response.arrayBuffer());
    if (asset.sha256 && digest(bytes) !== asset.sha256) throw new Error('Checksum mismatch: ' + asset.path);
    if (!asset.sha256 && !record) throw new Error('Unpinned asset: ' + asset.path);
    await writeFile(destination, bytes);
  }
  if (record) { asset.sha256 = digest(bytes); asset.bytes = bytes.length; }
  console.log(asset.path + ': ' + bytes.length + ' bytes');
}
if (record) await writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n');
const copies = [
  ['node_modules/onnxruntime-web/dist', 'ort', name => /^ort-wasm-simd-threaded\.jsep\.(wasm|mjs)$/.test(name)],
];
const inventory = lock.assets.map(asset => ({ path: asset.path, bytes: asset.bytes, sha256: asset.sha256 }));
for (const [source, folder, include] of copies) {
  await mkdir(path.join(target, folder), { recursive: true });
  for (const name of await readdir(path.join(root, source))) {
    if (!include(name)) continue;
    const destination = path.join(target, folder, name);
    await copyFile(path.join(root, source, name), destination);
    inventory.push({path: folder + '/' + name, bytes: (await stat(destination)).size});
  }
}
await writeFile(path.join(target, 'asset-sizes.json'), JSON.stringify(inventory, null, 2) + '\n');
