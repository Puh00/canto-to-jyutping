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

function PhotoReading({ text }: { text: string }) {
  const tokens = useMemo(() => annotate(text), [text]);
  const [selected, setSelected] = useState<Annotation | null>(null);
  return <section className={styles.reading} aria-labelledby="photo-reading-title">
    <h2 id="photo-reading-title">Photo reading</h2>
    <AnnotatedText tokens={tokens} onInspect={setSelected} />
    {tokens.some(token => token.kind === 'han' && token.alternatives.length > 0) && <p className={styles.hint}>Tap an underlined reading to see alternatives.</p>}
    <p className={styles.hint}>If the characters look wrong, adjust the area or choose another photo.</p>
    {selected && <PronunciationDetails token={selected} onClose={() => setSelected(null)} />}
    <p className={styles.hint}>Suggested readings may be incorrect.</p>
  </section>;
}

export default function PhotoReader() {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<OcrProgress>({ stage: 'loading' });
  const [image, setImage] = useState<OpenedImage | null>(null);
  const [strokes, setStrokes] = useState<HighlightStroke[]>([]);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState('');
  const session = useRef<ReturnType<typeof createOcrSession> | null>(null);
  const generation = useRef(0);
  const source = useRef<OpenedImage | null>(null);
  const busy = status === 'preparing' || status === 'reading';

  useEffect(() => () => {
    generation.current++;
    session.current?.dispose();
    source.current?.dispose();
  }, []);

  function clearResult() { setResult(null); setError(''); }
  function clearPhoto() {
    source.current?.dispose(); source.current = null;
    setImage(null); setStrokes([]); clearResult();
  }
  function resetPhoto() {
    generation.current++;
    if (busy) { session.current?.dispose(); session.current = null; }
    clearPhoto(); setStatus('idle');
  }
  async function selectPhoto(file?: File) {
    if (!file) return;
    const id = ++generation.current;
    clearPhoto(); setStatus('preparing');
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
  function changeHighlights(value: HighlightStroke[]) {
    if (busy) return;
    setStrokes(value); clearResult(); setStatus('selecting');
  }
  async function readRegion(whole = false) {
    if (!image || busy) return;
    const id = ++generation.current;
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
      setResult(recognized);
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
      <h2 id="photo-title">Choose a photo, then highlight the text.</h2>
      <div className={styles.pickers}>
        {[{ label: 'Take a photo', capture: true }, { label: 'Choose an image', capture: false }].map(choice =>
          <label className={styles.picker} key={choice.label}>
            <span>{choice.label}</span>
            <input type="file" accept="image/*" capture={choice.capture ? 'environment' : undefined}
              aria-label={choice.label} disabled={busy} onClick={event => { event.currentTarget.value = ''; }}
              onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void selectPhoto(file); }} />
          </label>)}
        {image && <button className={styles.secondary} type="button" onClick={resetPhoto}>Clear photo</button>}
        {busy && <button className={styles.secondary} type="button" onClick={cancel}>Cancel reading</button>}
      </div>
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
  </div>;
}
