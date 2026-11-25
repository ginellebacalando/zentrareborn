import 'server-only';

import { createHash } from 'node:crypto';

/**
 * Checks a payment screenshot before it is stored (booking automation phase 2). The type comes
 * from the file's first bytes, never from its name or the browser's claim, and photos lose their
 * metadata (EXIF location and camera data) so only the picture of the payment is kept.
 */
export const PAYMENT_PROOF_MAX_BYTES = 4 * 1024 * 1024;
export const PAYMENT_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export class PaymentProofFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProofFileError';
  }
}

/** The real type of the file from its signature, or null for anything else. */
export function sniffPaymentProofType(bytes: Uint8Array) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (bytes.length >= 3 && starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (bytes.length >= 8 && starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return 'image/png';
  if (
    bytes.length >= 12 &&
    starts(0x52, 0x49, 0x46, 0x46) &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  if (bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-')
    return 'application/pdf';
  return null;
}

/**
 * Removes the APP1 (EXIF, XMP) and APP13 (IPTC) segments of a JPEG, which can hold the place and
 * time a photo was taken. The image data is copied unchanged; anything unexpected keeps the file
 * as it was rather than risk breaking it.
 */
export function stripJpegMetadata(bytes: Uint8Array) {
  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return bytes;
    const marker = bytes[offset + 1];
    // Start of scan: the compressed image follows to the end of the file.
    if (marker === 0xda) {
      kept.push(bytes.subarray(offset));
      return Buffer.concat(kept);
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) return bytes;
    if (marker !== 0xe1 && marker !== 0xed) kept.push(bytes.subarray(offset, offset + 2 + length));
    offset += 2 + length;
  }
  return bytes;
}

/** Validates an uploaded screenshot and returns the bytes to store with their type and hash. */
export async function preparePaymentProofFile(file: File) {
  if (!file.size) throw new PaymentProofFileError('Choose the screenshot of your payment.');
  if (file.size > PAYMENT_PROOF_MAX_BYTES)
    throw new PaymentProofFileError('The file is too large. Upload a screenshot under 4 MB.');
  const original = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffPaymentProofType(original);
  if (!contentType)
    throw new PaymentProofFileError('Upload a JPG, PNG or WebP screenshot, or a PDF receipt.');
  const data = Buffer.from(contentType === 'image/jpeg' ? stripJpegMetadata(original) : original);
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[
    contentType as 'image/jpeg' | 'image/png' | 'image/webp'
  ];
  return {
    data,
    contentType,
    sizeBytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
    // The stored name never comes from the client's file name.
    fileName: `payment-proof.${extension ?? 'pdf'}`,
  };
}
