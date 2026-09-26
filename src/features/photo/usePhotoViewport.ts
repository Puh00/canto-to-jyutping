import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ImagePoint } from '../../ocr/prepare-image';

export type ClientPoint = { clientX: number; clientY: number };
// Positions and translations are fractions of the editor's viewport.
export type ViewportPoint = { x: number; y: number };
export type PhotoView = { scale: number; x: number; y: number };
export type PhotoBounds = { width: number; height: number; imageWidth: number; imageHeight: number };
export const MIN_PHOTO_ZOOM = 1;
export const MAX_PHOTO_ZOOM = 6;
export const clampPhotoZoom = (scale: number) => Math.max(MIN_PHOTO_ZOOM, Math.min(MAX_PHOTO_ZOOM, scale));
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function fitPhoto(width: number, height: number, imageWidth: number, imageHeight: number): PhotoBounds {
  const fit = Math.min(width / imageWidth, height / imageHeight);
  return { width, height, imageWidth: imageWidth * fit, imageHeight: imageHeight * fit };
}

export function constrainPhotoView(requested: PhotoView, bounds: PhotoBounds): PhotoView {
  const scale = clampPhotoZoom(requested.scale);
  const constrain = (offset: number, size: number) => size <= 1 ? (1 - size) / 2 : Math.max(1 - size, Math.min(0, offset));
  return { scale, x: constrain(requested.x, bounds.imageWidth / bounds.width * scale),
    y: constrain(requested.y, bounds.imageHeight / bounds.height * scale) };
}

export function photoPoint(point: ViewportPoint, view: PhotoView, bounds: PhotoBounds): ImagePoint {
  return { x: (point.x - view.x) / (bounds.imageWidth / bounds.width * view.scale),
    y: (point.y - view.y) / (bounds.imageHeight / bounds.height * view.scale) };
}

export function resizePhotoView(view: PhotoView, before: PhotoBounds, after: PhotoBounds): PhotoView {
  const center = photoPoint({ x: .5, y: .5 }, view, before);
  return constrainPhotoView({ scale: view.scale,
    x: .5 - center.x * after.imageWidth / after.width * view.scale,
    y: .5 - center.y * after.imageHeight / after.height * view.scale }, after);
}

export function usePhotoViewport(disabled: boolean, imageWidth: number, imageHeight: number, onResize: () => void) {
  const stage = useRef<HTMLDivElement>(null);
  const current = useRef<PhotoView>({ scale: MIN_PHOTO_ZOOM, x: 0, y: 0 });
  const [view, setView] = useState(current.current);
  const boundsRef = useRef<PhotoBounds>(fitPhoto(1, 1, imageWidth, imageHeight));
  const [bounds, setBounds] = useState(boundsRef.current);
  const resizeCallback = useRef(onResize);
  resizeCallback.current = onResize;
  const pointerActive = useRef(false);

  const viewportPoint = useCallback((client: ClientPoint): ViewportPoint => {
    const rect = stage.current!.getBoundingClientRect();
    return { x: (client.clientX - rect.left) / rect.width, y: (client.clientY - rect.top) / rect.height };
  }, []);
  const pointInImage = (point: ViewportPoint) => {
    const raw = photoPoint(point, current.current, boundsRef.current);
    return { x: clamp(raw.x), y: clamp(raw.y) };
  };
  const imagePoint = (client: ClientPoint) => pointInImage(viewportPoint(client));
  const contains = (client: ClientPoint) => {
    const raw = photoPoint(viewportPoint(client), current.current, boundsRef.current);
    return raw.x >= 0 && raw.x <= 1 && raw.y >= 0 && raw.y <= 1;
  };
  const imageToViewport = (point: ImagePoint): ViewportPoint => ({
    x: current.current.x + point.x * boundsRef.current.imageWidth / boundsRef.current.width * current.current.scale,
    y: current.current.y + point.y * boundsRef.current.imageHeight / boundsRef.current.height * current.current.scale,
  });
  const place = useCallback((requested: PhotoView) => {
    const next = constrainPhotoView(requested, boundsRef.current);
    current.current = next; setView(next);
  }, []);
  const zoomAt = useCallback((scale: number, anchor: ViewportPoint = { x: .5, y: .5 }) => {
    const previous = current.current;
    scale = clampPhotoZoom(scale);
    const ratio = scale / previous.scale;
    place({ scale, x: anchor.x - (anchor.x - previous.x) * ratio,
      y: anchor.y - (anchor.y - previous.y) * ratio });
  }, [place]);

  useLayoutEffect(() => {
    let measured = false;
    const element = stage.current!;
    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      // A closed dialog has no layout. Retain the last visible geometry.
      if (!width || !height) return;
      const previous = boundsRef.current;
      if (measured && width === previous.width && height === previous.height) return;
      resizeCallback.current();
      const next = fitPhoto(width, height, imageWidth, imageHeight);
      const nextView = measured ? resizePhotoView(current.current, previous, next)
        : constrainPhotoView(current.current, next);
      measured = true;
      boundsRef.current = next; setBounds(next);
      current.current = nextView; setView(nextView);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [imageWidth, imageHeight]);

  useEffect(() => {
    const element = stage.current!;
    function wheel(event: WheelEvent) {
      if (disabled || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      if (pointerActive.current) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
      const delta = Math.max(-500, Math.min(500, event.deltaY * unit));
      zoomAt(current.current.scale * Math.exp(-delta * .0015), viewportPoint(event));
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [disabled, viewportPoint, zoomAt]);

  return { stage, view, bounds, viewRef: current, pointerActive, imagePoint, pointInImage, imageToViewport,
    contains, viewportPoint, place, zoomAt };
}
