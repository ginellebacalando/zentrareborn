import React from 'react';
import Image from 'next/image';
import { MapPin, Share2 } from 'lucide-react';

import PublicSubpageShell from '@/components/client/PublicSubpageShell';
import SocialLinks from '@/components/layout/SocialLinks';
import { BRAND } from '@/config/brand';
import InquiryForm from './_components/InquiryForm';
import PublishedManagedContentSection from '@/components/public-content/PublishedManagedContentSection';

export const dynamic = 'force-dynamic';

export default function ContactPage() {
  return (
    <PublicSubpageShell heroKey="contact">
      <PublishedManagedContentSection type="CONTACT" label="Published Zion contact information" />

      <div className="w-full relative z-10 bg-transparent pt-12 pb-24">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-12">
          {/* Top Section: Info Cards and Form */}
          <div className="mb-16 grid grid-cols-1 items-start gap-8 lg:grid-cols-[46%_1fr] lg:gap-12">
            {/* Left Column: Cards */}
            <div className="flex flex-col gap-6">
              {/* Location Card */}
              <div
                className="group bg-surface/60 backdrop-blur-sm rounded-3xl p-7 shadow-sm hover:shadow-[0_20px_40px_color-mix(in_srgb,var(--palette-gold)_10%,transparent)] border border-zion-accent/20 transition-all duration-500 hover:-translate-y-1 relative overflow-hidden"
                style={{ animation: 'fadeInUp 0.6s ease-out 0.1s both' }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-zion-accent/10 to-transparent rounded-full blur-2xl -mr-10 -mt-10 transition-transform duration-700 group-hover:scale-150"></div>

                <h2 className="info-heading flex items-center gap-4 text-xl font-serif text-ink mb-4 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-surface shadow-sm flex items-center justify-center border border-zion-accent/30 group-hover:bg-zion-accent/10 transition-colors duration-500 text-accent-ink">
                    <MapPin className="w-5 h-5" aria-hidden="true" />
                  </div>
                  Our Location
                </h2>
                <p className="font-serif text-ink/80 text-base leading-relaxed pl-16 w-full relative z-10">
                  {BRAND.address.full}
                </p>
              </div>

              {/* Business Hours Card */}
              <div
                className="group bg-surface/60 backdrop-blur-sm rounded-3xl p-7 shadow-sm hover:shadow-[0_20px_40px_color-mix(in_srgb,var(--palette-gold)_10%,transparent)] border border-zion-accent/20 transition-all duration-500 hover:-translate-y-1 relative overflow-hidden"
                style={{ animation: 'fadeInUp 0.6s ease-out 0.2s both' }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-zion-accent/10 to-transparent rounded-full blur-2xl -mr-10 -mt-10 transition-transform duration-700 group-hover:scale-150"></div>

                <h2 className="info-heading flex items-center gap-4 text-xl font-serif text-ink mb-4 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-surface shadow-sm flex items-center justify-center border border-zion-accent/30 group-hover:bg-zion-accent/10 transition-colors duration-500 text-accent-ink">
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  Business Hours
                </h2>
                <div className="flex flex-col w-full pl-16 relative z-10">
                  {BRAND.visits.hours.map((entry) => (
                    <div
                      key={entry.days}
                      className="flex justify-between items-center py-3 border-b border-zion-accent/20 font-serif text-base text-ink group-hover:border-zion-accent/40 transition-colors"
                    >
                      <span className="font-medium opacity-90">{entry.days}</span>
                      <span className="text-ink/80">{entry.time}</span>
                    </div>
                  ))}
                </div>
                <div className="text-left w-full mt-5 pl-16 font-sans tracking-widest uppercase text-accent-ink text-xs font-bold">
                  {BRAND.visits.notice}
                </div>
              </div>

              {/* Contact Information Card */}
              <div
                className="group bg-surface/60 backdrop-blur-sm rounded-3xl p-7 shadow-sm hover:shadow-[0_20px_40px_color-mix(in_srgb,var(--palette-gold)_10%,transparent)] border border-zion-accent/20 transition-all duration-500 hover:-translate-y-1 relative overflow-hidden"
                style={{ animation: 'fadeInUp 0.6s ease-out 0.3s both' }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-zion-accent/10 to-transparent rounded-full blur-2xl -mr-10 -mt-10 transition-transform duration-700 group-hover:scale-150"></div>

                <h2 className="info-heading flex items-center gap-4 text-xl font-serif text-ink mb-5 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-surface shadow-sm flex items-center justify-center border border-zion-accent/30 group-hover:bg-zion-accent/10 transition-colors duration-500 text-accent-ink">
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                  </div>
                  Contact Information
                </h2>
                <div className="flex flex-col gap-5 pl-16 relative z-10">
                  <div className="flex items-center gap-4 group/item cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-surface border border-zion-accent/20 flex items-center justify-center group-hover/item:scale-110 group-hover/item:bg-zion-accent group-hover/item:text-white transition-all text-accent-ink shadow-sm">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 18H4V8L12 13L20 8V18ZM12 11L4 6H20L12 11Z" />
                      </svg>
                    </div>
                    <a
                      href={BRAND.contact.emailHref}
                      className="font-serif text-ink/90 hover:text-accent-ink transition-colors break-all text-base font-medium"
                    >
                      {BRAND.contact.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-4 group/item cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-surface border border-zion-accent/20 flex items-center justify-center group-hover/item:scale-110 group-hover/item:bg-zion-accent group-hover/item:text-white transition-all text-accent-ink shadow-sm">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                      </svg>
                    </div>
                    <a
                      href={BRAND.contact.phoneHref}
                      className="font-serif text-ink/90 hover:text-accent-ink transition-colors text-base font-medium"
                    >
                      {BRAND.contact.phone}
                    </a>
                  </div>
                </div>
              </div>

              {/* Social Media Card */}
              <div
                className="group bg-surface/60 backdrop-blur-sm rounded-3xl p-7 shadow-sm hover:shadow-[0_20px_40px_color-mix(in_srgb,var(--palette-gold)_10%,transparent)] border border-zion-accent/20 transition-all duration-500 hover:-translate-y-1 relative overflow-hidden"
                style={{ animation: 'fadeInUp 0.6s ease-out 0.4s both' }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-zion-accent/10 to-transparent rounded-full blur-2xl -mr-10 -mt-10 transition-transform duration-700 group-hover:scale-150"></div>

                <h2 className="info-heading flex items-center gap-4 text-xl font-serif text-ink mb-0 relative z-10">
                  <div className="w-12 h-12 rounded-full bg-surface shadow-sm flex items-center justify-center border border-zion-accent/30 group-hover:bg-zion-accent/10 transition-colors duration-500 text-accent-ink">
                    <Share2 className="w-5 h-5" aria-hidden="true" />
                  </div>
                  Social Media
                </h2>
                <p className="relative z-10 pl-0 sm:pl-16 mb-4 -mt-2 font-serif text-sm leading-relaxed text-ink/65">
                  Follow us for our latest celebrations, venue styling, and event highlights.
                </p>
                <SocialLinks variant="contact" className="relative z-10 pl-0 sm:pl-16" />
              </div>
            </div>

            {/* Right Column: Form */}
            <div
              id="message-us"
              className="flex w-full scroll-mt-28 flex-col items-start"
              style={{ animation: 'fadeInUp 0.6s ease-out 0.5s both' }}
            >
              <span className="mb-4 rounded-full bg-gradient-to-r from-zion-accent to-[var(--palette-gold)] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white shadow-md">
                Message Us
              </span>
              <h2 className="mb-3 font-serif text-4xl text-ink md:text-5xl">How can we help?</h2>
              <p className="mb-8 font-serif text-base leading-relaxed text-muted">
                Share your event details or questions below and our team will get back to you
                promptly.
              </p>

              <div className="group/form relative w-full overflow-hidden rounded-[2rem] border border-zion-accent/25 bg-surface/75 p-7 shadow-[0_24px_60px_-24px_color-mix(in_srgb,var(--palette-night)_14%,transparent)] backdrop-blur-md transition-shadow duration-500 hover:shadow-[0_28px_70px_-24px_color-mix(in_srgb,var(--palette-gold)_22%,transparent)] sm:p-9">
                {/* Decorative top accent & ambient glow */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[var(--palette-client-button)]/80 to-transparent"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-zion-accent/12 to-transparent blur-3xl transition-transform duration-1000 group-hover/form:scale-125"
                />

                <InquiryForm />
              </div>
            </div>
          </div>

          {/* Bottom Section: Map & Direction */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-stretch mt-8">
            {/* Map */}
            <div className="w-full min-h-[300px] lg:min-h-[400px] rounded-[24px] overflow-hidden shadow-sm border-4 border-white relative z-20">
              <iframe
                title="Location of Zion Events Place in San Pedro, Laguna"
                src={BRAND.maps.embedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="w-full h-full object-cover"
              ></iframe>
            </div>

            {/* Direction Card */}
            <div className="bg-surface/60 backdrop-blur-sm border border-neutral-900/10 rounded-2xl p-6 shadow-sm h-full flex flex-col justify-center">
              <h2 className="info-heading flex items-center text-xl font-serif text-ink mb-5">
                <a
                  href={BRAND.maps.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 hover:text-accent-ink transition-colors group cursor-pointer w-fit"
                >
                  <Image
                    src="/images/ui/direction.png"
                    alt="Direction Icon"
                    width={24}
                    height={24}
                    className="w-6 h-6 object-contain group-hover:scale-110 transition-transform"
                  />
                  <span className="border-b border-transparent group-hover:border-zion-accent transition-colors pb-0.5">
                    Direction
                  </span>
                </a>
              </h2>
              <ul className="flex flex-col gap-5 font-serif text-ink text-base leading-relaxed opacity-90 w-full">
                {BRAND.directions.map((dir, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Image
                      src="/images/ui/right-arrow.png"
                      alt=""
                      width={20}
                      height={20}
                      className="w-5 h-5 mt-1 flex-shrink-0 object-contain"
                    />
                    <p>{dir}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PublicSubpageShell>
  );
}
