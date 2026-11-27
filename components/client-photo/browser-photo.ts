import { CLIENT_PHOTO_LIMITS } from '@/config/client-photos';

/**
 * Scales a chosen photo to 1600 px at most and re-encodes it as JPEG in the browser, so a phone
 * photo uploads quickly and an iPhone photo arrives in a format the server can read (the browser
 * turns it upright too). The server still checks and cleans every photo
 * (lib/client-photo-file.ts). Throws when the browser cannot open the file.
 */
export async function photoAsJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    CLIENT_PHOTO_LIMITS.browserLongestSide / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No canvas');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9),
  );
  if (!blob) throw new Error('Not encoded');
  return blob;
}

export const UNREADABLE_PHOTO =
  'This photo could not be opened here. Take a photo with the camera instead, or choose a JPG or PNG photo.';
