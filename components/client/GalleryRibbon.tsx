import Image from 'next/image';

import { optimizedPublicMediaPath } from '@/lib/public-media';
import styles from './FeaturesSection.module.css';

export type GalleryRibbonImage =
  | string
  | {
      readonly src: string;
      readonly alt: string;
    };

const MIN_GALLERY_RIBBON_ITEMS = 12;

function fillGalleryRibbon(images: readonly GalleryRibbonImage[]) {
  if (images.length === 0) {
    return [];
  }

  const itemCount = Math.max(MIN_GALLERY_RIBBON_ITEMS, images.length);

  return Array.from({ length: itemCount }, (_, index) => ({
    image: images[index % images.length],
    isOriginal: index < images.length,
  }));
}

export default function GalleryRibbon({
  images,
  ariaLabel,
}: {
  images: readonly GalleryRibbonImage[];
  ariaLabel?: string;
}) {
  const ribbonImages = fillGalleryRibbon(images);
  const duplicatedGroups = [ribbonImages, ribbonImages];

  if (ribbonImages.length === 0) {
    return null;
  }

  return (
    <div
      className={styles.galleryRibbon}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? 'list' : undefined}
    >
      <div className={styles.galleryTrack}>
        {duplicatedGroups.map((group, groupIndex) => (
          <div
            aria-hidden={groupIndex === 1 ? true : undefined}
            className={styles.galleryGroup}
            key={groupIndex}
          >
            {group.map(({ image, isOriginal }, imageIndex) => {
              const src = optimizedPublicMediaPath(typeof image === 'string' ? image : image.src);
              const alt = typeof image === 'string' ? '' : image.alt;
              const isAccessibleItem = groupIndex === 0 && isOriginal;

              return (
                <div
                  className={styles.galleryTile}
                  key={`${groupIndex}-${src}-${imageIndex}`}
                  role={ariaLabel && isAccessibleItem ? 'listitem' : undefined}
                >
                  <Image
                    src={src}
                    alt={isAccessibleItem ? alt : ''}
                    fill
                    sizes="(max-width: 768px) 42vw, 18vw"
                    className={styles.galleryImage}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
