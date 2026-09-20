export type PreparedImage = {
  pixels: ImageData;
  blob: Blob;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  format: string;
};

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > 30 * 1024 * 1024) throw new Error('This image is too large. Choose a photo smaller than 30 MB.');
  if (file.type && !file.type.startsWith('image/')) throw new Error('Choose an image, such as a JPEG or PNG photo.');
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    try { await image.decode(); } catch {
      throw new Error('This image could not be opened. Try a JPEG, PNG, or a screenshot of the photo.');
    }
    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;
    if (!originalWidth || !originalHeight) throw new Error('This image has no readable pixels.');
    const scale = Math.min(1, 1600 / Math.max(originalWidth, originalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(originalWidth * scale));
    canvas.height = Math.max(1, Math.round(originalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this photo.');
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare the photo.')), 'image/png'));
    return {
      blob,
      pixels: context.getImageData(0, 0, canvas.width, canvas.height),
      previewUrl: URL.createObjectURL(blob),
      originalWidth, originalHeight, format: file.type || 'unspecified image',
    };
  } finally { URL.revokeObjectURL(sourceUrl); }
}
