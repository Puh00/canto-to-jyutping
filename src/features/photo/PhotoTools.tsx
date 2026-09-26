import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import styles from './highlighter.module.css';

type Props = {
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  canUndo: boolean;
  onUndo: () => void;
  disabled: boolean;
};

export function PhotoTools({ brushSize, onBrushSizeChange, canUndo, onUndo, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const sliderId = useId();
  const visible = open && !disabled;

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  useLayoutEffect(() => {
    if (!visible) return;
    function placePanel() {
      const anchor = trigger.current!.getBoundingClientRect();
      const bounds = panel.current!.getBoundingClientRect();
      const below = anchor.bottom + 8;
      setPosition({
        left: Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8)),
        top: below + bounds.height <= window.innerHeight - 8 ? below : Math.max(8, anchor.top - bounds.height - 8),
      });
    }
    slider.current?.focus({ preventScroll: true });
    placePanel();
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', placePanel, true);
    return () => {
      window.removeEventListener('resize', placePanel);
      window.removeEventListener('scroll', placePanel, true);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    function dismissOutside(event: Event) {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !panel.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    }
    document.addEventListener('pointerdown', dismissOutside, true);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', escape);
    };
  }, [visible]);

  return <div className={styles.photoTools}>
    <button ref={trigger} type="button" className={styles.toolButton} aria-label="Brush size"
      title="Brush size" aria-expanded={visible} aria-controls={panelId} disabled={disabled}
      onPointerDown={event => event.preventDefault()}
      onClick={() => { setOpen(value => !value); if (visible) trigger.current?.focus({ preventScroll: true }); }}>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m14 6 4 4M9 15l-1-3L18 2l4 4-10 10-3-1Z" />
        <path d="M8 15c-5-1-2 6-6 6 5 2 9-1 8-4" />
      </svg>
    </button>
    {canUndo && <button type="button" className={styles.toolButton} aria-label="Undo highlight"
      title="Undo highlight" disabled={disabled} onClick={onUndo}>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
      </svg>
    </button>}
    <div ref={panel} id={panelId} className={styles.brushPanel} hidden={!visible} style={position}>
      <label htmlFor={sliderId}>Brush size</label>
      <div className={styles.brushAdjustment}>
        <input ref={slider} id={sliderId} type="range" min="4" max="30" value={brushSize} disabled={disabled}
          onChange={event => onBrushSizeChange(Number(event.target.value))} />
        <span className={styles.brushPreview} aria-hidden="true"><span style={{ width: brushSize, height: brushSize }} /></span>
      </div>
    </div>
  </div>;
}
