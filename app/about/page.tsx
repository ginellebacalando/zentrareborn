import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

import AboutMomentsBanner from '@/components/client/AboutMomentsBanner';
import CinematicPageHero from '@/components/client/CinematicPageHero';
import TestimonialSection from '@/components/client/TestimonialSection';
import FadeIn from '@/components/shared/FadeIn';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import AnimatedDivider from '@/components/shared/AnimatedDivider';
import PublishedManagedContentSection from '@/components/public-content/PublishedManagedContentSection';
import { publicPageHeroes } from '@/config/public-page-heroes';
import { ButtonLink } from '@/components/shared/Button';

/** Concrete reasons to choose Zion, worded from the venue's published FAQ and Zeni's venue topic. */
const VENUE_FACTS = [
  {
    title: 'One event per day',
    text: 'Your celebration has the venue to itself, with up to 15 hours of access for preparations, styling and the event.',
  },
  {
    title: 'Ready for rain',
    text: 'An outdoor event can move indoors to Selah Hall, an add-on for Classic Package clients.',
  },
  {
    title: 'Air-conditioned program',
    text: 'Air-conditioning is included for five hours during the formal event program.',
  },
  {
    title: 'Backup power',
    text: 'A generator keeps the Reception Hall, sound system, lights, LED wall and fans running during an outage.',
  },
  {
    title: 'Parking for 45 vehicles',
    text: 'On-site parking, with attendants on duty during your event.',
  },
  {
    title: 'Coordination included',
    text: 'Our coordination team runs your program and, for weddings, also covers the church ceremony flow.',
  },
] as const;

export const dynamic = 'force-dynamic';

export default function AboutPage() {
  const aboutHero = publicPageHeroes.about[0];

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="public-page responsive-page relative flex min-h-screen flex-col bg-transparent"
    >
      <CinematicPageHero
        title={aboutHero.title}
        subtitle={aboutHero.subtitle}
        slides={publicPageHeroes.about}
        videoSrc="/videos/hero/about-hero.mp4"
      />
      <div className="w-full relative z-10 bg-transparent pb-6">
        <PublishedManagedContentSection type="ABOUT" label="Published About Zion information" />

        {/* Story Section - Modern Asymmetric Layout */}
        <section
          id="about-story"
          className="scroll-mt-24 max-w-7xl mx-auto px-4 md:px-12 py-16 md:py-20 relative"
        >
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            <FadeIn direction="right" className="flex-1 w-full relative">
              <div className="relative z-10 p-2 md:p-3 bg-surface rounded-3xl border border-white/60 transform -rotate-3 hover:rotate-0 hover:scale-[1.02] transition-all duration-700 ease-in-out">
                <Image
                  src="/images/about/about-story-2.webp"
                  alt="Zion Indoor Hall Setup"
                  width={1200}
                  height={1600}
                  className="w-full h-[450px] md:h-[650px] object-cover rounded-2xl"
                />
              </div>
              <div className="absolute -bottom-8 -right-8 w-2/3 h-64 md:h-80 z-20 hidden md:block transform rotate-6 hover:rotate-0 transition-all duration-700 ease-in-out hover:z-30">
                <Image
                  src="/images/venue/bg2.webp"
                  alt="Zion Outdoor Stage Setup"
                  fill
                  sizes="(min-width: 768px) 33vw, 0px"
                  className="w-full h-full object-cover rounded-2xl shadow-2xl border-4 border-white"
                />
              </div>
            </FadeIn>

            <FadeIn direction="left" delay={200} className="flex-1 w-full lg:pl-10 mt-12 lg:mt-0">
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="h-[1px] w-12 bg-zion-accent"></div>
                <p className="eyebrow text-accent-ink">Our Journey</p>
              </div>
              <h2 className="text-4xl md:text-6xl font-sahitya text-ink mb-8 leading-tight">
                The Zion Events
                <br />
                Place Story
              </h2>
              <p className="font-serif text-lg text-muted leading-relaxed mb-6">
                Founded on the belief that every celebration deserves an extraordinary backdrop,
                Zion Events Place was designed to blend breathtaking natural scenery with
                sophisticated architecture.
              </p>
              <p className="font-serif text-lg text-muted leading-relaxed mb-10">
                What began as a passion for hosting intimate gatherings has blossomed into San Pedro
                City&apos;s premier venue, where meticulous attention to detail meets unparalleled
                elegance to bring your grandest visions to life.
              </p>

              <Link
                href="/booking"
                className="group relative inline-flex items-center gap-4 px-10 py-4 bg-transparent border border-[var(--palette-night-subtle)] text-ink font-sans text-sm font-bold uppercase tracking-widest overflow-hidden rounded-full transition-all hover:border-zion-accent"
              >
                <div className="absolute inset-0 bg-[var(--palette-night-subtle)] transition-transform duration-500 ease-in-out -translate-x-full group-hover:translate-x-0" />
                <span className="relative z-10 transition-colors duration-500 group-hover:text-white">
                  Start Planning
                </span>
                <span className="relative z-10 transition-transform duration-500 group-hover:translate-x-1 group-hover:text-white">
                  →
                </span>
              </Link>
            </FadeIn>
          </div>
        </section>

        {/* Stats Section - Minimalist Elegance */}
        <section className="w-full py-8 md:py-16 relative z-20 border-y border-zion-accent/20 bg-surface">
          <div className="max-w-7xl mx-auto px-4 md:px-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:gap-y-12 md:gap-y-0 md:divide-x divide-[var(--palette-gold-hover)]/30">
              {[
                { end: 12, suffix: '+', label: 'Years of Excellence', delay: 0 },
                { end: 400, suffix: '+', label: 'Happy Customers', delay: 100 },
                { end: 500, suffix: '+', label: 'Events Organized', delay: 200 },
                { end: 98, suffix: '%', label: 'Client Satisfaction', delay: 300 },
              ].map((stat, i) => (
                <FadeIn key={i} direction="up" delay={stat.delay} className="w-full">
                  <div className="w-full py-8 md:py-4 flex flex-col items-center justify-center text-center">
                    <span className="text-5xl md:text-6xl font-sahitya text-ink mb-3">
                      <AnimatedNumber end={stat.end} suffix={stat.suffix} />
                    </span>
                    <span className="text-xs md:text-sm font-serif font-bold uppercase tracking-[0.2em] text-muted leading-relaxed">
                      {stat.label}
                    </span>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Why Zion: facts the venue already publishes (FAQ and Zeni's venue topic), not slogans. */}
        <section className="max-w-7xl mx-auto px-4 md:px-12 py-16 md:py-20">
          <FadeIn direction="up" className="mb-12 text-center">
            <h2 className="text-4xl md:text-6xl font-sahitya text-ink">Why Choose Zion?</h2>
          </FadeIn>
          <ul className="grid grid-cols-1 gap-x-12 md:grid-cols-2 lg:grid-cols-3">
            {VENUE_FACTS.map((fact) => (
              <li key={fact.title} className="border-t border-zion-accent/25 py-6">
                <h3 className="font-sahitya text-2xl text-ink">{fact.title}</h3>
                <p className="mt-2 font-serif leading-relaxed text-muted">{fact.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Full width video banner with Zion logo outro */}
        <AboutMomentsBanner videoSrc="/videos/hero/about-hero.mp4" />

        {/* Founders Section */}
        <section className="max-w-7xl mx-auto px-4 md:px-12 pt-4 pb-16 md:pt-6 md:pb-20">
          <div className="flex flex-col-reverse md:flex-row gap-12 items-start">
            <FadeIn direction="right" className="flex-1 md:mt-16">
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="h-[1px] w-12 bg-zion-accent"></div>
                <p className="eyebrow text-accent-ink">Our Founders</p>
              </div>
              <h2 className="text-4xl md:text-6xl font-sahitya text-ink mb-6 leading-tight">
                Visionaries of Elegance
              </h2>
              <p className="font-serif text-lg text-muted leading-relaxed mb-6">
                Driven by a shared passion for hospitality and design, our founders established Zion
                Events Place to redefine the standard for luxury celebrations in San Pedro City.
              </p>
              <p className="font-serif text-lg text-muted leading-relaxed">
                With decades of combined experience in event management, they have cultivated a
                dedicated team that shares their unwavering commitment to excellence, ensuring that
                every occasion hosted at Zion is nothing short of perfection.
              </p>
            </FadeIn>
            <FadeIn direction="left" className="flex-1 w-full md:mt-12">
              <div className="relative p-2 md:p-3 bg-surface border border-white rounded-3xl shadow-xl">
                <Image
                  src="/images/about/founders.webp"
                  alt="Founders"
                  width={1200}
                  height={1600}
                  className="w-full h-[450px] md:h-[600px] object-cover rounded-2xl"
                />
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Testimonials */}
        <section className="w-full bg-transparent py-4">
          <TestimonialSection />
        </section>

        {/* Grand CTA */}
        <section className="max-w-4xl mx-auto px-4 pt-6 pb-12 flex flex-col items-center text-center">
          <FadeIn direction="up" className="flex flex-col items-center">
            <AnimatedDivider delay={300} className="w-32 h-1 bg-zion-accent mb-4" />
            <h2 className="text-5xl md:text-7xl font-sahitya text-ink mb-6 leading-tight">
              Ready to Bring Your
              <br />
              Vision to Life?
            </h2>
            <p className="font-serif text-xl md:text-2xl text-muted mb-8 max-w-2xl">
              Discover a breathtaking setting where your special moments become lasting,
              unforgettable memories.
            </p>
            <ButtonLink href="/contact" variant="primary" size="lg">
              Contact our team
            </ButtonLink>
          </FadeIn>
        </section>
      </div>
    </main>
  );
}
