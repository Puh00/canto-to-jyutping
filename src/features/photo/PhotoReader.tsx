import { useEffect, useMemo, useRef, useState } from 'react';
import { createOcrSession } from '../../ocr/session';
import { openImage } from '../../ocr/prepare-image';
import type { HighlightStroke, OpenedImage } from '../../ocr/prepare-image';
import type { OcrProgress, OcrResult } from '../../ocr/types';
import { annotate } from '../../pronunciation/annotate';
import type { Annotation } from '../../pronunciation/types';
import { AnnotatedText } from '../reader/AnnotatedText';
import { PronunciationDetails } from '../reader/PronunciationDetails';
import { PhotoHighlighter } from './PhotoHighlighter';
import styles from './photo.module.css';

type Status = 'idle' | 'preparing' | 'selecting' | 'reading' | 'done' | 'error' | 'canceled';
const seconds = (milliseconds: number) => (milliseconds / 1000).toFixed(1);

function PhotoReading({ text }: { text: string }) {
  const tokens = useMemo(() => annotate(text), [text]);
  const [selected, setSelected] = useState<Annotation | null>(null);
  return <section className={styles.reading} aria-labelledby="photo-reading-title">
    <h2 id="photo-reading-title">Photo reading</h2>
    <AnnotatedText tokens={tokens} onInspect={setSelected} />
    <p className={styles.hint}>Tap an underlined reading to see alternatives. If the characters look wrong, adjust the area or choose another photo.</p>
    {selected && <PronunciationDetails token={selected} onClose={() => setSelected(null)} />}
    <p className={styles.hint}>Some characters have multiple readings. Suggested pronunciations may be incorrect.</p>
  </section>;
}

export default function PhotoReader() {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<OcrProgress>({ stage: 'loading' });
  const [image, setImage] = useState<OpenedImage | null>(null);
  const [strokes, setStrokes] = useState<HighlightStroke[]>([]);
  const [result, setResult] = useState<(OcrResult & { readyMs: number; width: number; height: number }) | null>(null);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [usableMs, setUsableMs] = useState<number | null>(null);
  const [includesPhotoSelection, setIncludesPhotoSelection] = useState(true);
  const session = useRef<ReturnType<typeof createOcrSession> | null>(null);
  const generation = useRef(0);
  const source = useRef<OpenedImage | null>(null);
  const startedAt = useRef<number | null>(null);
  const pickerOpenedAt = useRef<number | null>(null);
  const scanned = useRef(false);
  const busy = status === 'preparing' || status === 'reading';

  useEffect(() => () => {
    generation.current++;
    session.current?.dispose();
    source.current?.dispose();
  }, []);

  function clearResult() { setResult(null); setUsableMs(null); setError(''); }
  function clearPhoto() {
    source.current?.dispose(); source.current = null;
    setImage(null); setStrokes([]); scanned.current = false; clearResult();
  }
  function startNewTrial() {
    generation.current++;
    if (busy) { session.current?.dispose(); session.current = null; }
    clearPhoto(); startedAt.current = null; pickerOpenedAt.current = null; setAttempts(0); setIncludesPhotoSelection(true); setStatus('idle');
  }
  function openPicker(event: React.MouseEvent<HTMLInputElement>) {
    event.currentTarget.value = '';
    pickerOpenedAt.current = performance.now();
  }
  async function selectPhoto(file?: File) {
    if (!file) return;
    const id = ++generation.current;
    const newTrial = usableMs !== null || startedAt.current === null;
    if (newTrial) startedAt.current = pickerOpenedAt.current ?? performance.now();
    pickerOpenedAt.current = null;
    setIncludesPhotoSelection(true);
    clearPhoto(); setAttempts(value => newTrial ? 1 : value + 1); setStatus('preparing');
    try {
      const opened = await openImage(file);
      if (id !== generation.current) { opened.dispose(); return; }
      source.current = opened; setImage(opened); setStatus('selecting');
    } catch (failure) {
      if (id !== generation.current) return;
      setError(failure instanceof Error ? failure.message : 'The photo could not be opened. Try another image.');
      setStatus('error');
    }
  }
  function beginAfterAcceptedReading() {
    if (usableMs === null) return;
    startedAt.current = performance.now(); setAttempts(1); scanned.current = false; setIncludesPhotoSelection(false);
  }
  function changeHighlights(value: HighlightStroke[]) {
    if (busy) return;
    beginAfterAcceptedReading();
    setStrokes(value); clearResult(); setStatus('selecting');
  }
  async function readRegion(whole = false) {
    if (!image || busy) return;
    const id = ++generation.current;
    beginAfterAcceptedReading();
    if (scanned.current) setAttempts(value => value + 1);
    scanned.current = true;
    clearResult(); setStatus('reading'); setProgress({ stage: 'loading' });
    try {
      const prepared = await image.prepare(whole ? undefined : strokes);
      if (id !== generation.current) return;
      session.current ??= createOcrSession();
      const recognized = await session.current.recognize(prepared.pixels, value => {
        if (id === generation.current) setProgress(value);
      });
      if (id !== generation.current) return;
      if (!recognized.text) throw new Error('No text was found. Adjust the area or try a clearer photo.');
      setResult({ ...recognized, readyMs: performance.now() - startedAt.current!,
        width: prepared.pixels.width, height: prepared.pixels.height });
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
    : status === 'selecting' ? 'Highlight the text, then tap Read highlighted text.'
    : status === 'reading' ? progress.stage === 'loading' ? 'Preparing the photo reader. First use downloads its files…' : 'Reading the characters…'
    : status === 'canceled' ? 'Reading canceled. You can adjust the area or choose another photo.'
    : status === 'done' ? 'Your photo reading is ready.' : '';

  return <div className={styles.photo}>
    <section className={styles.controls} aria-labelledby="photo-title">
      <div className={styles.heading}><span className={styles.badge}>PHOTO READER</span><h2 id="photo-title">Read the Cantonese around you.</h2></div>
      <p>Take a photo, then brush over the text you want to read.</p>
      <div className={styles.pickers}>
        {[{ label: 'Take a photo', capture: true }, { label: 'Choose an image', capture: false }].map(choice =>
          <label className={styles.picker} key={choice.label}>
            <span>{choice.label}</span>
            <input type="file" accept="image/*" capture={choice.capture ? 'environment' : undefined}
              aria-label={choice.label} disabled={busy} onClick={openPicker}
              ref={node => { if (node) node.oncancel = () => { pickerOpenedAt.current = null; }; }}
              onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void selectPhoto(file); }} />
          </label>)}
        {busy && <button className={styles.secondary} type="button" onClick={cancel}>Cancel reading</button>}
      </div>
      <p className={styles.hint}>Photos are processed on your device. Initial downloads can take a while; later scans reuse the loaded reader.</p>
      <p role="status" className={styles.status}>{statusText}</p>
      {status === 'reading' && <progress aria-label="Photo recognition progress" />}
      {!image && error && <p role="alert" className={styles.error}>{error}</p>}
    </section>
    {image && <section className={styles.controls} aria-label="Select text area">
      <PhotoHighlighter key={image.previewUrl} image={image} strokes={strokes} disabled={busy} onChange={changeHighlights} />
      <div className={styles.areaActions}>
        <button className={styles.accept} type="button" disabled={busy || !strokes.length} onClick={() => void readRegion()}>Read highlighted text</button>
        <button className={styles.secondary} type="button" disabled={busy} onClick={() => void readRegion(true)}>Read whole image</button>
      </div>
    </section>}
    {result && <PhotoReading key={result.text} text={result.text} />}
    {image && error && <section className={styles.reading} aria-labelledby="photo-error-title">
      <h2 id="photo-error-title">Photo reading</h2>
      <p role="alert" className={styles.error}>{error}</p>
    </section>}
    {(result || attempts > 0) && <section className={styles.trial} aria-label="Photo trial timing">
      {result && <><p>Reading ready after <strong>{seconds(result.readyMs)} seconds</strong>{includesPhotoSelection
        ? ', including photo selection and highlighting.' : ', using the photo already open. Photo selection is excluded.'} {Math.max(0, attempts - 1)} retries.</p>
        {usableMs === null ? <button className={styles.accept} type="button" onClick={() => setUsableMs(performance.now() - startedAt.current!)}>This reading is usable</button>
          : <p role="status">Usable after <strong>{seconds(usableMs)} seconds</strong>. Compare this with your usual workflow.</p>}
        <details><summary>Scan details</summary><dl>
          <dt>Reader</dt><dd>PaddleOCR 0.4.2, PP-OCRv5 mobile, WASM</dd>
          <dt>Preparation of reader</dt><dd>{seconds(result.initializationMs)} seconds{result.reused ? ', already loaded' : ', newly initialized'}</dd>
          <dt>Recognition</dt><dd>{seconds(result.recognitionMs)} seconds</dd>
          <dt>Selected image</dt><dd>{image?.format}, {image?.originalWidth} × {image?.originalHeight}</dd>
          <dt>Pixels read from selected area</dt><dd>{result.width} × {result.height}</dd>
        </dl><p>Times stay in this page only. A fresh page may still use cached model files. A wrong or unreadable result is a failed trial.</p></details></>}
      <button className={styles.secondary} type="button" onClick={startNewTrial}>Start a new trial</button>
    </section>}
  </div>;
}
