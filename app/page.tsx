import HeroSection from '@/components/client/HeroSection';
import SpacesSection from '@/components/client/SpacesSection';
import FeaturesSection from '@/components/client/FeaturesSection';
import TestimonialSection from '@/components/client/TestimonialSection';
import PartnersSection from '@/components/client/PartnersSection';
import FadeIn from '@/components/shared/FadeIn';

export default function Home() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="public-page relative flex min-h-screen flex-col bg-transparent"
    >
      {/* Hero section stays transparent and behind the scrolling content */}
      <HeroSection />

      {/* Container holding all lower sections. Has a solid background and sits above the hero background. */}
      <div className="relative z-10 bg-transparent w-full">
        <FadeIn direction="up">
          <SpacesSection />
        </FadeIn>
        <FadeIn direction="up">
          <FeaturesSection />
        </FadeIn>
        <FadeIn direction="up">
          <TestimonialSection />
        </FadeIn>
        <FadeIn direction="up">
          <PartnersSection />
        </FadeIn>
      </div>
    </main>
  );
}
