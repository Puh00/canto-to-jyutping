import type { HighlightStroke } from './prepare-image';

export type PhotoCrop = { left: number; top: number; width: number; height: number };

// Use original-image pixels for both the recognition crop and its source preview.
export function highlightBounds(originalWidth: number, originalHeight: number, strokes?: HighlightStroke[]): PhotoCrop {
  if (strokes && !strokes.some(stroke => stroke.points.length)) throw new Error('Highlight some text first.');
  let left = 0, top = 0, right = originalWidth, bottom = originalHeight;
  if (strokes) {
    left = originalWidth; top = originalHeight; right = 0; bottom = 0;
    for (const stroke of strokes) for (const point of stroke.points) {
      const radius = stroke.width * originalWidth / 2;
      left = Math.min(left, point.x * originalWidth - radius);
      top = Math.min(top, point.y * originalHeight - radius);
      right = Math.max(right, point.x * originalWidth + radius);
      bottom = Math.max(bottom, point.y * originalHeight + radius);
    }
    // Preserve the padding used by recognition, including strokes near the edges.
    left = Math.max(0, Math.floor(left - 8)); top = Math.max(0, Math.floor(top - 8));
    right = Math.min(originalWidth, Math.ceil(right + 8)); bottom = Math.min(originalHeight, Math.ceil(bottom + 8));
  }
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}
