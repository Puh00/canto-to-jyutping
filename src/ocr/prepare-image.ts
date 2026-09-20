export type ImagePoint = { x: number; y: number };
// Points and brush width are fractions of the original image; width is relative to image width.
export type HighlightStroke = { points: ImagePoint[]; width: number };
export type PreparedImage = { pixels: ImageData; blob: Blob };
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
          // A little white space around the selected text helps recognition at crop edges.
          left = Math.max(0, Math.floor(left - 8)); top = Math.max(0, Math.floor(top - 8));
          right = Math.min(originalWidth, Math.ceil(right + 8)); bottom = Math.min(originalHeight, Math.ceil(bottom + 8));
        }
        const width = Math.max(1, right - left), height = Math.max(1, bottom - top);
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
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare the photo.')), 'image/png'));
        return { blob, pixels: context.getImageData(0, 0, canvas.width, canvas.height) };
      },
    };
  } catch (error) { URL.revokeObjectURL(previewUrl); throw error; }
}
