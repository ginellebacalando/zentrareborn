import { LEGACY_PUBLIC_MEDIA_PATHS } from '@/lib/public-media-manifest';

function decodePublicPath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function optimizedPublicMediaPath(source: string) {
  const suffixIndex = source.search(/[?#]/u);
  const pathname = suffixIndex === -1 ? source : source.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : source.slice(suffixIndex);
  const legacyKey = decodePublicPath(pathname).replace(/^\/+/, '');

  return `${LEGACY_PUBLIC_MEDIA_PATHS[legacyKey] ?? pathname}${suffix}`;
}

export function eventPublicMediaPath(fileName: string) {
  return optimizedPublicMediaPath(`/zion-media/${encodeURIComponent(fileName)}`);
}
