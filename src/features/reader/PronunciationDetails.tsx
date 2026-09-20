import { useEffect, useId, useRef } from 'react';
import type { Annotation } from '../../pronunciation/types';
import styles from './reader.module.css';

export function PronunciationDetails({ token, onClose }: { token: Annotation; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

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
        // This dialog has one control; keep both Tab directions on it.
        if (event.key === 'Tab') { event.preventDefault(); closeButtonRef.current?.focus(); }
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
        <p className={styles.chosenReading} lang="yue-Latn">{token.reading}</p>
        <p className={styles.detailLabel}>OTHER POSSIBLE READINGS</p>
        <ul className={styles.alternativeList}>
          {token.alternatives.map(reading => <li key={reading} lang="yue-Latn">{reading}</li>)}
        </ul>
        <p id={descriptionId} className={styles.dialogNote}>These readings may belong to other words or contexts. Viewing them doesn’t change your text.</p>
      </> : <div className={styles.missingDetail}>
        <p className={styles.largeCharacter} lang="zh-Hant">{token.text}</p>
        <p>No pronunciation found.</p>
        <p id={descriptionId} className={styles.dialogNote}>This character isn’t covered by the current dictionary. We’ve kept it in your text.</p>
      </div>}
    </dialog>
  );
}

