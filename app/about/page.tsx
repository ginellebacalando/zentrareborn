import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Leaf, CalendarCheck, Award, ShieldCheck, Clock } from 'lucide-react';

import AboutMomentsBanner from '@/components/client/AboutMomentsBanner';
import CinematicPageHero from '@/components/client/CinematicPageHero';
import TestimonialSection from '@/components/client/TestimonialSection';
import FadeIn from '@/components/shared/FadeIn';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import AnimatedDivider from '@/components/shared/AnimatedDivider';
import PublishedManagedContentSection from '@/components/public-content/PublishedManagedContentSection';
import { publicPageHeroes } from '@/config/public-page-heroes';

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
          <div className="absolute top-0 right-10 w-64 h-64 bg-zion-accent/5 rounded-full blur-3xl -z-10" />

          <div className="flex flex-col lg:flex-row gap-12 items-center">
            <FadeIn direction="right" className="flex-1 w-full relative">
              <div className="relative z-10 p-2 md:p-3 bg-surface/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_20px_40px_-15px_color-mix(in_srgb,var(--palette-gold)_15%,transparent)] transform -rotate-3 hover:rotate-0 hover:scale-[1.02] transition-all duration-700 ease-in-out">
                <Image
                  src="/images/about/about-story-2.webp"
                  alt="Zion Indoor Hall Setup"
                  width={1200}
                  height={1600}
                  className="w-full h-[450px] md:h-[650px] object-cover rounded-2xl"
                />
              </div>
              <div className="absolute -bottom-8 -right-8 w-2/3 h-64 md:h-80 z-20 hidden md:block transform rotate-6 hover:rotate-0 hover:scale-110 hover:-translate-y-4 hover:-translate-x-2 transition-all duration-700 ease-in-out hover:z-30">
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
                href="/contact"
                className="group relative inline-flex items-center gap-4 px-10 py-4 bg-transparent border border-[var(--palette-night-subtle)] text-ink font-sans text-sm font-bold uppercase tracking-widest overflow-hidden rounded-full transition-all hover:border-zion-accent hover:shadow-[0_0_20px_color-mix(in_srgb,var(--palette-gold)_30%,transparent)]"
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
        <section className="w-full py-8 md:py-16 relative z-20 border-y border-zion-accent/20 bg-surface/30 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 md:px-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:gap-y-12 md:gap-y-0 md:divide-x divide-[var(--palette-gold-hover)]/30">
              {[
                { end: 12, suffix: '+', label: 'Years of Excellence', delay: 0 },
                { end: 400, suffix: '+', label: 'Happy Customers', delay: 100 },
                { end: 500, suffix: '+', label: 'Events Organized', delay: 200 },
                { end: 98, suffix: '%', label: 'Client Satisfaction', delay: 300 },
              ].map((stat, i) => (
                <FadeIn key={i} direction="up" delay={stat.delay} className="w-full">
                  <div className="w-full py-8 md:py-4 flex flex-col items-center justify-center text-center group cursor-default">
                    <span className="text-5xl md:text-6xl font-sahitya text-ink mb-3 transition-all duration-500 group-hover:-translate-y-2 group-hover:text-accent-ink drop-shadow-sm">
                      <AnimatedNumber end={stat.end} suffix={stat.suffix} />
                    </span>
                    <span className="text-xs md:text-sm font-serif font-bold uppercase tracking-[0.2em] text-muted transition-colors duration-500 group-hover:text-ink leading-relaxed">
                      {stat.label}
                    </span>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Advantages - Grid of Elegant Cards */}
        <section className="max-w-7xl mx-auto px-4 md:px-12 py-16 md:py-20">
          <FadeIn direction="up" className="flex flex-col items-center text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-6 bg-surface/60 border border-white px-6 py-2 rounded-full shadow-sm">
              <Star className="w-4 h-4 text-accent-ink" />
              <p className="eyebrow text-accent-ink">Our Advantages</p>
              <Star className="w-4 h-4 text-accent-ink" />
            </div>
            <h2 className="text-4xl md:text-6xl font-sahitya text-ink">Why Choose Zion?</h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Star,
                title: 'Premium Venue',
                desc: 'Meticulously designed interiors featuring elegant finishes and adaptable layouts for any occasion.',
              },
              {
                icon: Leaf,
                title: 'Sustainable Celebrations',
                desc: 'Partnering with eco-conscious caterers and local suppliers to minimize our environmental footprint.',
              },
              {
                icon: CalendarCheck,
                title: 'Seamless Planning',
                desc: 'Comprehensive event packages and coordination assistance to ensure a stress-free experience.',
              },
              {
                icon: Award,
                title: 'Award-Winning Aesthetic',
                desc: 'A stunning architectural backdrop recognized for its unique blend of modern style and comfort.',
              },
              {
                icon: ShieldCheck,
                title: 'Satisfaction Guarantee',
                desc: 'Our commitment to excellence ensures your event runs smoothly, backed by a dedicated service pledge.',
              },
              {
                icon: Clock,
                title: 'Expert Coordination 24/7',
                desc: 'Our dedicated team of event specialists is always available to assist with your planning needs.',
              },
            ].map((adv, i) => (
              <FadeIn key={i} delay={i * 100} direction="up">
                <div className="group h-full bg-surface/40 backdrop-blur-md border border-white shadow-sm hover:shadow-[0_20px_40px_-15px_color-mix(in_srgb,var(--palette-gold)_20%,transparent)] rounded-3xl p-8 md:p-10 flex flex-col items-center text-center transition-all duration-500 hover:-translate-y-2">
                  <div className="w-20 h-20 bg-gradient-to-br from-[var(--palette-gold-soft)] to-white rounded-2xl flex items-center justify-center mb-8 shadow-inner border border-zion-accent/20 group-hover:scale-110 transition-transform duration-500">
                    <adv.icon className="w-8 h-8 text-accent-ink" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-sahitya text-2xl mb-4 text-ink">{adv.title}</h3>
                  <p className="font-serif text-muted leading-relaxed">{adv.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
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
              <div className="relative p-2 md:p-3 bg-surface/60 backdrop-blur-sm border border-white rounded-3xl shadow-xl">
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
            <Link
              href="/contact"
              className="group relative inline-flex items-center justify-center px-12 py-5 bg-[var(--palette-night-subtle)] text-white font-sans text-sm font-bold uppercase tracking-[0.2em] overflow-hidden rounded-full transition-all shadow-[0_15px_30px_-10px_color-mix(in_srgb,var(--palette-night)_40%,transparent)] hover:shadow-[0_20px_40px_-15px_color-mix(in_srgb,var(--palette-gold)_50%,transparent)]"
            >
              <div className="absolute inset-0 bg-[var(--palette-client-button)] transition-transform duration-500 ease-in-out translate-y-full group-hover:translate-y-0" />
              <span className="relative z-10 transition-colors duration-500 group-hover:text-ink">
                CONTACT OUR TEAM
              </span>
            </Link>
          </FadeIn>
        </section>
      </div>
    </main>
  );
}
