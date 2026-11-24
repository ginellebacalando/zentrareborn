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
            if (once && domRef.current) observer.unobserve(domRef.current);
          } else if (!once) {
            setExitEdge(entry.boundingClientRect.top < 0 ? 'top' : 'bottom');
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
    direction === 'up' || direction === 'down'
      ? exitEdge === 'top'
        ? '-2.25rem'
        : '2.25rem'
      : '0';

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
