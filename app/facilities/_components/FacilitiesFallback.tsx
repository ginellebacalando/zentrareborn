import CinematicPageHero from '@/components/client/CinematicPageHero';
import FacilitiesShowcase from '@/components/client/FacilitiesShowcase';
import { publicPageHeroes } from '@/config/public-page-heroes';

export default function FacilitiesFallback() {
  const facilitiesHero = publicPageHeroes.facilities[0];

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="public-page responsive-page relative flex min-h-screen flex-col bg-transparent"
    >
      <CinematicPageHero
        title={facilitiesHero.title}
        subtitle={facilitiesHero.subtitle}
        slides={publicPageHeroes.facilities}
        videoSrc="/videos/hero/facilities-hero.mp4"
      />
      <div className="relative z-10 w-full bg-transparent">
        <FacilitiesShowcase />
      </div>
    </main>
  );
}
