import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { HighlightStroke, ImagePoint, OpenedImage } from '../../ocr/prepare-image';
import { clampPhotoZoom, MAX_PHOTO_ZOOM, MIN_PHOTO_ZOOM, usePhotoViewport } from './usePhotoViewport';
import type { ClientPoint, PhotoView, ViewportPoint } from './usePhotoViewport';
import styles from './highlighter.module.css';

type Props = { image: OpenedImage; strokes: HighlightStroke[]; disabled: boolean; onChange: (strokes: HighlightStroke[]) => void };
type BrushGesture = { id: number | 'keyboard'; previous: HighlightStroke[]; stroke: HighlightStroke };
type PinchGesture = { distance: number; scale: number; anchor: ImagePoint };
type PanGesture = { id: number; start: ViewportPoint; view: PhotoView };
const clientPoint = (event: PointerEvent): ClientPoint => ({ clientX: event.clientX, clientY: event.clientY });

export function PhotoHighlighter({ image, strokes, disabled, onChange }: Props) {
  const [brushSize, setBrushSize] = useState(12);
  const [mode, setMode] = useState<'brush' | 'move'>('brush');
  const [cursor, setCursor] = useState<ImagePoint>({ x: .5, y: .5 });
  const [showCursor, setShowCursor] = useState(false);
  const [draft, setDraft] = useState<HighlightStroke | null>(null);
  const viewport = usePhotoViewport(disabled);
  const { stage, view, imagePoint, viewportPoint, zoomAt, place } = viewport;
  const drag = useRef<BrushGesture | null>(null);
  const touches = useRef(new Map<number, ClientPoint>());
  const pinch = useRef<PinchGesture | null>(null);
  const pan = useRef<PanGesture | null>(null);
  const waitForLift = useRef(false);

  function begin(id: number | 'keyboard', point: ImagePoint, previous = strokes) {
    const stroke = { points: [point], width: brushSize / 100 / view.scale };
    drag.current = { id, previous, stroke };
    setDraft(stroke);
  }
  function extend(point: ImagePoint) {
    const active = drag.current;
    if (!active) return;
    active.stroke = { ...active.stroke, points: [...active.stroke.points, point] };
    setDraft(active.stroke);
  }
  function finishBrush(canceled = false) {
    const active = drag.current;
    const committed = active && !canceled ? [...active.previous, active.stroke] : strokes;
    if (active && !canceled) onChange(committed);
    drag.current = null; setDraft(null);
    return committed;
  }
  function touchPair() {
    const [first, second] = [...touches.current.values()];
    if (!first || !second) return null;
    return { distance: Math.max(1, Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)),
      middle: { clientX: (first.clientX + second.clientX) / 2, clientY: (first.clientY + second.clientY) / 2 } };
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    viewport.pointerActive.current = true; setShowCursor(false);
    const previous = drag.current?.id === 'keyboard' ? finishBrush() : strokes;
    if (event.pointerType === 'touch') {
      touches.current.set(event.pointerId, clientPoint(event));
      if (touches.current.size >= 2) {
        finishBrush(true); pan.current = null; waitForLift.current = true;
        const pair = touchPair()!;
        pinch.current = { distance: pair.distance, scale: viewport.viewRef.current.scale, anchor: imagePoint(pair.middle) };
        return;
      }
      if (waitForLift.current) return;
    } else if (!event.isPrimary) return;
    if (mode === 'move') {
      pan.current = { id: event.pointerId, start: viewportPoint(clientPoint(event)), view: viewport.viewRef.current };
    } else begin(event.pointerId, imagePoint(clientPoint(event)), previous);
  }
  function move(event: PointerEvent) {
    if (touches.current.has(event.pointerId)) touches.current.set(event.pointerId, clientPoint(event));
    if (pinch.current) {
      const pair = touchPair();
      if (pair) {
        const scale = clampPhotoZoom(pinch.current.scale * pair.distance / pinch.current.distance);
        const middle = viewportPoint(pair.middle);
        place({ scale, x: middle.x - pinch.current.anchor.x * scale, y: middle.y - pinch.current.anchor.y * scale });
      }
      return;
    }
    if (waitForLift.current) return;
    if (pan.current?.id === event.pointerId) {
      const point = viewportPoint(clientPoint(event)), active = pan.current;
      place({ ...active.view, x: active.view.x + point.x - active.start.x, y: active.view.y + point.y - active.start.y });
    } else if (drag.current?.id === event.pointerId) extend(imagePoint(clientPoint(event)));
  }
  function finish(event: PointerEvent, canceled = false) {
    if (drag.current?.id === event.pointerId) finishBrush(canceled);
    if (pan.current?.id === event.pointerId) pan.current = null;
    touches.current.delete(event.pointerId);
    if (touches.current.size < 2) pinch.current = null;
    if (!touches.current.size) {
      waitForLift.current = false;
      viewport.pointerActive.current = false;
    }
  }
  function cursorInView(): ImagePoint {
    const { scale, x, y } = viewport.viewRef.current;
    const screen = { x: cursor.x * scale + x, y: cursor.y * scale + y };
    if (screen.x >= 0 && screen.x <= 1 && screen.y >= 0 && screen.y <= 1) return cursor;
    return { x: (.5 - x) / scale, y: (.5 - y) / scale };
  }
  function keyDown(event: KeyboardEvent) {
    if (disabled) return;
    const directions: Record<string, ImagePoint> = {
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      const step = event.shiftKey ? .08 : .02;
      if (mode === 'move') {
        place({ ...view, x: view.x + direction.x * step, y: view.y + direction.y * step });
        return;
      }
      setShowCursor(true);
      const origin = cursorInView();
      if (origin !== cursor && drag.current?.id === 'keyboard') finishBrush();
      const next = {
        x: Math.max(-view.x / view.scale, Math.min((1 - view.x) / view.scale, origin.x + direction.x * step / view.scale)),
        y: Math.max(-view.y / view.scale, Math.min((1 - view.y) / view.scale, origin.y + direction.y * step / view.scale)),
      };
      setCursor(next);
      if (drag.current?.id === 'keyboard') extend(next);
    } else if (event.key === ' ' && mode === 'brush') {
      event.preventDefault(); setShowCursor(true);
      if (event.repeat) return;
      if (drag.current?.id === 'keyboard') finishBrush();
      else { const point = cursorInView(); setCursor(point); begin('keyboard', point); }
    } else if (event.key === 'Escape' || event.key === 'Enter') {
      event.preventDefault(); finishBrush(event.key === 'Escape');
    }
  }
  const visibleStrokes = draft ? [...strokes, draft] : strokes;
  return <figure className={styles.selector}>
    <figcaption>Brush over whole characters. Pinch with two fingers or use the wheel to zoom.</figcaption>
    <div className={styles.tools}>
      <label>Brush size <input type="range" min="4" max="30" value={brushSize} disabled={disabled}
        onChange={event => setBrushSize(Number(event.target.value))} /></label>
      <button type="button" disabled={disabled || !strokes.length} onClick={() => onChange(strokes.slice(0, -1))}>Undo highlight</button>
      <button type="button" disabled={disabled || !strokes.length} onClick={() => onChange([])}>Clear highlights</button>
    </div>
    <div className={styles.tools} aria-label="Photo zoom controls">
      <button type="button" disabled={disabled || view.scale <= MIN_PHOTO_ZOOM} onClick={() => zoomAt(view.scale / 1.5)}>Zoom out</button>
      <output aria-label="Photo zoom">{Math.round(view.scale * 100)}%</output>
      <button type="button" disabled={disabled || view.scale >= MAX_PHOTO_ZOOM} onClick={() => zoomAt(view.scale * 1.5)}>Zoom in</button>
      <button type="button" disabled={disabled || view.scale === MIN_PHOTO_ZOOM} onClick={() => zoomAt(MIN_PHOTO_ZOOM)}>Reset zoom</button>
    </div>
    <div className={styles.tools} aria-label="Photo interaction">
      <button type="button" disabled={disabled} aria-pressed={mode === 'brush'} onClick={() => setMode('brush')}>Brush</button>
      <button type="button" disabled={disabled} aria-pressed={mode === 'move'} onClick={() => setMode('move')}>Move photo</button>
      <span>Two fingers always move the photo.</span>
    </div>
    <div ref={stage} className={styles.stage} style={{ maxWidth: 520 * image.originalWidth / image.originalHeight,
      cursor: mode === 'move' ? 'grab' : 'crosshair' }}
      role="group" aria-label="Highlight text in photo" aria-describedby="highlight-keyboard-help" aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0} onKeyDown={keyDown}
      onFocus={() => setCursor(cursorInView())}
      onBlur={() => { if (drag.current?.id === 'keyboard') finishBrush(); setShowCursor(false); }}
      onPointerDown={start} onPointerMove={move} onPointerUp={finish}
      onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}>
      <div className={styles.imageLayer} style={{ transform: `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.scale})` }}>
        <img src={image.previewUrl} alt="Selected photo prepared for reading" draggable={false} />
        <svg className={styles.overlay} viewBox={'0 0 ' + image.originalWidth + ' ' + image.originalHeight} aria-hidden="true">
          <g opacity=".38" fill="#e7aa18" stroke="#e7aa18" strokeLinecap="round" strokeLinejoin="round">
            {visibleStrokes.map((stroke, index) => <g key={index}>
              <path fill="none" strokeWidth={stroke.width * image.originalWidth}
                d={stroke.points.map((point, i) => (i ? 'L' : 'M') + point.x * image.originalWidth + ' ' + point.y * image.originalHeight).join(' ')} />
              {stroke.points[0] && <circle stroke="none" cx={stroke.points[0].x * image.originalWidth}
                cy={stroke.points[0].y * image.originalHeight} r={stroke.width * image.originalWidth / 2} />}
            </g>)}
          </g>
          {showCursor && <circle cx={cursor.x * image.originalWidth} cy={cursor.y * image.originalHeight}
            r={brushSize / 200 / view.scale * image.originalWidth} fill="none" stroke="#172921" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
        </svg>
      </div>
    </div>
    <p id="highlight-keyboard-help" className={styles.keyboardHelp}>Keyboard: arrows move the brush or photo. In Brush mode, Space starts or stops highlighting; Escape cancels it.</p>
  </figure>;
}
