'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

interface AnimatedNumberProps {
  end: number;
  suffix?: string;
  duration?: number;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export default function AnimatedNumber({ end, suffix = '', duration = 1100 }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const [rolled, setRolled] = useState(false);

  useEffect(() => {
    if (reducedMotion || !('IntersectionObserver' in window)) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setRolled(entry.isIntersecting);
        });
      },
      { threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const chars = String(end).split('');

  if (reducedMotion) {
    return (
      <span ref={ref} className="inline-flex items-baseline tabular-nums">
        {end}
        {suffix}
      </span>
    );
  }

  return (
    <span ref={ref} className="inline-flex items-baseline tabular-nums">
      <span className="sr-only">
        {end}
        {suffix}
      </span>
      <span aria-hidden="true" className="inline-flex items-baseline">
        {chars.map((char, index) => {
          const numeric = Number(char);
          if (Number.isNaN(numeric)) {
            return <span key={`${index}-${char}`}>{char}</span>;
          }
          return (
            <span
              key={`${index}-${char}`}
              className="relative inline-block h-[1.15em] overflow-hidden align-bottom leading-[1.15]"
            >
              <span
                className="flex flex-col transition-transform ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
                style={{
                  transitionDuration: `${duration}ms`,
                  transitionDelay: `${index * 110}ms`,
                  transform: rolled
                    ? `translate3d(0, -${numeric * 10}%, 0)`
                    : 'translate3d(0, 0, 0)',
                }}
              >
                {DIGITS.map((digit) => (
                  <span key={digit} className="block h-[1.15em] leading-[1.15]">
                    {digit}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
        {suffix && (
          <span
            className="inline-block transition-all duration-500 ease-out"
            style={{
              transitionDelay: `${chars.length * 100}ms`,
              opacity: rolled ? 1 : 0,
              transform: rolled ? 'translate3d(0, 0, 0)' : 'translate3d(0, 0.35em, 0)',
            }}
          >
            {suffix}
          </span>
        )}
      </span>
    </span>
  );
}
