import type { Annotation } from '../../pronunciation/types';
import styles from './reader.module.css';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { selectedSource } from './selection';

type Props = {
  tokens: readonly Annotation[];
  onInspect: (token: Annotation) => void;
  activeStart?: number | null;
  onPlay: (start: number, reading: string) => void;
  canPlayReading: (reading: string | null) => boolean;
  occlusionRef?: RefObject<HTMLElement | null>;
};

/** Render source tokens with selectable text, pronunciation actions, and source-only native copying. */
export function AnnotatedText({ tokens, onInspect, activeStart = null, occlusionRef, onPlay, canPlayReading }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const selecting = useRef(false);
  const source = tokens.map(token => token.text).join('');
  useEffect(() => {
    /** Remember a selection gesture even if the browser collapses it before dispatching click. */
    function rememberSelection() {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && container.current?.contains(selection.anchorNode)) {
        selecting.current = true;
      }
    }
    document.addEventListener('selectionchange', rememberSelection);
    return () => document.removeEventListener('selectionchange', rememberSelection);
  }, []);

  /** Prevent pointer activation when selecting; explicit keyboard activation remains available. */
  function selectionBlocksClick(detail: number): boolean {
    return detail !== 0 && (selecting.current || window.getSelection()?.isCollapsed === false);
  }
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
  const runs: Annotation[] = [];
  for (const token of tokens) {
    if (token.kind === 'text') {
      const last = runs[runs.length - 1];
      if (last?.kind === 'text') runs[runs.length - 1] = { ...last, text: last.text + token.text, end: token.end };
      else runs.push(token);
    } else runs.push(token);
  }

  return <div ref={container} className={styles.annotations} lang="zh-Hant"
    onPointerDown={() => { selecting.current = window.getSelection()?.isCollapsed === false; }}
    onCopy={event => {
      const text = selectedSource(event.currentTarget, source, window.getSelection());
      if (text === null) return;
      event.clipboardData.setData('text/plain', text);
      event.preventDefault();
    }}>
    {runs.map(run => {
      if (run.kind === 'text') return <span key={run.start} data-source-start={run.start} className={styles.plain}>{run.text}</span>;
      const inspectable = run.reading === null || run.alternatives.length > 0;
      const playing = run.start === activeStart;
      const playable = canPlayReading(run.reading);
      return <span key={run.start} className={`${styles.token} ${playing ? styles.playing : ''}`}
        data-playing={playing || undefined} aria-current={playing ? 'true' : undefined}>
        <span role="button" className={styles.characterButton} aria-disabled={!playable} tabIndex={playable ? 0 : undefined}
          aria-label={playable ? `${run.text}, ${run.reading}. Play pronunciation` : `${run.text}. Audio unavailable`}
          title={playable ? 'Play pronunciation' : 'Audio unavailable'}
          onKeyDown={event => {
            if (playable && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              if (!event.repeat && run.reading) onPlay(run.start, run.reading);
            }
          }}
          onClick={event => { if (playable && run.reading && !selectionBlocksClick(event.detail)) onPlay(run.start, run.reading); }}>
          <span className={styles.character} data-source-start={run.start}>{run.text}</span>
        </span>
        {inspectable ? <button type="button"
          className={`${styles.reading} ${styles.readingButton} ${run.reading === null ? styles.missing : ''}`}
          lang="yue-Latn" onClick={event => {
            if (selectionBlocksClick(event.detail)) return;
            event.currentTarget.focus({ preventScroll: true }); onInspect(run);
          }} aria-haspopup="dialog"
          aria-label={run.reading ? `${run.text}, ${run.reading}. View other readings` : `${run.text}. No pronunciation found`}>
          {run.reading ?? '?'}
        </button> : <span className={styles.reading} lang="yue-Latn">{run.reading}</span>}
      </span>;
    })}
  </div>;
}
