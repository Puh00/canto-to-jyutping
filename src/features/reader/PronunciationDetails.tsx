import { useEffect, useId, useRef } from 'react';
import type { usePlayback } from '../../audio/usePlayback';
import { PlaybackIcon } from '../../audio/PlaybackIcon';
import type { Annotation } from '../../pronunciation/types';
import styles from './reader.module.css';

export function PronunciationDetails({ token, onClose, playback }: { token: Annotation; onClose: () => void; playback: ReturnType<typeof usePlayback> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  function readingButton(reading: string) {
    const playing = playback.activeStart === token.start && playback.activeReading === reading;
    const available = playback.canPlayReading(reading);
    return <button type="button" className={styles.readingAudio} disabled={!available}
      data-audio-playing={playing || undefined} aria-label={`${reading}. ${available ? 'Play pronunciation' : 'Audio unavailable'}`}
      onClick={() => playback.playReading(token.start, reading)}>
      <span lang="yue-Latn">{reading}</span>{available ? <PlaybackIcon kind="play" /> : <span aria-hidden="true"> · Audio unavailable</span>}
    </button>;
  }

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = document.activeElement;
    dialog.showModal();
    closeButtonRef.current?.focus();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key === 'Tab') {
          const buttons = Array.from(dialogRef.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}
    >
      <div className={styles.dialogHeader}>
        <h2 id={titleId}>Readings for <span lang="zh-Hant">{token.text}</span></h2>
        <button ref={closeButtonRef} type="button" onClick={onClose} className={styles.closeDialog} aria-label="Close pronunciation details">×</button>
      </div>
      {token.reading ? <>
        <p className={styles.detailLabel}>SUGGESTED IN THIS TEXT</p>
        <div className={styles.chosenReading}>{readingButton(token.reading)}</div>
        <p className={styles.detailLabel}>OTHER POSSIBLE READINGS</p>
        <ul className={styles.alternativeList}>
          {token.alternatives.map(reading => <li key={reading}>{readingButton(reading)}</li>)}
        </ul>
        <p id={descriptionId} className={styles.dialogNote}>These readings may belong to other words or contexts. Listening to them doesn’t change your text.</p>
      </> : <div className={styles.missingDetail}>
        <p className={styles.largeCharacter} lang="zh-Hant">{token.text}</p>
        <p>No pronunciation found.</p>
        <p id={descriptionId} className={styles.dialogNote}>This character isn’t covered by the current dictionary. We’ve kept it in your text.</p>
      </div>}
      <p role="status" className={styles.dialogNote}>{playback.status === 'loading' ? 'Loading audio…' : ''}</p>
      {playback.error && <p role="alert">{playback.error}</p>}
    </dialog>
  );
}

