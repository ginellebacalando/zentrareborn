import 'server-only';

import { createHash } from 'node:crypto';
import sharp, { type OutputInfo } from 'sharp';
import { CLIENT_PHOTO_LIMITS } from '@/config/client-photos';

/**
 * Checks and cleans a client photo before it is stored (docs/client-photos.md). The type comes
 * from the file's first bytes, never from its name or the browser's claim. Every photo is then
 * decoded and saved again by the server: turned upright, scaled to 800 px at most, re-encoded as
 * JPEG, and stripped of all metadata (location, camera, time, colour profile), so only the
 * picture itself is kept.
 */
export class ClientPhotoFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientPhotoFileError';
  }
}

/** Larger images are refused before they are decoded, so a crafted file cannot exhaust memory. */
const MAX_INPUT_PIXELS = 50_000_000;
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

type SniffedType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

/** The real type of the file from its signature, or null for anything else. */
export function sniffClientPhotoType(bytes: Uint8Array): SniffedType | null {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (bytes.length >= 3 && starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (bytes.length >= 8 && starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return 'image/png';
  const text = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 12 && text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'image/webp';
  // An iPhone photo the phone did not convert: an ISO media file with a HEIC/HEIF brand.
  if (bytes.length >= 12 && text(4, 8) === 'ftyp' && HEIF_BRANDS.has(text(8, 12)))
    return 'image/heic';
  return null;
}

export type PreparedClientPhoto = {
  data: Buffer;
  contentType: 'image/jpeg';
  width: number;
  height: number;
  sizeBytes: number;
  sha256: string;
};

/** Validates a chosen photo and returns the cleaned JPEG to store. */
export async function prepareClientPhoto(file: Blob): Promise<PreparedClientPhoto> {
  if (!file.size) throw new ClientPhotoFileError('Choose a photo first.');
  if (file.size > CLIENT_PHOTO_LIMITS.maxUploadBytes)
    throw new ClientPhotoFileError('That photo is too large. Choose one under 10 MB.');
  const original = new Uint8Array(await file.arrayBuffer());
  const type = sniffClientPhotoType(original);
  if (type === 'image/heic')
    throw new ClientPhotoFileError(
      'This photo format cannot be opened here. Take a selfie instead, or choose a JPG or PNG photo.',
    );
  if (!type) throw new ClientPhotoFileError('Choose a JPG, PNG or WebP photo.');
  let size: { width?: number; height?: number };
  try {
    size = await sharp(original, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new ClientPhotoFileError('That photo could not be opened. Please try another one.');
  }
  if (Math.min(size.width ?? 0, size.height ?? 0) < CLIENT_PHOTO_LIMITS.minShortestSide)
    throw new ClientPhotoFileError('That photo is too small to show your face. Use a larger one.');
  let output: { data: Buffer; info: OutputInfo };
  try {
    output = await sharp(original, { limitInputPixels: MAX_INPUT_PIXELS })
      // Turns the picture upright from the camera's orientation before the metadata goes.
      .rotate()
      .resize({
        width: CLIENT_PHOTO_LIMITS.storedLongestSide,
        height: CLIENT_PHOTO_LIMITS.storedLongestSide,
        fit: 'inside',
        withoutEnlargement: true,
      })
      // A transparent PNG or WebP gets a white background in the JPEG.
      .flatten({ background: '#ffffff' })
      // Without keepMetadata()/withMetadata(), sharp writes no EXIF, GPS, XMP, IPTC or ICC data.
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ClientPhotoFileError('That photo could not be opened. Please try another one.');
  }
  const data = Buffer.from(output.data);
  return {
    data,
    contentType: 'image/jpeg',
    width: output.info.width,
    height: output.info.height,
    sizeBytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
  };
}
