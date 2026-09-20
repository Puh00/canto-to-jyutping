import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { HighlightStroke, ImagePoint, OpenedImage } from '../../ocr/prepare-image';
import styles from './highlighter.module.css';

type Props = { image: OpenedImage; strokes: HighlightStroke[]; disabled: boolean; onChange: (strokes: HighlightStroke[]) => void };

export function PhotoHighlighter({ image, strokes, disabled, onChange }: Props) {
  const [brushSize, setBrushSize] = useState(12);
  const [cursor, setCursor] = useState<ImagePoint>({ x: .5, y: .5 });
  const [showCursor, setShowCursor] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number | 'keyboard'; previous: HighlightStroke[]; stroke: HighlightStroke } | null>(null);
  function point(event: PointerEvent): ImagePoint {
    const bounds = stage.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) };
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setShowCursor(false);
    begin(event.pointerId, point(event));
  }
  function move(event: PointerEvent) {
    const active = drag.current;
    if (!active || event.pointerId !== active.id) return;
    extend(point(event));
  }
  function begin(id: number | 'keyboard', point: ImagePoint) {
    const stroke = { points: [point], width: brushSize / 100 };
    drag.current = { id, previous: strokes, stroke };
    onChange([...strokes, stroke]);
  }
  function extend(point: ImagePoint) {
    const active = drag.current;
    if (!active) return;
    active.stroke = { ...active.stroke, points: [...active.stroke.points, point] };
    onChange([...active.previous, active.stroke]);
  }
  function keyDown(event: KeyboardEvent) {
    if (disabled) return;
    const directions: Record<string, ImagePoint> = {
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault(); setShowCursor(true);
      const step = event.shiftKey ? .08 : .02;
      const next = { x: Math.max(0, Math.min(1, cursor.x + direction.x * step)),
        y: Math.max(0, Math.min(1, cursor.y + direction.y * step)) };
      setCursor(next);
      if (drag.current?.id === 'keyboard') extend(next);
    } else if (event.key === ' ') {
      event.preventDefault(); setShowCursor(true);
      if (event.repeat) return;
      if (drag.current?.id === 'keyboard') drag.current = null;
      else begin('keyboard', cursor);
    } else if (event.key === 'Escape' || event.key === 'Enter') {
      event.preventDefault(); drag.current = null;
    }
  }
  return <figure className={styles.selector}>
    <figcaption>Brush over the words you want to read. Cover each whole character.</figcaption>
    <div className={styles.tools}>
      <label>Brush size <input type="range" min="4" max="30" value={brushSize} disabled={disabled}
        onChange={event => setBrushSize(Number(event.target.value))} /></label>
      <button type="button" disabled={disabled || !strokes.length} onClick={() => onChange(strokes.slice(0, -1))}>Undo highlight</button>
      <button type="button" disabled={disabled || !strokes.length} onClick={() => onChange([])}>Clear highlights</button>
    </div>
    <div ref={stage} className={styles.stage} style={{ maxWidth: 520 * image.originalWidth / image.originalHeight }}
      role="group" aria-label="Highlight text in photo" aria-describedby="highlight-keyboard-help" aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0} onKeyDown={keyDown}
      onBlur={() => { drag.current = null; setShowCursor(false); }}
      onPointerDown={start} onPointerMove={move}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { if (drag.current) onChange(drag.current.previous); drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}>
      <img src={image.previewUrl} alt="Selected photo prepared for reading" draggable={false} />
      <svg className={styles.overlay} viewBox={'0 0 ' + image.originalWidth + ' ' + image.originalHeight} aria-hidden="true">
        <g opacity=".38" fill="#e7aa18" stroke="#e7aa18" strokeLinecap="round" strokeLinejoin="round">
          {strokes.map((stroke, index) => <g key={index}>
            <path fill="none" strokeWidth={stroke.width * image.originalWidth}
              d={stroke.points.map((point, i) => (i ? 'L' : 'M') + point.x * image.originalWidth + ' ' + point.y * image.originalHeight).join(' ')} />
            {stroke.points[0] && <circle stroke="none" cx={stroke.points[0].x * image.originalWidth}
              cy={stroke.points[0].y * image.originalHeight} r={stroke.width * image.originalWidth / 2} />}
          </g>)}
        </g>
        {showCursor && <circle cx={cursor.x * image.originalWidth} cy={cursor.y * image.originalHeight}
          r={brushSize / 200 * image.originalWidth} fill="none" stroke="#172921" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
    <p id="highlight-keyboard-help" className={styles.keyboardHelp}>Keyboard: use arrow keys to move the brush. Space starts or stops highlighting.</p>
  </figure>;
}
