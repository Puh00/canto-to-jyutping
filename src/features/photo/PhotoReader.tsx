import { useEffect, useRef, useState } from 'react';
import { createOcrSession } from '../../ocr/session';
import { openImage } from '../../ocr/prepare-image';
import type { HighlightStroke, OpenedImage } from '../../ocr/prepare-image';
import type { OcrProgress, OcrResult } from '../../ocr/types';
import { highlightBounds } from '../../ocr/highlight-bounds';
import type { PhotoCrop } from '../../ocr/highlight-bounds';
import { PhotoHighlighter } from './PhotoHighlighter';
import { PhotoEditor } from './PhotoEditor';
import { PhotoReading } from './PhotoReading';
import { PhotoPicker } from './PhotoPicker';
import styles from './photo.module.css';

type Status = 'idle' | 'preparing' | 'selecting' | 'reading' | 'done' | 'error' | 'canceled';

type PhotoResult = OcrResult & { crop: PhotoCrop; strokes: HighlightStroke[] };

export default function PhotoReader() {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<OcrProgress>({ stage: 'loading' });
  const [image, setImage] = useState<OpenedImage | null>(null);
  const [strokes, setStrokes] = useState<HighlightStroke[]>([]);
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const editorTrigger = useRef<HTMLElement | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const session = useRef<ReturnType<typeof createOcrSession> | null>(null);
  const generation = useRef(0);
  const source = useRef<OpenedImage | null>(null);
  const busy = status === 'preparing' || status === 'reading';

  useEffect(() => () => {
    generation.current++;
    session.current?.dispose();
    source.current?.dispose();
  }, []);

  function clearResult() {
    setResult(null); setError('');
  }
  async function selectPhoto(file: File, trigger: HTMLElement) {
    if (busy) return;
    const id = ++generation.current;
    const previousStatus = status;
    setPhotoError(''); setStatus('preparing');
    try {
      const opened = await openImage(file);
      if (id !== generation.current) { opened.dispose(); return; }
      source.current?.dispose();
      editorTrigger.current = trigger;
      setStrokes([]); clearResult();
      source.current = opened; setImage(opened); setStatus('selecting'); setEditorOpen(true);
    } catch (failure) {
      if (id !== generation.current) return;
      setPhotoError(failure instanceof Error ? failure.message : 'The photo could not be opened. Try another image.');
      setStatus(previousStatus);
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
      const submittedStrokes = whole ? [] : strokes.map(stroke => ({
        ...stroke, points: stroke.points.map(point => ({ ...point })),
      }));
      const selection = whole ? undefined : submittedStrokes;
      const crop = highlightBounds(image.originalWidth, image.originalHeight, selection);
      const prepared = await image.prepare(selection);
      if (id !== generation.current) return;
      session.current ??= createOcrSession();
      const recognized = await session.current.recognize(prepared.pixels, value => {
        if (id === generation.current) setProgress(value);
      });
      if (id !== generation.current) return;
      if (!recognized.text) throw new Error('No text was found. Adjust the area or try a clearer photo.');
      setResult({ ...recognized, crop, strokes: submittedStrokes });
      setStatus('done');
      setEditorOpen(false);
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
  function closeEditor() {
    if (busy) cancel();
    setEditorOpen(false);
  }
  function editPhoto(trigger: HTMLButtonElement) {
    editorTrigger.current = trigger; setEditorOpen(true);
  }
  const statusText = status === 'preparing' ? 'Opening your photo…'
    : status === 'selecting' ? 'Highlight the text, then tap Read highlighted text.'
    : status === 'reading' ? progress.stage === 'loading' ? 'Preparing the photo reader. First use downloads its files…' : 'Reading the characters…'
    : status === 'canceled' ? 'Reading canceled. You can adjust the area or choose another photo.'
    : '';

  const picker = <PhotoPicker dropdown={!!image} disabled={busy} onSelect={(file, trigger) => void selectPhoto(file, trigger)} />;
  const pickerNotice = <>
    <p role="status" aria-hidden={editorOpen} className={styles.status}>{status === 'preparing' ? statusText : ''}</p>
    {photoError && <p role="alert" className={styles.error}>{photoError}</p>}
  </>;

  return <div className={styles.photo}>
    {!result && <section className={styles.controls} aria-labelledby="photo-title">
      {image ? <div className={styles.photoHeader}>
        <h2 id="photo-title">Your photo</h2>
        <div className={styles.photoActions}>
          <button ref={editButton} className={styles.accept} type="button" disabled={busy}
            onClick={event => editPhoto(event.currentTarget)}>Continue editing</button>
          {picker}
        </div>
      </div> : <><h2 id="photo-title">Choose a photo, then highlight the text.</h2>{picker}</>}
      {pickerNotice}
      {error && <p role="alert" aria-hidden={editorOpen} className={styles.error}>{error}</p>}
    </section>}
    {image && <PhotoEditor open={editorOpen} onClose={closeEditor} returnFocus={editorTrigger} fallbackFocus={editButton}>
      <PhotoHighlighter key={image.previewUrl} image={image} strokes={strokes} active={editorOpen} disabled={busy} onChange={changeHighlights} />
      <footer className={styles.editorFooter}>
        <p role="status" className={styles.status}>{statusText}</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {status === 'reading' && <progress aria-label="Photo recognition progress" />}
        <div className={styles.areaActions}>
          <button className={styles.accept} type="button" disabled={busy || !strokes.length} onClick={() => void readRegion()}>Read highlighted text</button>
          <button className={styles.secondary} type="button" disabled={busy} onClick={() => void readRegion(true)}>Read whole image</button>
          {busy && <button className={styles.secondary} type="button" onClick={cancel}>Cancel reading</button>}
        </div>
      </footer>
    </PhotoEditor>}
    {result && image && <PhotoReading key={result.text} text={result.text} image={image} crop={result.crop}
      strokes={result.strokes} onEdit={editPhoto} disabled={busy} actions={picker} notice={pickerNotice} />}
  </div>;
}
