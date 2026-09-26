# Canto

Read Cantonese written in traditional characters. Paste text to see Jyutping beneath each character, or choose a photo and highlight the words you want to read. Tap a character to see other pronunciations. Suggested readings may be wrong.

Photo recognition runs in your browser. The first scan downloads the OCR models.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the local URL shown in the terminal.

## Build and test

```sh
npm test
npm run build
```

## Libraries and licenses

* [ToJyutping](https://github.com/CanCLID/to-jyutping) adds Cantonese pronunciations.
* [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) reads text in photos.
* The app also uses React and ONNX Runtime Web.

Third-party license terms are in [notices.txt](public/notices.txt).