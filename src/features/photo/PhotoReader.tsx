import { useEffect, useMemo, useRef, useState } from 'react';
import { createOcrSession } from '../../ocr/session';
import { prepareImage } from '../../ocr/prepare-image';
import type { PreparedImage } from '../../ocr/prepare-image';
import type { OcrEngine, OcrProgress, OcrResult } from '../../ocr/types';
import { annotate } from '../../pronunciation/annotate';
import type { Annotation } from '../../pronunciation/types';
import { AnnotatedText } from '../reader/AnnotatedText';
import { PronunciationDetails } from '../reader/PronunciationDetails';
import styles from './photo.module.css';

type Status = 'idle' | 'preparing' | 'reading' | 'done' | 'error' | 'canceled';
const seconds = (milliseconds: number) => (milliseconds / 1000).toFixed(1);

function PhotoReading({ text }: { text: string }) {
  const tokens = useMemo(() => annotate(text), [text]);
  const [selected, setSelected] = useState<Annotation | null>(null);
  return <section className={styles.reading} aria-labelledby="photo-reading-title">
    <h2 id="photo-reading-title">Photo reading</h2>
    <AnnotatedText tokens={tokens} onInspect={setSelected} />
    <p className={styles.hint}>Tap an underlined reading to see alternatives. If the characters look wrong, retake or replace the photo.</p>
    {selected && <PronunciationDetails token={selected} onClose={() => setSelected(null)} />}
    <p className={styles.hint}>Some characters have multiple readings. Suggested pronunciations may be incorrect.</p>
  </section>;
}

export default function PhotoReader() {
  const [engine, setEngine] = useState<OcrEngine>('tesseract');
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<OcrProgress>({ stage: 'loading' });
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [result, setResult] = useState<(OcrResult & { readyMs: number }) | null>(null);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [usableMs, setUsableMs] = useState<number | null>(null);
  const session = useRef<ReturnType<typeof createOcrSession> | null>(null);
  const generation = useRef(0);
  const preview = useRef<string | null>(null);
  const startedAt = useRef<number | null>(null);
  const busy = status === 'preparing' || status === 'reading';

  useEffect(() => () => {
    generation.current++;
    session.current?.dispose();
    if (preview.current) URL.revokeObjectURL(preview.current);
  }, []);

  function clearPhoto() {
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = null;
    setImage(null); setResult(null); setUsableMs(null); setError('');
  }
  function startNewTrial() {
    generation.current++;
    if (busy) { session.current?.dispose(); session.current = null; }
    clearPhoto(); startedAt.current = null; setAttempts(0); setStatus('idle');
  }
  function changeEngine(value: OcrEngine) {
    session.current?.dispose(); session.current = null;
    startNewTrial(); setEngine(value);
  }
  function openPicker(event: React.MouseEvent<HTMLInputElement>) {
    event.currentTarget.value = '';
    if (usableMs !== null) { startedAt.current = null; setAttempts(0); setUsableMs(null); }
    startedAt.current ??= performance.now();
  }
  async function readPhoto(file?: File) {
    if (!file) return;
    const id = ++generation.current;
    startedAt.current ??= performance.now();
    clearPhoto(); setAttempts(value => value + 1); setStatus('preparing');
    try {
      const prepared = await prepareImage(file);
      if (id !== generation.current) { URL.revokeObjectURL(prepared.previewUrl); return; }
      preview.current = prepared.previewUrl; setImage(prepared);
      setStatus('reading'); setProgress({ stage: 'loading' });
      session.current ??= createOcrSession(engine);
      const recognized = await session.current.recognize(prepared.pixels, prepared.blob, value => {
        if (id === generation.current) setProgress(value);
      });
      if (id !== generation.current) return;
      if (!recognized.text) throw new Error('No text was found. Try a closer, sharper photo of a small menu section or sign.');
      setResult({ ...recognized, readyMs: performance.now() - startedAt.current! });
      setStatus('done');
    } catch (failure) {
      if (id !== generation.current) return;
      session.current?.dispose(); session.current = null;
      setError(failure instanceof Error ? failure.message : 'The photo could not be read. Try another image.');
      setStatus('error');
    }
  }
  function cancel() {
    generation.current++;
    session.current?.dispose(); session.current = null;
    setStatus('canceled'); setError('');
  }
  const statusText = status === 'preparing' ? 'Opening your photo…'
    : status === 'reading' ? progress.stage === 'loading' ? 'Preparing the photo reader. First use downloads its files…' : 'Reading the characters…'
    : status === 'canceled' ? 'Reading canceled. You can choose another photo.'
    : status === 'done' ? 'Your photo reading is ready.' : '';

  return <div className={styles.photo}>
    <section className={styles.controls} aria-labelledby="photo-title">
      <div className={styles.heading}><span className={styles.badge}>PHOTO TRIAL</span><h2 id="photo-title">Read the Cantonese around you.</h2></div>
      <p>Start with a small menu section or a short sign. Keep the text clear and upright.</p>
      <div className={styles.pickers}>
        {[{ label: 'Take a photo', capture: true }, { label: 'Choose an image', capture: false }].map(choice =>
          <label className={styles.picker} key={choice.label}>
            <span>{choice.label}</span>
            <input type="file" accept="image/*" capture={choice.capture ? 'environment' : undefined}
              aria-label={choice.label} disabled={busy} onClick={openPicker}
              ref={node => { if (node) node.oncancel = () => { if (!image && attempts === 0) startedAt.current = null; }; }}
              onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void readPhoto(file); }} />
          </label>)}
        {busy && <button className={styles.secondary} type="button" onClick={cancel}>Cancel reading</button>}
      </div>
      <div className={styles.engine}>
        <label htmlFor="ocr-engine">Reader to try</label>
        <select id="ocr-engine" value={engine} disabled={busy} onChange={event => changeEngine(event.target.value as OcrEngine)}>
          <option value="tesseract">Tesseract</option><option value="paddle">PaddleOCR</option>
        </select>
        <span>We are comparing these on your phone. Neither is the final choice.</span>
      </div>
      <p className={styles.hint}>Photos are processed on your device. Initial downloads can take a while; later scans reuse the loaded reader.</p>
      <p role="status" className={styles.status}>{statusText}</p>
      {status === 'reading' && <progress aria-label="Photo recognition progress" max={1}
        value={progress.stage === 'recognizing' ? progress.progress : undefined} />}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>
    {image && <figure className={styles.preview}><img src={image.previewUrl} alt="Selected photo prepared for reading" /><figcaption>Your photo. Retake or replace it if the text is unclear.</figcaption></figure>}
    {result && <PhotoReading key={result.text} text={result.text} />}
    {(result || attempts > 0) && <section className={styles.trial} aria-label="Photo trial timing">
      {result && <><p>Reading ready after <strong>{seconds(result.readyMs)} seconds</strong>, including photo selection and {Math.max(0, attempts - 1)} retakes.</p>
        {usableMs === null ? <button className={styles.accept} type="button" onClick={() => setUsableMs(performance.now() - startedAt.current!)}>This reading is usable</button>
          : <p role="status">Usable after <strong>{seconds(usableMs)} seconds</strong>. Compare this with your usual workflow.</p>}
        <details><summary>Scan details</summary><dl>
          <dt>Reader</dt><dd>{engine === 'tesseract' ? 'Tesseract 7, fast Traditional Chinese + English' : 'PaddleOCR 0.4.2, PP-OCRv5 mobile, WASM'}</dd>
          <dt>Preparation of reader</dt><dd>{seconds(result.initializationMs)} seconds{result.reused ? ', already loaded' : ', newly initialized'}</dd>
          <dt>Recognition</dt><dd>{seconds(result.recognitionMs)} seconds</dd>
          <dt>Selected image</dt><dd>{image?.format}, {image?.originalWidth} × {image?.originalHeight}</dd>
          <dt>Pixels used by both readers</dt><dd>{image?.pixels.width} × {image?.pixels.height}</dd>
        </dl><p>Times stay in this page only. A fresh page may still use cached model files. A wrong or unreadable result is a failed trial.</p></details></>}
      <button className={styles.secondary} type="button" onClick={startNewTrial}>Start a new trial</button>
    </section>}
  </div>;
}
