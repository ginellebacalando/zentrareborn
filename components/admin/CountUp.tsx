'use client';

import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';

/**
 * A figure that counts up to its value (and glides to a new one), like the KPI numbers in Metis.
 * Decorative: the surrounding card or link carries the exact value in its accessible name. Under
 * reduced motion the value appears at once. `format` must be a stable function.
 */
export default function CountUp({
  value,
  format,
}: {
  value: number;
  format: (value: number) => string;
}) {
  const reduced = useReducedMotion();
  const current = useMotionValue(reduced ? value : 0);
  const text = useTransform(current, (latest) => format(latest));
  useEffect(() => {
    if (reduced) {
      current.set(value);
      return;
    }
    const controls = animate(current, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [current, reduced, value]);
  return <motion.span aria-hidden="true">{text}</motion.span>;
}
