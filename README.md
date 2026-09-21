# Canto

Read traditional Chinese in Cantonese. Paste text to see Jyutping beneath each character, or choose a photo and highlight the words to read. Tap a character to view alternative pronunciations. Suggested readings can be wrong.

Photo recognition runs on your device with PaddleOCR. Text and photos are not sent to an application server or saved by the app. The first scan downloads the OCR models; later scans reuse the loaded reader. Guaranteed offline use is not supported.

The sun/moon switch follows your system appearance until you choose a theme, then remembers your choice.

## Run locally

Use Node.js 24 and npm. Verified with Node 24.19.0 and npm 12.0.2.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. No account, API key, or environment variables are required. Development and build commands prepare the checksum-pinned OCR models and WASM runtime automatically.

## Build and test

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
npm run preview
```

Browser tests use the production build and cover desktop Chromium and mobile WebKit. Build before running them.

Deploy the contents of `dist/` to a static HTTPS host. Relative asset paths support deployment beneath a directory. Keep `notices.txt` with the build. A hosting provider has not been selected.

## Photo controls

Brush over the words to recognize, then select **Read highlighted text**. **Read whole image** scans the entire photo. Use pinch or wheel zoom, the Brush/Move toolbar, undo, brush size, and Clear to adjust the selection.

With the photo focused, `+` and `-` zoom, `0` resets, arrow keys move the brush or photo, and Space toggles painting.

## Dependencies and notices

Built with React, TypeScript, Vite, ToJyutping, and PaddleOCR. Third-party notices are in [public/notices.txt](public/notices.txt), with additional license texts in [docs/licenses](docs/licenses/). Preserve these notices when distributing the build. Model URLs and checksums are pinned in [scripts/ocr-assets.json](scripts/ocr-assets.json).
