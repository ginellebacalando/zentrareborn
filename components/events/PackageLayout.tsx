import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';

import ClientFeatureUnavailable from '@/components/client/ClientFeatureUnavailable';
import GalleryRibbon from '@/components/client/GalleryRibbon';
import SpacesSection from '@/components/client/SpacesSection';
import TestimonialSection from '@/components/client/TestimonialSection';
import { eventPackagePages, type EventPackageMediaKey } from '@/config/event-package-pages';
import { getClientFeatureAvailability } from '@/lib/system-settings';
import { optimizedPublicMediaPath } from '@/lib/public-media';
import PackageFlipbook from './PackageFlipbook';
import PackageHeroSection from './PackageHeroSection';
import FadeIn from '@/components/shared/FadeIn';

interface PackageLayoutProps {
  eventType: EventPackageMediaKey;
}

function SectionHeading({
  id,
  title,
  subtitle,
}: {
  id?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8 flex w-full flex-col items-center overflow-hidden">
      <div
        className="group relative flex w-full min-w-0 cursor-default items-center justify-center gap-3 md:gap-6"
        data-motion="decorative"
      >
        <div className="h-[1.5px] min-w-4 flex-1 bg-gradient-to-r from-transparent to-[var(--palette-client-section)]/75 opacity-70 transition-all duration-700 ease-out group-hover:to-[var(--palette-client-section)] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />
        <h2
          id={id}
          className="min-w-0 text-balance text-center font-serif text-[1.05rem] uppercase tracking-[0.08em] text-ink transition-all duration-700 ease-out group-hover:text-[var(--palette-client-section)] group-hover:drop-shadow-[0_1px_1px_color-mix(in_srgb,var(--palette-ink)_22%,transparent)] min-[360px]:text-xl min-[360px]:tracking-[0.1em] md:text-4xl md:tracking-[0.2em] md:group-hover:tracking-[0.24em]"
        >
          {title}
        </h2>
        <div className="h-[1.5px] min-w-4 flex-1 bg-gradient-to-l from-transparent to-[var(--palette-client-section)]/75 opacity-70 transition-all duration-700 ease-out group-hover:to-[var(--palette-client-section)] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />
      </div>
      {subtitle && (
        <p className="mt-2 text-center font-serif text-base text-ink/80 transition-all duration-500 hover:text-ink md:text-lg">
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default async function PackageLayout({ eventType }: PackageLayoutProps) {
  await connection();
  const page = eventPackagePages[eventType];
  const heroVideoSrc = 'heroVideoSrc' in page ? page.heroVideoSrc : undefined;
  const packageAvailability = await getClientFeatureAvailability('packages');

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="public-page responsive-page relative flex min-h-screen flex-col bg-transparent"
    >
      <PackageHeroSection
        title={page.heroTitle}
        subtitle={page.heroSubtitle}
        slides={page.heroSlides}
        videoSrc={heroVideoSrc}
      />

      {!packageAvailability.enabled ? (
        <div className="relative z-10 w-full bg-transparent">
          <ClientFeatureUnavailable
            title="Packages Are Paused"
            message={packageAvailability.message}
          />
        </div>
      ) : (
        <div data-package-layout-content className="relative z-10 w-full bg-transparent">
          {/* Package Experience Highlights */}
          <FadeIn direction="up">
            <section
              aria-labelledby={`${eventType}-experience-title`}
              className="w-full bg-transparent px-4 pt-12 pb-10 md:px-12 md:pt-16 md:pb-12"
            >
              <div className="mx-auto max-w-7xl">
                <SectionHeading
                  id={`${eventType}-experience-title`}
                  title={page.experienceHeading}
                  subtitle={page.experienceSubtitle}
                />

                <div className="flex flex-col gap-16 md:gap-24">
                  {page.contentBlocks.map((block, index) => {
                    const isImageLeft = block.imagePosition === 'left';
                    return (
                      <div
                        key={index}
                        className={`flex flex-col items-center gap-12 lg:flex-row ${isImageLeft ? '' : 'lg:flex-row-reverse'}`}
                      >
                        <FadeIn
                          direction={isImageLeft ? 'right' : 'left'}
                          className="relative w-full flex-1"
                        >
                          <div
                            className={`relative z-10 p-2 md:p-3 bg-surface/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_20px_40px_-15px_color-mix(in_srgb,var(--palette-gold)_15%,transparent)] transform ${isImageLeft ? '-rotate-3' : 'rotate-3'} hover:rotate-0 hover:scale-[1.02] transition-all duration-700 ease-in-out`}
                          >
                            <Image
                              src={optimizedPublicMediaPath(block.image.src)}
                              alt={block.image.alt}
                              width={1200}
                              height={900}
                              sizes="(min-width: 1024px) 50vw, 100vw"
                              className="h-[400px] w-full rounded-2xl object-cover md:h-[550px]"
                            />
                          </div>
                          {block.secondaryImage && (
                            <div
                              className={`absolute -bottom-8 ${isImageLeft ? '-right-8' : '-left-8'} z-20 hidden h-56 w-2/3 transform md:block md:h-72 ${isImageLeft ? 'rotate-6' : '-rotate-6'} transition-all duration-700 ease-in-out hover:z-30 hover:-translate-y-4 hover:rotate-0 hover:scale-110 ${isImageLeft ? 'hover:-translate-x-2' : 'hover:translate-x-2'}`}
                            >
                              <Image
                                src={optimizedPublicMediaPath(block.secondaryImage.src)}
                                alt={block.secondaryImage.alt}
                                width={900}
                                height={720}
                                sizes="33vw"
                                className="h-full w-full rounded-2xl border-4 border-white object-cover shadow-2xl"
                              />
                            </div>
                          )}
                        </FadeIn>

                        <FadeIn
                          direction={isImageLeft ? 'left' : 'right'}
                          className={`mt-12 w-full flex-1 lg:mt-0 ${isImageLeft ? 'lg:pl-10' : 'lg:pr-10'}`}
                        >
                          <span
                            aria-hidden="true"
                            className="mb-5 block h-px w-12 bg-[var(--palette-client-section)]"
                          />
                          <p className="font-serif text-xl leading-relaxed tracking-wide text-ink md:text-2xl lg:text-3xl">
                            {block.text}
                          </p>
                        </FadeIn>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </FadeIn>

          {/* Our Spaces (exact Home page video experience) */}
          <FadeIn direction="up">
            <SpacesSection />
          </FadeIn>

          {/* Our Packages & Interactive Magazine */}
          <FadeIn direction="up">
            <section
              id="packages"
              aria-labelledby={`${eventType}-packages-title`}
              className="w-full scroll-mt-24 bg-transparent px-4 py-12 md:px-12"
            >
              <div className="mx-auto max-w-7xl">
                <SectionHeading
                  id={`${eventType}-packages-title`}
                  title="OUR PACKAGES"
                  subtitle="Curated inclusions tailored for your celebration at Zion."
                />

                <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-6">
                  <div className="relative z-10 flex flex-col items-start text-left lg:col-span-6 lg:pr-4">
                    <span
                      aria-hidden="true"
                      className="mb-5 block h-px w-12 bg-[var(--palette-client-section)]"
                    />
                    <p className="mb-8 font-serif text-xl leading-relaxed text-ink md:text-2xl lg:text-3xl">
                      {page.packageText}
                    </p>
                    <Link
                      href="/booking"
                      className="group pointer-events-auto relative mt-2 inline-flex min-h-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--palette-client-button)] bg-transparent px-9 py-3.5 transition-all duration-500 ease-out hover:shadow-[0_14px_30px_-12px_color-mix(in_srgb,var(--palette-client-button)_50%,transparent)]"
                    >
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 translate-y-full bg-[var(--palette-client-button)] transition-transform duration-500 ease-in-out group-hover:translate-y-0"
                      />
                      <span className="relative z-10 font-sans text-xs font-bold uppercase tracking-[0.2em] text-ink transition-colors duration-500 md:text-sm">
                        Book Now
                      </span>
                    </Link>
                  </div>

                  <div
                    id="packages-booklet"
                    className="relative z-20 flex w-full scroll-mt-28 justify-center lg:col-span-6 lg:justify-center"
                  >
                    <PackageFlipbook eventType={eventType} />
                  </div>
                </div>
              </div>
            </section>
          </FadeIn>

          {/* Package Gallery (exact Home page continuous ribbon) */}
          <FadeIn direction="up">
            <section
              aria-labelledby={`${eventType}-gallery-title`}
              className="w-full bg-transparent px-4 py-12 md:px-12"
            >
              <div className="mx-auto max-w-7xl">
                <SectionHeading id={`${eventType}-gallery-title`} title="GALLERY" />
                <GalleryRibbon images={page.galleryImages} ariaLabel="Package gallery highlights" />
              </div>
            </section>
          </FadeIn>

          {/* Testimonies (exact Home page social proof section) */}
          <FadeIn direction="up">
            <TestimonialSection />
          </FadeIn>
        </div>
      )}
    </main>
  );
}
