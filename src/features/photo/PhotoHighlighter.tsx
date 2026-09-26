import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { HighlightStroke, ImagePoint, OpenedImage } from '../../ocr/prepare-image';
import { clampPhotoZoom, MIN_PHOTO_ZOOM, usePhotoViewport } from './usePhotoViewport';
import type { ClientPoint, PhotoView, ViewportPoint } from './usePhotoViewport';
import styles from './highlighter.module.css';
import { PhotoTools } from './PhotoTools';
import { HighlightStrokes } from './HighlightStrokes';

type Props = { image: OpenedImage; strokes: HighlightStroke[]; disabled: boolean; active: boolean; onChange: (strokes: HighlightStroke[]) => void };
type BrushGesture = { id: number | 'keyboard'; previous: HighlightStroke[]; stroke: HighlightStroke };
type PinchGesture = { distance: number; scale: number; anchor: ImagePoint };
type PanGesture = { id: number; start: ViewportPoint; view: PhotoView };
const clientPoint = (event: PointerEvent): ClientPoint => ({ clientX: event.clientX, clientY: event.clientY });

export function PhotoHighlighter({ image, strokes, disabled, active, onChange }: Props) {
  const [brushSize, setBrushSize] = useState(12);
  const [isPanning, setIsPanning] = useState(false);
  const [cursor, setCursor] = useState<ImagePoint>({ x: .5, y: .5 });
  const [showCursor, setShowCursor] = useState(false);
  const [draft, setDraft] = useState<HighlightStroke | null>(null);
  const drag = useRef<BrushGesture | null>(null);
  const touches = useRef(new Map<number, ClientPoint>());
  const pinch = useRef<PinchGesture | null>(null);
  const pan = useRef<PanGesture | null>(null);
  const waitForLift = useRef(false);
  const viewport = usePhotoViewport(disabled || !active, image.originalWidth, image.originalHeight, cancelGestures);
  const { stage, view, bounds, imagePoint, viewportPoint, zoomAt, place } = viewport;

  function cancelGestures() {
    drag.current = null; pinch.current = null; pan.current = null;
    touches.current.clear(); waitForLift.current = false;
    viewport.pointerActive.current = false;
    setDraft(null); setIsPanning(false); setShowCursor(false);
  }
  useEffect(() => {
    if (!active || disabled) cancelGestures();
  }, [active, disabled]);

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
    if (disabled || !active || (event.button !== 0 && !(event.pointerType === 'mouse' && event.button === 1))) return;
    if (event.pointerType !== 'touch' && !event.isPrimary) return;
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
    }
    if (event.pointerType === 'mouse' && event.button === 1) {
      pan.current = { id: event.pointerId, start: viewportPoint(clientPoint(event)), view: viewport.viewRef.current };
      setIsPanning(true);
    } else if (viewport.contains(clientPoint(event))) begin(event.pointerId, imagePoint(clientPoint(event)), previous);
  }
  function move(event: PointerEvent) {
    if (touches.current.has(event.pointerId)) touches.current.set(event.pointerId, clientPoint(event));
    if (pinch.current) {
      const pair = touchPair();
      if (pair) {
        const scale = clampPhotoZoom(pinch.current.scale * pair.distance / pinch.current.distance);
        const middle = viewportPoint(pair.middle);
        place({ scale, x: middle.x - pinch.current.anchor.x * bounds.imageWidth / bounds.width * scale,
          y: middle.y - pinch.current.anchor.y * bounds.imageHeight / bounds.height * scale });
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
    if (pan.current?.id === event.pointerId) { pan.current = null; setIsPanning(false); }
    touches.current.delete(event.pointerId);
    if (touches.current.size < 2) pinch.current = null;
    if (!touches.current.size) {
      waitForLift.current = false;
      viewport.pointerActive.current = false;
    }
  }
  function cursorInView(): ImagePoint {
    const screen = viewport.imageToViewport(cursor);
    if (screen.x >= 0 && screen.x <= 1 && screen.y >= 0 && screen.y <= 1) return cursor;
    return viewport.pointInImage({ x: .5, y: .5 });
  }
  function keyDown(event: KeyboardEvent) {
    if (disabled || !active || event.ctrlKey || event.metaKey || event.altKey) return;
    if (['+', '=', '-', '0'].includes(event.key)) {
      event.preventDefault();
      if (viewport.pointerActive.current) return;
      if (drag.current?.id === 'keyboard') finishBrush();
      setShowCursor(false);
      const scale = viewport.viewRef.current.scale;
      zoomAt(event.key === '0' ? MIN_PHOTO_ZOOM : event.key === '-' ? scale / 1.5 : scale * 1.5);
      return;
    }
    const directions: Record<string, ImagePoint> = {
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      if (event.shiftKey) {
        if (drag.current?.id === 'keyboard') finishBrush();
        setShowCursor(false);
        place({ ...view, x: view.x + direction.x * .08, y: view.y + direction.y * .08 });
        return;
      }
      const step = .02;
      setShowCursor(true);
      const origin = cursorInView();
      if (origin !== cursor && drag.current?.id === 'keyboard') finishBrush();
      const first = viewport.pointInImage({ x: 0, y: 0 });
      const last = viewport.pointInImage({ x: 1, y: 1 });
      const next = { x: Math.max(first.x, Math.min(last.x, origin.x + direction.x * step / view.scale)),
        y: Math.max(first.y, Math.min(last.y, origin.y + direction.y * step / view.scale)) };
      setCursor(next);
      if (drag.current?.id === 'keyboard') extend(next);
    } else if (event.key === ' ') {
      event.preventDefault(); setShowCursor(true);
      if (event.repeat) return;
      if (drag.current?.id === 'keyboard') finishBrush();
      else { const point = cursorInView(); setCursor(point); begin('keyboard', point); }
    } else if ((event.key === 'Escape' || event.key === 'Enter') && drag.current?.id === 'keyboard') {
      event.preventDefault(); event.stopPropagation(); finishBrush(event.key === 'Escape');
    }
  }
  const visibleStrokes = draft ? [...strokes, draft] : strokes;
  return <figure className={styles.selector}>
    <PhotoTools brushSize={brushSize} onBrushSizeChange={setBrushSize} canUndo={strokes.length > 0}
      onUndo={() => onChange(strokes.slice(0, -1))} disabled={disabled || !active} />
    <output className={styles.zoom} aria-label="Photo zoom">{Math.round(view.scale * 100)}%</output>
    <div ref={stage} className={styles.stage} style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
      role="group" aria-label="Highlight text in photo" aria-describedby="highlight-keyboard-help" aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0} onKeyDown={keyDown}
      onFocus={() => setCursor(cursorInView())}
      onBlur={() => { if (drag.current?.id === 'keyboard') finishBrush(); setShowCursor(false); }}
      onPointerDown={start} onPointerMove={move} onPointerUp={finish}
      onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}
      onAuxClick={event => { if (event.button === 1) event.preventDefault(); }}>
      <div className={styles.imageLayer} style={{ width: bounds.imageWidth, height: bounds.imageHeight,
        transform: `translate(${view.x * bounds.width}px, ${view.y * bounds.height}px) scale(${view.scale})` }}>
        <img src={image.previewUrl} alt="Selected photo prepared for reading" draggable={false} />
        <svg className={styles.overlay} viewBox={'0 0 ' + image.originalWidth + ' ' + image.originalHeight} aria-hidden="true">
          <HighlightStrokes strokes={visibleStrokes} width={image.originalWidth} height={image.originalHeight} />
          {showCursor && <circle cx={cursor.x * image.originalWidth} cy={cursor.y * image.originalHeight}
            r={brushSize / 200 / view.scale * image.originalWidth} fill="none" stroke="#172921" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
        </svg>
      </div>
    </div>
    <p className={styles.keyboardHelp} id="highlight-keyboard-help">Keyboard: + and − zoom, 0 resets the view, arrows move the brush, and Shift plus arrows move the photo. Space starts or stops highlighting; Escape cancels it.</p>
  </figure>;
}
