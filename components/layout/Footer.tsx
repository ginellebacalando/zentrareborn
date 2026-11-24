import React from 'react';
import Link from 'next/link';
import { BRAND } from '@/config/brand';
import SocialLinks from './SocialLinks';

export default function Footer() {
  return (
    <footer className="relative z-10 bg-surface/95 dark:bg-[var(--palette-night)]/95 backdrop-blur-xl w-full mt-auto shadow-[0_-20px_50px_-15px_color-mix(in_srgb,var(--palette-night)_5%,transparent)] overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[var(--palette-gold-soft)] via-white/0 to-transparent dark:from-[var(--palette-night-card)] dark:via-[var(--palette-night)]/0 dark:to-transparent"></div>
        <div className="absolute inset-0 w-full h-full bg-gradient-to-bl from-[var(--palette-gold-soft)] via-white/0 to-transparent dark:from-[var(--palette-night-card)] dark:via-[var(--palette-night)]/0 dark:to-transparent"></div>
      </div>

      <div className="relative z-10 w-full border-t border-neutral-900/10 pb-[calc(var(--space-2)+env(safe-area-inset-bottom))] pt-8">
        <div className="mx-auto w-full px-4 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-2">
            {/* Left: Brand */}
            <div className="flex flex-col gap-1 md:col-span-3">
              <p className="font-sans text-neutral-900 text-2xl md:text-3xl font-medium tracking-wide transition-all duration-300 hover:text-[var(--palette-gold-hover)] hover:drop-shadow-[0_0_8px_color-mix(in_srgb,var(--palette-gold)_30%,transparent)] cursor-pointer">
                {BRAND.nameUpper}
              </p>
              <p className="text-neutral-900 text-sm md:text-base font-sans max-w-xs opacity-80">
                {BRAND.tagline}
              </p>
            </div>

            {/* Middle 1: Explore Links */}
            <div className="flex flex-col gap-3 items-start text-left md:col-span-2 md:pl-4 lg:pl-16 xl:pl-20">
              <p className="font-sans text-neutral-600 text-sm md:text-base font-bold uppercase mb-1 drop-shadow-sm">
                EXPLORE
              </p>
              <div className="flex flex-col gap-2 items-start">
                <Link
                  href="/"
                  className="relative text-neutral-900 text-sm md:text-base font-sans transition-all duration-300 hover:translate-x-1.5 opacity-80 hover:opacity-100 hover:text-[var(--palette-gold-hover)] w-fit after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1px] after:-bottom-0.5 after:left-0 after:bg-[var(--palette-gold-hover)] after:origin-bottom-right hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:duration-300"
                >
                  Home
                </Link>
                <Link
                  href="/about"
                  className="relative text-neutral-900 text-sm md:text-base font-sans transition-all duration-300 hover:translate-x-1.5 opacity-80 hover:opacity-100 hover:text-[var(--palette-gold-hover)] w-fit after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1px] after:-bottom-0.5 after:left-0 after:bg-[var(--palette-gold-hover)] after:origin-bottom-right hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:duration-300"
                >
                  About Us
                </Link>
                <Link
                  href="/gallery"
                  className="relative text-neutral-900 text-sm md:text-base font-sans transition-all duration-300 hover:translate-x-1.5 opacity-80 hover:opacity-100 hover:text-[var(--palette-gold-hover)] w-fit after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1px] after:-bottom-0.5 after:left-0 after:bg-[var(--palette-gold-hover)] after:origin-bottom-right hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:duration-300"
                >
                  Gallery
                </Link>
                <Link
                  href="/contact"
                  className="relative text-neutral-900 text-sm md:text-base font-sans transition-all duration-300 hover:translate-x-1.5 opacity-80 hover:opacity-100 hover:text-[var(--palette-gold-hover)] w-fit after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1px] after:-bottom-0.5 after:left-0 after:bg-[var(--palette-gold-hover)] after:origin-bottom-right hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:duration-300"
                >
                  Contact Us
                </Link>
              </div>
            </div>

            {/* Middle 2: Contact Details */}
            <div className="flex flex-col items-start text-left md:col-span-5 md:pl-4 lg:pl-8 xl:pl-16">
              <div className="flex min-w-0 flex-col items-start gap-5 sm:flex-row sm:items-stretch sm:gap-3 md:gap-4">
                {/* Address (Left) */}
                <div className="flex flex-col gap-2">
                  <p className="font-sans text-neutral-600 text-sm md:text-base font-bold uppercase drop-shadow-sm">
                    VISIT US
                  </p>
                  <div className="flex flex-col text-neutral-900 text-sm md:text-base font-sans leading-relaxed">
                    {BRAND.address.lines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="hidden w-px bg-neutral-900 opacity-20 sm:block sm:self-stretch md:mx-2"></div>

                {/* Contact (Right) */}
                <div className="flex flex-col gap-2">
                  <p className="font-sans text-neutral-600 text-sm md:text-base font-bold uppercase drop-shadow-sm">
                    CONTACT US
                  </p>
                  <div className="flex flex-col gap-1 text-neutral-900 text-sm md:text-base font-sans leading-relaxed">
                    <a
                      href={BRAND.contact.phoneHref}
                      className="relative transition-all duration-300 hover:translate-x-1.5 opacity-80 hover:opacity-100 hover:text-[var(--palette-gold-hover)] w-fit after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1px] after:-bottom-0.5 after:left-0 after:bg-[var(--palette-gold-hover)] after:origin-bottom-right hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:duration-300"
                    >
                      Tel: {BRAND.contact.phone}
                    </a>
                    <a
                      href={BRAND.contact.emailHref}
                      className="relative w-fit break-all opacity-80 transition-all duration-300 hover:translate-x-1.5 hover:text-[var(--palette-gold-hover)] hover:opacity-100 after:absolute after:-bottom-0.5 after:left-0 after:h-[1px] after:w-full after:origin-bottom-right after:scale-x-0 after:bg-[var(--palette-gold-hover)] after:transition-transform after:duration-300 after:content-[''] hover:after:origin-bottom-left hover:after:scale-x-100"
                    >
                      {BRAND.contact.email}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Socials */}
            <div className="flex flex-col gap-3 items-start text-left md:col-span-2 md:items-end md:text-right md:justify-self-end">
              <div className="flex flex-col gap-1 md:items-end">
                <p className="font-sans text-neutral-600 text-sm md:text-base font-bold uppercase drop-shadow-sm">
                  FOLLOW US
                </p>
                <p className="text-neutral-900 text-sm md:text-base font-sans opacity-90">
                  Join our community.
                </p>
              </div>
              <SocialLinks variant="footer" className="mt-1 md:justify-end" />
            </div>
          </div>
        </div>

        {/* Bottom Legal Bar */}
        <div className="mt-2 flex flex-col items-center justify-between gap-3 border-t border-neutral-900/10 px-4 py-2 text-center font-sans text-sm text-neutral-900 sm:gap-4 md:flex-row md:px-12 md:text-left md:text-base">
          <p>&copy; 2026 {BRAND.legalName}. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 md:justify-end">
            <Link
              href="/terms"
              className="relative transition-all duration-300 opacity-80 hover:opacity-100 hover:text-[var(--palette-gold-hover)] hover:drop-shadow-[0_0_4px_color-mix(in_srgb,var(--palette-gold)_50%,transparent)] after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1px] after:-bottom-0.5 after:left-0 after:bg-[var(--palette-gold-hover)] after:origin-bottom-right hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:duration-300"
            >
              Terms & Condition
            </Link>
            <Link
              href="/policies"
              className="relative transition-all duration-300 opacity-80 hover:opacity-100 hover:text-[var(--palette-gold-hover)] hover:drop-shadow-[0_0_4px_color-mix(in_srgb,var(--palette-gold)_50%,transparent)] after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-[1px] after:-bottom-0.5 after:left-0 after:bg-[var(--palette-gold-hover)] after:origin-bottom-right hover:after:origin-bottom-left hover:after:scale-x-100 after:transition-transform after:duration-300"
            >
              Event Policies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
