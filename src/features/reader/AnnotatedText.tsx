import type { Annotation } from '../../pronunciation/types';
import styles from './reader.module.css';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

type Props = {
  tokens: readonly Annotation[];
  onInspect: (token: Annotation) => void;
  activeStart?: number | null;
  onPlay: (start: number, reading: string) => void;
  canPlayReading: (reading: string | null) => boolean;
  occlusionRef?: RefObject<HTMLElement | null>;
};

export function AnnotatedText({ tokens, onInspect, activeStart = null, occlusionRef, onPlay, canPlayReading }: Props) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeStart === null) return;
    const frame = requestAnimationFrame(() => {
      const element = container.current?.querySelector<HTMLElement>('[data-playing="true"]');
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const obstacle = occlusionRef?.current?.getBoundingClientRect();
      const top = obstacle && obstacle.left < rect.right && obstacle.right > rect.left && obstacle.bottom > 0
        ? Math.min(obstacle.bottom + 12, window.innerHeight - rect.height - 12) : 12;
      if (rect.top < top) window.scrollBy({ top: rect.top - top, behavior: 'instant' });
      else if (rect.bottom > window.innerHeight - 12) window.scrollBy({ top: rect.bottom - window.innerHeight + 12, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeStart, occlusionRef]);
  // Adjacent unannotated text stays together, including emoji sequences and spacing.
  const runs: (Annotation | string)[] = [];
  for (const token of tokens) {
    if (token.kind === 'text') {
      const last = runs[runs.length - 1];
      if (typeof last === 'string') runs[runs.length - 1] = last + token.text;
      else runs.push(token.text);
    } else runs.push(token);
  }

  return <div ref={container} className={styles.annotations} lang="zh-Hant">
    {runs.map((run, index) => {
      if (typeof run === 'string') return <span key={`text-${index}`} className={styles.plain}>{run}</span>;
      const inspectable = run.reading === null || run.alternatives.length > 0;
      const playing = run.start === activeStart;
      const playable = canPlayReading(run.reading);
      return <span key={run.start} className={`${styles.token} ${playing ? styles.playing : ''}`}
        data-playing={playing || undefined} aria-current={playing ? 'true' : undefined}>
        <button type="button" className={styles.characterButton} disabled={!playable}
          aria-label={playable ? `${run.text}, ${run.reading}. Play pronunciation` : `${run.text}. Audio unavailable`}
          title={playable ? 'Play pronunciation' : 'Audio unavailable'}
          onClick={() => { if (run.reading) onPlay(run.start, run.reading); }}>
          <span className={styles.character}>{run.text}</span>
        </button>
        {inspectable ? <button type="button"
          className={`${styles.reading} ${styles.readingButton} ${run.reading === null ? styles.missing : ''}`}
          lang="yue-Latn" onClick={event => { event.currentTarget.focus({ preventScroll: true }); onInspect(run); }} aria-haspopup="dialog"
          aria-label={run.reading ? `${run.text}, ${run.reading}. View other readings` : `${run.text}. No pronunciation found`}>
          {run.reading ?? '?'}
        </button> : <span className={styles.reading} lang="yue-Latn">{run.reading}</span>}
      </span>;
    })}
  </div>;
}
