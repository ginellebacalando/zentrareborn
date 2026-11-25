import HeroSection from '@/components/client/HeroSection';
import ArchiveSection from '@/components/home/ArchiveSection';
import EventPackagesSection from '@/components/home/EventPackagesSection';
import AvailabilitySection from '@/components/home/AvailabilitySection';
import ReviewsSection from '@/components/home/ReviewsSection';
import FaqSection from '@/components/home/FaqSection';
import ContactSection from '@/components/home/ContactSection';
import FadeIn from '@/components/shared/FadeIn';

/** Home, in the order of the team's Figma home frame. */
export default function Home() {
  return (
    <main id="main-content" tabIndex={-1} className="public-page relative flex flex-col">
      <HeroSection />
      <FadeIn direction="up" once>
        <ArchiveSection />
      </FadeIn>
      <FadeIn direction="up" once>
        <EventPackagesSection />
      </FadeIn>
      <FadeIn direction="up" once>
        <AvailabilitySection />
      </FadeIn>
      <FadeIn direction="up" once>
        <ReviewsSection />
      </FadeIn>
      <FadeIn direction="up" once>
        <FaqSection />
      </FadeIn>
      <FadeIn direction="up" once>
        <ContactSection />
      </FadeIn>
    </main>
  );
}
