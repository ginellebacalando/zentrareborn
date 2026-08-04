import PublicSubpageShell from '@/components/client/PublicSubpageShell';
import CategorizedGallery from '@/components/client/CategorizedGallery';

export default function GalleryPage() {
  return (
    <PublicSubpageShell heroKey="gallery">
      <section className="w-full pt-16 md:pt-24 pb-0">
        <div className="mb-12 text-center px-4">
          <h1 className="font-serif text-4xl uppercase tracking-[0.2em] text-neutral-900 md:text-5xl">
            Our Gallery
          </h1>
          <p className="mt-4 text-neutral-600 font-serif md:text-lg">
            Explore our beautifully curated spaces and unforgettable events.
          </p>
        </div>
        <CategorizedGallery />
      </section>
    </PublicSubpageShell>
  );
}
