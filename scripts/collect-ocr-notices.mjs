import { readFile, readdir, writeFile } from 'node:fs/promises';
const upstream = [
  ['PaddleOCR-APACHE.txt','https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/e5046169b225bcdfbe25d45b4e809ff0f1a69c2c/LICENSE'],
  ['ONNX-MIT.txt','https://raw.githubusercontent.com/microsoft/onnxruntime/v1.30.0/LICENSE'],
  ['ONNX-third-party.txt','https://raw.githubusercontent.com/microsoft/onnxruntime/v1.30.0/ThirdPartyNotices.txt'],
  ['Boost.txt','https://www.boost.org/LICENSE_1_0.txt'],
];
const upstreamNotices = [];
for (const [name,url] of upstream) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url + ': ' + response.status);
  upstreamNotices.push([name, await response.text()]);
}
let notices = (await readFile('public/notices.txt','utf8')).split(/\nOCR (?:TRIAL )?DEPENDENCIES\n/)[0];
notices += '\nOCR DEPENDENCIES\n\n';
notices += 'PaddleOCR.js 0.4.2 and unmodified PP-OCRv5_mobile_det/rec ONNX archives, developed by PaddlePaddle. Model cards: https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det and https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_rec. Model cards identify Apache-2.0 licensing.\n\n';
for (const pkg of ['@techstark/opencv-js','js-yaml','argparse','flatbuffers','guid-typescript','long','platform','protobufjs']) {
  const folder = 'node_modules/' + pkg;
  const names = await readdir(folder);
  const license = names.find(name => /^licen[cs]e(?:\.|$)/i.test(name));
  if (license) notices += pkg + '\n' + await readFile(folder + '/' + license,'utf8') + '\n\n';
}
for (const [name, license] of upstreamNotices) notices += name + '\n' + license + '\n\n';
const clipper = await readFile('node_modules/clipper-lib/clipper.js','utf8');
notices += 'clipper-lib\n' + clipper.match(/^(?:\/\*[\s\S]*?\*\/\s*)+/)?.[0] + '\n\n';
notices = notices.trimEnd() + '\n';
await writeFile('public/notices.txt', notices);
console.log('Updated OCR notices: ' + Buffer.byteLength(notices) + ' bytes');
