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
 * runs, a block that starts below the fold is hidden until it scrolls into view. With `once` it
 * stays revealed after that; without it, it hides again when it leaves the viewport.
 */
export default function FadeIn({
  children,
  delay = 0,
  className = '',
  direction = 'up',
  once = false,
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

  const verticalOffset =
    direction === 'up' || direction === 'down' ? (exitEdge === 'top' ? '-1.5rem' : '1.5rem') : '0';

  return (
    <div
      ref={domRef}
      className={`reveal ${className}`}
      data-visible={isVisible || reducedMotion}
      style={
        {
          '--reveal-delay': `${Math.min(Math.max(delay, 0), 220)}ms`,
          '--reveal-x': direction === 'left' ? '1.25rem' : direction === 'right' ? '-1.25rem' : '0',
          '--reveal-y': verticalOffset,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
