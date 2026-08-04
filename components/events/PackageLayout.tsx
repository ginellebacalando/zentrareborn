import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';

import ClientFeatureUnavailable from '@/components/client/ClientFeatureUnavailable';
import GalleryRibbon from '@/components/client/GalleryRibbon';
import PublicSubpageShell from '@/components/client/PublicSubpageShell';
import SpacesSection from '@/components/client/SpacesSection';
import {
  eventPackagePages,
  type EventPackageMediaKey,
} from '@/config/event-package-pages';
import { getClientFeatureAvailability } from '@/lib/system-settings';
import { optimizedPublicMediaPath } from '@/lib/public-media';
import PackageFlipbook from './PackageFlipbook';
import FadeIn from '@/components/shared/FadeIn';

interface PackageLayoutProps {
  eventType: EventPackageMediaKey;
}

export default async function PackageLayout({
  eventType,
}: PackageLayoutProps) {
  await connection();
  const page = eventPackagePages[eventType];
  const packageAvailability = await getClientFeatureAvailability('packages');

  return (
    <PublicSubpageShell heroKey={page.heroKey}>
      {!packageAvailability.enabled ? (
        <ClientFeatureUnavailable
          title="Packages Are Paused"
          message={packageAvailability.message}
        />
      ) : (
      <div
        data-package-layout-content
        className="w-full relative z-10 bg-transparent pb-0"
      >

        {/* Content Blocks (Alternating Layout) */}
        <div className="w-full max-w-7xl mx-auto py-12 md:py-20 px-4 md:px-12 flex flex-col gap-16 md:gap-24">
          {page.contentBlocks.map((block, index) => {
            const isImageLeft = block.imagePosition === 'left';
            return (
              <div key={index} className={`flex flex-col lg:flex-row gap-12 items-center ${isImageLeft ? '' : 'lg:flex-row-reverse'}`}>
                <FadeIn direction={isImageLeft ? 'right' : 'left'} className="flex-1 w-full relative">
                  <div className={`relative z-10 p-2 md:p-3 bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_20px_40px_-15px_rgba(214,181,59,0.15)] transform ${isImageLeft ? '-rotate-3' : 'rotate-3'} hover:rotate-0 hover:scale-[1.02] transition-all duration-700 ease-in-out`}>
                    <Image
                      src={optimizedPublicMediaPath(block.image.src)}
                      alt={block.image.alt}
                      width={1200}
                      height={900}
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="w-full h-[400px] md:h-[550px] object-cover rounded-2xl"
                    />
                  </div>
                  {block.secondaryImage && (
                    <div className={`absolute -bottom-8 ${isImageLeft ? '-right-8' : '-left-8'} w-2/3 h-56 md:h-72 z-20 hidden md:block transform ${isImageLeft ? 'rotate-6' : '-rotate-6'} hover:rotate-0 hover:scale-110 hover:-translate-y-4 ${isImageLeft ? 'hover:-translate-x-2' : 'hover:translate-x-2'} transition-all duration-700 ease-in-out hover:z-30`}>
                      <Image
                        src={optimizedPublicMediaPath(block.secondaryImage.src)}
                        alt={block.secondaryImage.alt}
                        width={900}
                        height={720}
                        sizes="33vw"
                        className="w-full h-full object-cover rounded-2xl shadow-2xl border-4 border-white"
                      />
                    </div>
                  )}
                </FadeIn>
                <FadeIn direction={isImageLeft ? 'left' : 'right'} className={`flex-1 w-full ${isImageLeft ? 'lg:pl-10' : 'lg:pr-10'} mt-12 lg:mt-0`}>
                  <p className="font-serif text-xl md:text-2xl lg:text-3xl leading-relaxed text-neutral-900 tracking-wide">
                    {block.text}
                  </p>
                </FadeIn>
              </div>
            );
          })}
        </div>

        {/* Our Spaces (same video experience as the home page) */}
        <SpacesSection />

        {/* Our Packages */}
        <div className="w-full bg-transparent py-12">
          <div className="max-w-7xl mx-auto px-4 md:px-12 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="flex-1 flex flex-col items-start text-left md:pr-8">
              <h2 className="text-2xl md:text-3xl font-serif uppercase tracking-widest text-neutral-900 mb-6">
                OUR PACKAGES
              </h2>
              <p className="font-serif text-xl md:text-2xl lg:text-3xl leading-relaxed text-neutral-900 mb-8">
                {page.packageText}
              </p>
              <Link
                href="/contact"
                className="group relative inline-flex items-center justify-center px-10 py-3.5 bg-[#2A3A2C] border border-[#2A3A2C] overflow-hidden transition-all duration-500 ease-out hover:bg-transparent hover:border-[#D4AF37] hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] pointer-events-auto mt-2"
              >
                <span className="relative font-serif text-xs md:text-sm uppercase tracking-[0.25em] font-medium text-[#F4EBE1] transition-colors duration-500 group-hover:text-[#D4AF37]">
                  Ask About This Package
                </span>
              </Link>
            </div>
            <div className="flex-1 flex flex-col items-start w-full md:pl-8">
              <p className="font-serif text-lg md:text-xl mb-3 text-neutral-900 tracking-wider">VIEW DETAILS:</p>
              <PackageFlipbook eventType={eventType} />
            </div>
          </div>
        </div>

        {/* Gallery (same continuous ribbon and decorative motion as the home page) */}
        <section aria-labelledby={`${eventType}-gallery-title`} className="w-full bg-transparent px-4 py-12 md:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex w-full flex-col items-center overflow-hidden">
              <div className="group relative flex w-full min-w-0 cursor-default items-center justify-center gap-3 md:gap-6" data-motion="decorative">
                <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-r from-transparent to-[#D4AF37]/80 opacity-70 transition-all duration-700 ease-out group-hover:to-[#D4AF37] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />
                <h2
                  id={`${eventType}-gallery-title`}
                  className="shrink-0 text-center font-serif text-[1.05rem] uppercase tracking-[0.08em] text-neutral-900 transition-colors duration-700 ease-out group-hover:text-[#D4AF37] min-[360px]:text-xl min-[360px]:tracking-[0.1em] md:text-4xl md:tracking-[0.2em] md:group-hover:tracking-[0.24em]"
                >
                  GALLERY
                </h2>
                <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-l from-transparent to-[#D4AF37]/80 opacity-70 transition-all duration-700 ease-out group-hover:to-[#D4AF37] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />
              </div>
            </div>
            <GalleryRibbon
              images={page.galleryImages}
              ariaLabel="Package gallery highlights"
            />
          </div>
        </section>

      </div>
      )}
    </PublicSubpageShell>
  );
}
