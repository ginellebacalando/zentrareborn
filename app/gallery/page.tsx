import PublicSubpageShell from '@/components/client/PublicSubpageShell';
import CategorizedGallery from '@/components/client/CategorizedGallery';

export default function GalleryPage() {
  return (
    <PublicSubpageShell heroKey="gallery">
      <section className="w-full pt-16 md:pt-24 pb-0">
        <div className="mx-auto mb-12 max-w-7xl px-4 text-center md:px-12">
          <div
            className="group relative flex w-full min-w-0 cursor-default items-center justify-center gap-3 md:gap-6"
            data-motion="decorative"
          >
            <div className="h-px min-w-4 flex-1 bg-[var(--palette-client-section)]/60 md:max-w-20" />
            <h1 className="min-w-0 text-balance text-center font-serif text-3xl uppercase tracking-[0.14em] text-ink md:text-5xl md:tracking-[0.2em]">
              OUR GALLERY
            </h1>
            <div className="h-px min-w-4 flex-1 bg-[var(--palette-client-section)]/60 md:max-w-20" />
          </div>
          <p className="mt-4 text-muted font-serif md:text-lg">
            Explore our beautifully curated spaces and unforgettable events.
          </p>
        </div>
        <CategorizedGallery />
      </section>
    </PublicSubpageShell>
  );
}
