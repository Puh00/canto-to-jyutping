import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImagePoint } from '../../ocr/prepare-image';

// Client coordinates are CSS pixels measured from the browser viewport.
export type ClientPoint = { clientX: number; clientY: number };
// Viewport coordinates are fractions of the fitted photo viewport.
export type ViewportPoint = { x: number; y: number };
// Translation uses viewport fractions; image coordinates remain original-image fractions.
export type PhotoView = { scale: number; x: number; y: number };
export const MIN_PHOTO_ZOOM = 1;
export const MAX_PHOTO_ZOOM = 6;
export const clampPhotoZoom = (scale: number) => Math.max(MIN_PHOTO_ZOOM, Math.min(MAX_PHOTO_ZOOM, scale));

export function usePhotoViewport(disabled: boolean) {
  const stage = useRef<HTMLDivElement>(null);
  const current = useRef<PhotoView>({ scale: MIN_PHOTO_ZOOM, x: 0, y: 0 });
  const [view, setView] = useState(current.current);
  const pointerActive = useRef(false);

  const viewportPoint = useCallback((client: ClientPoint): ViewportPoint => {
    const bounds = stage.current!.getBoundingClientRect();
    return { x: (client.clientX - bounds.left) / bounds.width, y: (client.clientY - bounds.top) / bounds.height };
  }, []);
  const imagePoint = (client: ClientPoint): ImagePoint => {
    const point = viewportPoint(client);
    const view = current.current;
    return { x: Math.max(0, Math.min(1, (point.x - view.x) / view.scale)),
      y: Math.max(0, Math.min(1, (point.y - view.y) / view.scale)) };
  };
  const place = useCallback((requested: PhotoView) => {
    const scale = clampPhotoZoom(requested.scale);
    const next = { scale, x: Math.max(1 - scale, Math.min(0, requested.x)),
      y: Math.max(1 - scale, Math.min(0, requested.y)) };
    current.current = next; setView(next);
  }, []);
  const zoomAt = useCallback((scale: number, anchor: ViewportPoint = { x: .5, y: .5 }) => {
    const previous = current.current;
    scale = clampPhotoZoom(scale);
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
      zoomAt(current.current.scale * Math.exp(-delta * .0015), viewportPoint({ clientX: event.clientX, clientY: event.clientY }));
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [disabled, viewportPoint, zoomAt]);

  return { stage, view, viewRef: current, pointerActive, imagePoint, viewportPoint, place, zoomAt };
}
