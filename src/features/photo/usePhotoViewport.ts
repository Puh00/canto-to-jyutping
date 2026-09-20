import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImagePoint } from '../../ocr/prepare-image';

export type PhotoView = { scale: number; x: number; y: number };

export function usePhotoViewport(disabled: boolean) {
  const stage = useRef<HTMLDivElement>(null);
  const current = useRef<PhotoView>({ scale: 1, x: 0, y: 0 });
  const [view, setView] = useState(current.current);
  const pointerActive = useRef(false);

  const viewportPoint = useCallback((client: ImagePoint): ImagePoint => {
    const bounds = stage.current!.getBoundingClientRect();
    return { x: (client.x - bounds.left) / bounds.width, y: (client.y - bounds.top) / bounds.height };
  }, []);
  const imagePoint = (client: ImagePoint): ImagePoint => {
    const point = viewportPoint(client);
    const view = current.current;
    return { x: Math.max(0, Math.min(1, (point.x - view.x) / view.scale)),
      y: Math.max(0, Math.min(1, (point.y - view.y) / view.scale)) };
  };
  const place = useCallback((requested: PhotoView) => {
    const scale = Math.max(1, Math.min(6, requested.scale));
    const next = { scale, x: Math.max(1 - scale, Math.min(0, requested.x)),
      y: Math.max(1 - scale, Math.min(0, requested.y)) };
    current.current = next; setView(next);
  }, []);
  const zoomAt = useCallback((scale: number, anchor: ImagePoint = { x: .5, y: .5 }) => {
    const previous = current.current;
    scale = Math.max(1, Math.min(6, scale));
    const ratio = scale / previous.scale;
    place({ scale, x: anchor.x - (anchor.x - previous.x) * ratio,
      y: anchor.y - (anchor.y - previous.y) * ratio });
  }, [place]);

  useEffect(() => {
    const element = stage.current!;
    function wheel(event: WheelEvent) {
      if (disabled) return;
      event.preventDefault();
      if (pointerActive.current) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
      const delta = Math.max(-500, Math.min(500, event.deltaY * unit));
      zoomAt(current.current.scale * Math.exp(-delta * .0015), viewportPoint({ x: event.clientX, y: event.clientY }));
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [disabled, viewportPoint, zoomAt]);

  return { stage, view, viewRef: current, pointerActive, imagePoint, viewportPoint, place, zoomAt };
}
