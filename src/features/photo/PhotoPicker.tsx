import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import styles from './photo.module.css';

export function PhotoPicker({ dropdown = false, disabled, onSelect }: {
  dropdown?: boolean; disabled: boolean; onSelect: (file: File, trigger: HTMLElement) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const id = useId();

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const anchor = trigger.current!.getBoundingClientRect();
      const bounds = panel.current!.getBoundingClientRect();
      setPosition({ left: Math.max(8, Math.min(anchor.right - bounds.width, innerWidth - bounds.width - 8)),
        top: anchor.bottom + 8 + bounds.height <= innerHeight - 8 ? anchor.bottom + 8 : Math.max(8, anchor.top - bounds.height - 8) });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function outside(event: Event) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault(); setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  function closePicker() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const element = root.current!;
    element.addEventListener('cancel', closePicker, true);
    return () => element.removeEventListener('cancel', closePicker, true);
  }, []);

  return <div ref={root} className={dropdown ? styles.newPhoto : styles.pickers}>
    {dropdown && <button ref={trigger} type="button" className={styles.secondary} disabled={disabled}
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      New photo <span aria-hidden="true">▾</span>
    </button>}
    <div ref={panel} id={id} className={dropdown ? styles.pickerDropdown : styles.pickerChoices}
      style={dropdown ? position : undefined} hidden={dropdown && !open}>
      {[{ label: 'Take a photo', capture: true }, { label: 'Choose an image', capture: false }].map(choice =>
        <label className={styles.picker} key={choice.label}>
          <span>{choice.label}</span>
          <input type="file" accept="image/*" capture={choice.capture ? 'environment' : undefined}
            aria-label={choice.label} disabled={disabled} onClick={event => { event.currentTarget.value = ''; }}
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              const origin = trigger.current ?? event.currentTarget;
              event.currentTarget.value = '';
              closePicker();
              if (file) onSelect(file, origin);
            }} />
        </label>)}
    </div>
  </div>;
}
