# Cantonese Reader

Cantonese Reader helps people who speak Cantonese but find traditional Chinese characters hard to read. It is a mobile-friendly, static website for reading pasted text or words selected from a photo. The app shows Jyutping beneath the original characters. Menus and signs are the main use cases. See [README.md](README.md) for the user-facing description.

## Code map

- React, TypeScript, Vite and CSS Modules make up the site. GitHub Pages publishes the `dist/` build through [.github/workflows/pages.yml](.github/workflows/pages.yml).
- `src/pronunciation/` calls ToJyutping on the whole input so word context can affect readings. `src/features/reader/` displays and inspects those readings.
- `src/features/photo/` owns photo selection, highlighting and the reading flow. `src/ocr/` runs PaddleOCR in the browser. OCR models and the ONNX runtime are prepared by `scripts/prepare-ocr.mjs`; generated `public/ocr/` assets are ignored by Git.

## Preserve these behaviors

- Keep the entered or recognized wording intact. Attach each Jyutping reading to its original character, including Unicode variation selectors and combining marks. Preserve punctuation, English, prices and line breaks. Show uncertainty or missing readings rather than inventing them.
- Convert whole text for context, then align results to source positions. OCR errors and pronunciation errors are separate problems; inspect the right stage before changing either one.
- Keep photo recognition and pronunciation conversion in the browser. Highlighted-photo recognition reads only painted areas, with an explicit whole-image action. Discuss any backend or image upload with the user before adding it.
- Preserve [public/notices.txt](public/notices.txt) in the published site when changing dependencies or assets.

## Check and ship changes

- Use Node.js 24, npm and the committed lockfile. Run the relevant tests in `package.json`, including `npm test` and `npm run build` for code changes; use targeted Playwright tests for affected browser interactions. The build prepares the OCR assets.
- Check mobile layout and touch behavior when changing photo or reader UI. Playwright's mobile WebKit emulation is useful evidence, but report physical iPhone behavior only after a real-device check.
- GitHub Pages deploys on pushes to `main`. For deployment changes, verify the repository subpath and that the built site contains its OCR models, WASM runtime and notices.
- `.gitignore` keeps local planning notes, research and chat exports out of the repository. Keep them local and stage only files intended for publication. `AGENTS.md` is the public guidance for a fresh clone.
