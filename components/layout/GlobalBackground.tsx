'use client';

import React from 'react';

export default function GlobalBackground() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 w-full h-full -z-50 pointer-events-none overflow-hidden bg-surface"
    >
      {/* Warm Papaya Whip & Soft Peach ambient washes over Ivory Mist */}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-zion-bg/55 via-transparent to-zion-bg/40"></div>
      <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[var(--palette-gold-soft)]/50 via-transparent to-transparent"></div>
      <div className="absolute inset-0 w-full h-full bg-gradient-to-bl from-[var(--palette-gold-soft)]/45 via-transparent to-zion-accent/10"></div>
    </div>
  );
}
