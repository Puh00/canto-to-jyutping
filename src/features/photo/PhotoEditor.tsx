import { useLayoutEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import styles from './photo.module.css';

export function PhotoEditor({ open, onClose, returnFocus, fallbackFocus, children }: {
  open: boolean; onClose: () => void; returnFocus: RefObject<HTMLElement | null>;
  fallbackFocus: RefObject<HTMLElement | null>; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const previousFocus = returnFocus.current ?? document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    close.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      const target = [returnFocus.current, fallbackFocus.current, previousFocus].find(candidate =>
        candidate instanceof HTMLElement && candidate.isConnected && candidate.getClientRects().length > 0);
      if (target instanceof HTMLElement && target.isConnected) target.focus({ preventScroll: true });
    };
  }, [open, returnFocus, fallbackFocus]);

  return <dialog ref={dialog} className={styles.editor} aria-labelledby="photo-editor-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab' || event.defaultPrevented) return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], summary, [tabindex]')]
        .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <header className={styles.editorHeader}>
      <h2 id="photo-editor-title">Highlight the text</h2>
      <button ref={close} className={styles.secondary} type="button" onClick={onClose} aria-label="Close photo editor">Close</button>
    </header>
    {children}
  </dialog>;
}
