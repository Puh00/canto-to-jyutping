# Cantonese Reader

Read Cantonese written in traditional characters. Paste text to see Jyutping beneath each character, or choose a photo and highlight the words you want to read. Tap a character to see other pronunciations. Suggested readings may be wrong.

Use the app at [puh00.github.io/canto-to-jyutping](https://puh00.github.io/canto-to-jyutping/).

Photo recognition runs in your browser. The first scan downloads the OCR models.

Choose **Read aloud** to hear the displayed Jyutping one character at a time, with the current character highlighted. Pause, resume, or stop playback in either reading mode. Characters without available audio are skipped; English text and numbers are not spoken.

Tap a character to hear its suggested pronunciation. Tap an underlined Jyutping reading to open alternatives, then tap a reading to compare its sound without changing the text. A character tap stops any full-text sequence; Read aloud restarts from the beginning.

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

Project code is licensed under [MIT](LICENSE). Third-party license terms are in [notices.txt](public/notices.txt).

### Audio permission and attribution

Audio recordings are by **林璃蝶 / Indicum Lam**, provided by [Words.hk](https://words.hk/) and used with permission for **non-commercial use only**.

The recordings are **excluded from this project's MIT license** and cannot be
licensed or sublicensed under an open-source license. See the
[audio permission notice](public/audio-permission.txt) for the terms received.
This project does not grant additional rights to the recordings; contact Words.hk
for permission for uses beyond the original grant.
