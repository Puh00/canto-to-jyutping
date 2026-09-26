import { highlightBounds } from './highlight-bounds';

export type ImagePoint = { x: number; y: number };
// Points and brush width are fractions of the original image; width is relative to image width.
export type HighlightStroke = { points: ImagePoint[]; width: number };
export type PreparedImage = { pixels: ImageData };
export type OpenedImage = {
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  format: string;
  prepare: (strokes?: HighlightStroke[]) => Promise<PreparedImage>;
  dispose: () => void;
};

export async function openImage(file: File): Promise<OpenedImage> {
  if (file.size > 30 * 1024 * 1024) throw new Error('This image is too large. Choose a photo smaller than 30 MB.');
  if (file.type && !file.type.startsWith('image/')) throw new Error('Choose an image, such as a JPEG or PNG photo.');
  const previewUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = previewUrl;
    try { await image.decode(); } catch {
      throw new Error('This image could not be opened. Try a JPEG, PNG, or a screenshot of the photo.');
    }
    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;
    if (!originalWidth || !originalHeight) throw new Error('This image has no readable pixels.');
    return {
      previewUrl, originalWidth, originalHeight, format: file.type || 'unspecified image',
      dispose: () => { URL.revokeObjectURL(previewUrl); image.src = ''; },
      async prepare(strokes) {
        const { left, top, width, height } = highlightBounds(originalWidth, originalHeight, strokes);
        const scale = Math.min(1, 1600 / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Your browser could not prepare this photo.');
        context.drawImage(image, left, top, width, height, 0, 0, canvas.width, canvas.height);
        if (strokes) {
          const mask = document.createElement('canvas');
          mask.width = canvas.width; mask.height = canvas.height;
          const brush = mask.getContext('2d')!;
          brush.scale(canvas.width / width, canvas.height / height);
          brush.translate(-left, -top);
          brush.lineCap = 'round'; brush.lineJoin = 'round';
          for (const stroke of strokes) {
            const first = stroke.points[0];
            if (!first) continue;
            const brushWidth = stroke.width * originalWidth;
            brush.lineWidth = brushWidth;
            brush.beginPath();
            brush.arc(first.x * originalWidth, first.y * originalHeight, brushWidth / 2, 0, Math.PI * 2);
            brush.fill();
            brush.beginPath();
            brush.moveTo(first.x * originalWidth, first.y * originalHeight);
            for (const point of stroke.points.slice(1)) brush.lineTo(point.x * originalWidth, point.y * originalHeight);
            brush.stroke();
          }
          context.globalCompositeOperation = 'destination-in';
          context.drawImage(mask, 0, 0);
        }
        // Pixels outside the brush are white even inside the combined bounding rectangle.
        context.globalCompositeOperation = 'destination-over';
        context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
        return { pixels: context.getImageData(0, 0, canvas.width, canvas.height) };
      },
    };
  } catch (error) { URL.revokeObjectURL(previewUrl); throw error; }
}
