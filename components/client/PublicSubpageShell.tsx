import type { ReactNode } from 'react';

import { publicPageHeroes, type PublicPageHeroKey } from '@/config/public-page-heroes';
import { cn } from '@/lib/class-names';
import FadeIn from '@/components/shared/FadeIn';
import SubpageHero from './SubpageHero';

type PublicSubpageShellProps = {
  heroKey: PublicPageHeroKey;
  videoSrc?: string;
  children: ReactNode;
  className?: string;
};

export default function PublicSubpageShell({
  heroKey,
  videoSrc,
  children,
  className,
}: PublicSubpageShellProps) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn('public-page responsive-page relative flex flex-col bg-transparent', className)}
    >
      <SubpageHero slides={publicPageHeroes[heroKey]} videoSrc={videoSrc} />
      <FadeIn direction="up" className="w-full">
        {children}
      </FadeIn>
    </main>
  );
}
