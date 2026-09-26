import { useEffect, useMemo, useRef, useState } from 'react';
import type { FocusEvent, ReactNode } from 'react';
import type { PhotoCrop } from '../../ocr/highlight-bounds';
import type { HighlightStroke, OpenedImage } from '../../ocr/prepare-image';
import { annotate } from '../../pronunciation/annotate';
import type { Annotation } from '../../pronunciation/types';
import { AnnotatedText } from '../reader/AnnotatedText';
import { PronunciationDetails } from '../reader/PronunciationDetails';
import styles from './photo.module.css';
import { HighlightStrokes } from './HighlightStrokes';

type Props = { text: string; image: OpenedImage; crop: PhotoCrop; strokes: readonly HighlightStroke[];
  onEdit: (trigger: HTMLButtonElement) => void; disabled: boolean; actions: ReactNode; notice: ReactNode };

export function PhotoReading({ text, image, crop, strokes, onEdit, disabled, actions, notice }: Props) {
  const tokens = useMemo(() => annotate(text), [text]);
  const [selected, setSelected] = useState<Annotation | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const preview = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start' });
  }, []);

  function revealFocusedReading(event: FocusEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest('dialog')) return;
    // Native focus scrolling does not account for a sticky sibling covering a token.
    requestAnimationFrame(() => {
      if (!preview.current || document.activeElement !== target) return;
      const photo = preview.current.getBoundingClientRect();
      const token = target.getBoundingClientRect();
      if (token.left < photo.right && token.right > photo.left && token.top < photo.bottom + 12) {
        window.scrollBy({ top: token.top - photo.bottom - 12, behavior: 'instant' });
      }
    });
  }

  return <section className={styles.reading} aria-labelledby="photo-reading-title">
    <div className={styles.photoHeader}>
      <h2 ref={heading} tabIndex={-1} id="photo-reading-title">Photo reading</h2>
      {actions}
    </div>
    {notice}
    <div className={styles.comparison}>
      <button ref={preview} type="button" className={styles.sourcePhoto} aria-label="Edit highlights in photo" disabled={disabled}
        onClick={event => onEdit(event.currentTarget)}>
        <svg className={styles.sourceImage} viewBox={`${crop.left} ${crop.top} ${crop.width} ${crop.height}`}
          width={crop.width} height={crop.height} role="img" aria-label="Photo used for this reading">
          <rect x={crop.left} y={crop.top} width={crop.width} height={crop.height} fill="#fff" />
          <image href={image.previewUrl} width={image.originalWidth} height={image.originalHeight} />
          <HighlightStrokes strokes={strokes} width={image.originalWidth} height={image.originalHeight} />
        </svg>
        <span className={styles.sourceLabel}>Edit highlights</span>
      </button>
      <div className={styles.transcription} onFocusCapture={revealFocusedReading}>
        <AnnotatedText tokens={tokens} onInspect={setSelected} />
        {tokens.some(token => token.kind === 'han' && token.alternatives.length > 0) && <p className={styles.hint}>Tap an underlined reading to see alternatives.</p>}
        {selected && <PronunciationDetails token={selected} onClose={() => setSelected(null)} />}
        <p className={styles.hint}>Suggested readings may be incorrect.</p>
      </div>
    </div>
  </section>;
}
