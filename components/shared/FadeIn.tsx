'use client';

import React, { type CSSProperties, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  once?: boolean;
}

/**
 * Scroll reveal. Content renders visible (server, no script, reduced motion); once the observer
 * runs, a block that starts below the fold is hidden until it scrolls into view, then fades in and
 * rises --motion-rise. It animates once; `once={false}` hides it again when it leaves the view.
 */
export default function FadeIn({
  children,
  delay = 0,
  className = '',
  direction = 'up',
  once = true,
}: FadeInProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [exitEdge, setExitEdge] = useState<'top' | 'bottom'>('bottom');
  const domRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setExitEdge(entry.boundingClientRect.top < 0 ? 'top' : 'bottom');
            setIsVisible(false);
          } else if (entry.boundingClientRect.top >= window.innerHeight) {
            // Still entirely below the fold: hide it now, out of sight, so it can rise in later.
            setIsVisible(false);
          }
        });
      },
      { threshold: 0, rootMargin: '-10% 0px -10% 0px' },
    );

    if (domRef.current) {
      observer.observe(domRef.current);
    }

    return () => observer.disconnect();
  }, [once, reducedMotion]);

  const rise = 'var(--motion-rise)';
  const fall = 'calc(var(--motion-rise) * -1)';
  const verticalOffset =
    direction === 'up' || direction === 'down' ? (exitEdge === 'top' ? fall : rise) : '0';

  return (
    <div
      ref={domRef}
      className={`reveal ${className}`}
      data-visible={isVisible || reducedMotion}
      style={
        {
          '--reveal-delay': `${Math.min(Math.max(delay, 0), 220)}ms`,
          '--reveal-x': direction === 'left' ? rise : direction === 'right' ? fall : '0',
          '--reveal-y': verticalOffset,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
