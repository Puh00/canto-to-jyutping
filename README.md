# Canto

Read Cantonese written in traditional characters. Paste text to see Jyutping beneath each character, or choose a photo and highlight the words you want to read. Tap a character to see other pronunciations. Suggested readings may be wrong.

Use the app at [puh00.github.io/canto-to-jyutping](https://puh00.github.io/canto-to-jyutping/).

Photo recognition runs in your browser. The first scan downloads the OCR models.

Choose **Read aloud** to hear the displayed Jyutping one character at a time, with the current character highlighted. Pause, resume, or stop playback in either reading mode. Characters without a matching recording are skipped; English text and numbers are not spoken.

Audio is fetched on demand from the [words.hk app's syllable recordings](https://github.com/AlienKevin/wordshk_app/tree/1571375f5daceab45d0393ac5a1a72b6a47067c0/assets/jyutping_female). Playback requires a connection for uncached clips. Text conversion remains on-device; audio requests disclose the requested syllable filenames to the hosting service. Clips are cached in memory for the current reading, not stored persistently by the app.

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
* [words.hk app](https://github.com/AlienKevin/wordshk_app) provides the Cantonese syllable recordings used for audio playback.
* The app also uses React and ONNX Runtime Web.

Third-party license terms are in [notices.txt](public/notices.txt).

Tap a character to hear its suggested pronunciation. Tap an underlined Jyutping reading to open alternatives, then tap a reading to compare its sound without changing the text. A character tap stops any full-text sequence; Read aloud restarts from the beginning.
