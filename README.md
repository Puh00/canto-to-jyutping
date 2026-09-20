# Canto

A static Cantonese reading tool for people who speak the language and want help reading Chinese characters. Paste traditional Chinese or try a photo to see Jyutping beneath each character. Tap an underlined reading to inspect alternatives.

Built with React, TypeScript, Vite, CSS Modules and ToJyutping. The photo reader defaults to official PaddleOCR.js, with Tesseract.js available for comparison. Conversion uses a bundled dictionary on the device. The app has no backend, analytics, account, or stored input. Loading the site initially requires a connection; guaranteed offline loading is deferred.

## Run locally

Use Node.js 24 and npm. This implementation was verified with Node 24.19.0 and npm 12.0.2.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. No environment variables or API keys are needed. The first dev/build run downloads the pinned OCR model files and copies runtime assets into ignored public/ocr/. These are build-time downloads; the browser loads only the engine chosen for a photo.

## Build and verify

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
npm run preview
```

The browser suite serves the production build, so run the build first. It tests desktop Chromium and mobile WebKit with an iPhone 14 Pro viewport. Browser binaries download once per Playwright version. Mobile emulation does not replace a physical iPhone check.

Deploy the contents of `dist/` to a static HTTPS host. Relative asset paths support deployment beneath a directory. Keep `notices.txt` with the build. A hosting provider has not been selected.

## Code layout

- `src/pronunciation/` accepts whole text and returns source spans, contextual readings and alternatives. It has no React, storage or networking dependency. Offsets use JavaScript UTF-16 indexing.
- `src/features/reader/` owns input, rendering and the pronunciation dialog. Editing clears the selected character.
- `src/features/photo/` owns the photo trial, image selection, cancellation and time until the user marks a reading usable.
- `src/ocr/` prepares images and owns separate workers for the two actual OCR candidates. Both process the same prepared pixels.
- `src/styles/` contains shared typography, colors and page styles; reader styles use a CSS Module.
- `tests/fixtures/` records dictionary-sourced examples and accepted variants. Unit tests use the real conversion library.
- `tests/e2e/` checks the built site, including keyboard focus, wrapping and conversion without new network requests.
