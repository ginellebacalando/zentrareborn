const OPTIMIZED_MEDIA_ROOTS = [
  '/zion-gallery/',
  '/zion-gallery-2/',
  '/zion-media/',
] as const;

export function optimizedPublicMediaPath(source: string) {
  if (!OPTIMIZED_MEDIA_ROOTS.some((root) => source.startsWith(root))) {
    return source;
  }

  return source.replace(/\.(?:jpe?g|png)(?=$|[?#])/iu, '.webp');
}
