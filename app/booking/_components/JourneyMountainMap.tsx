'use client';

import { Check, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';

import styles from './BookingJourney.module.css';

type MapPhase = 'journey' | 'loading' | 'summary';
type StepNumber = 1 | 2 | 3 | 4 | 5;

interface StepDescriptor {
  readonly step: StepNumber;
  readonly code: string;
  readonly milestoneTitle: string;
}

const BASE_STEPS: readonly StepDescriptor[] = [
  { step: 1, code: 'Step 1', milestoneTitle: 'Celebration' },
  { step: 2, code: 'Step 2', milestoneTitle: 'Package & Guests' },
  { step: 3, code: 'Step 3', milestoneTitle: 'Date & Budget' },
  { step: 4, code: 'Step 4', milestoneTitle: 'Client Details' },
  { step: 5, code: 'Step 5', milestoneTitle: 'Final Review' },
] as const;

const EVENT_EMOTE_SETS: Record<string, readonly [string, string, string, string, string]> = {
  Wedding: ['💍', '🏛️', '💐', '💌', '🥂'],
  Debut: ['👑', '✨', '🌹', '💌', '💃'],
  Birthday: ['🎂', '🎈', '🎁', '💌', '🎉'],
  Christening: ['🕊️', '🌿', '🕯️', '💌', '🤍'],
  'Christmas Party': ['🎄', '❄️', '🎁', '💌', '🥂'],
  'Gender Reveal': ['🎀', '🌤️', '🧁', '💌', '🎊'],
};

const DEFAULT_EMOTES: readonly [string, string, string, string, string] = [
  '✨',
  '🎨',
  '📅',
  '📝',
  '🥂',
];

// Dense 16-crest rolling wave path (seamless period = 200 units across 400 viewBox)
const BACK_WAVE_PATH =
  'M 0 8 Q 12.5 1.5, 25 8 T 50 8 T 75 8 T 100 8 T 125 8 T 150 8 T 175 8 T 200 8 T 225 8 T 250 8 T 275 8 T 300 8 T 325 8 T 350 8 T 375 8 T 400 8 L 400 28 L 0 28 Z';
const MID_WAVE_PATH =
  'M 0 10 Q 12.5 2.5, 25 10 T 50 10 T 75 10 T 100 10 T 125 10 T 150 10 T 175 10 T 200 10 T 225 10 T 250 10 T 275 10 T 300 10 T 325 10 T 350 10 T 375 10 T 400 10 L 400 28 L 0 28 Z';
const FRONT_WAVE_PATH =
  'M 0 11.5 Q 12.5 4.5, 25 11.5 T 50 11.5 T 75 11.5 T 100 11.5 T 125 11.5 T 150 11.5 T 175 11.5 T 200 11.5 T 225 11.5 T 250 11.5 T 275 11.5 T 300 11.5 T 325 11.5 T 350 11.5 T 375 11.5 T 400 11.5 L 400 28 L 0 28 Z';
const CREST_LINE_PATH =
  'M 0 11.5 Q 12.5 4.5, 25 11.5 T 50 11.5 T 75 11.5 T 100 11.5 T 125 11.5 T 150 11.5 T 175 11.5 T 200 11.5 T 225 11.5 T 250 11.5 T 275 11.5 T 300 11.5 T 325 11.5 T 350 11.5 T 375 11.5 T 400 11.5';

interface JourneyMountainMapProps {
  phase: MapPhase;
  currentStep: StepNumber;
  highestUnlocked: StepNumber;
  progressPercent: number;
  selectedEventType: string;
  onSelectStep: (step: StepNumber) => void;
}

export default function JourneyMountainMap({
  phase,
  currentStep,
  highestUnlocked,
  progressPercent,
  selectedEventType,
  onSelectStep,
}: JourneyMountainMapProps) {
  const activeEmotes = EVENT_EMOTE_SETS[selectedEventType] ?? DEFAULT_EMOTES;

  // Completed steps remain solidly filled; ONLY the active segment from the previous step
  // surges forward toward the current ongoing step (e.g. Step 3 -> Step 4 = 50% -> 75%).
  const isComplete = phase !== 'journey';
  const surgeStartPercent = isComplete ? 100 : currentStep === 1 ? 2 : (currentStep - 2) * 25;
  const surgeTargetPercent = isComplete ? 100 : currentStep === 1 ? 14 : (currentStep - 1) * 25;

  const surgeStyle = {
    '--surge-start': `${surgeStartPercent}%`,
    '--surge-target': `${surgeTargetPercent}%`,
  } as CSSProperties;

  return (
    <section
      aria-label="Booking journey progress"
      className="mb-8 overflow-hidden rounded-[2rem] border border-[var(--palette-gold)]/30 bg-[var(--palette-paper)]/95 p-5 shadow-[0_22px_54px_-28px_color-mix(in_srgb,var(--palette-ink)_22%,transparent)] backdrop-blur-md sm:p-7"
    >
      {/* Clean progress percentage indicator */}
      <div className="mb-4 flex items-center justify-end gap-2">
        <Sparkles className="h-4 w-4 text-[var(--palette-gold-ink)]" aria-hidden="true" />
        <span className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]">
          {selectedEventType ? `${selectedEventType} · ` : ''}
          {progressPercent}% Complete
        </span>
      </div>

      {/* Straight Glass Tube Spanning Exact Step 1 -> Step 5 Centers With Multi-Wave Flowing Water */}
      <div className="relative pt-6 pb-2">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[2.85rem] right-[10%] left-[10%] hidden h-6 overflow-hidden rounded-full border border-[var(--palette-gold)]/40 bg-[var(--palette-paper)]/95 shadow-[inset_0_2px_6px_color-mix(in_srgb,var(--palette-ink)_14%,transparent)] md:block"
        >
          {/* Water body: solidly filled up to previous step, actively surging toward the current step */}
          <div
            key={`${phase}-${currentStep}`}
            style={surgeStyle}
            className={`${
              isComplete ? styles.liquidFillComplete : styles.liquidFillSurging
            } relative h-full overflow-hidden rounded-full`}
          >
            {/* Solid lower water floor so troughs stay deep and waves remain clearly visible above */}
            <div className="absolute inset-x-0 top-3 bottom-0 bg-gradient-to-b from-[var(--palette-booklet-cover)] to-[var(--palette-gold)]" />

            {/* Wave Layer 1: Deep amber back current */}
            <svg
              viewBox="0 0 400 28"
              preserveAspectRatio="none"
              className={`${styles.liquidWaveSvg} ${styles.liquidWaveBack}`}
            >
              <path d={BACK_WAVE_PATH} fill="var(--palette-gold)" opacity="0.58" />
            </svg>

            {/* Wave Layer 2: Rich golden-honey mid current */}
            <svg
              viewBox="0 0 400 28"
              preserveAspectRatio="none"
              className={`${styles.liquidWaveSvg} ${styles.liquidWaveMid}`}
            >
              <defs>
                <linearGradient id="zionWaterMidGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--palette-client-section)" />
                  <stop offset="100%" stopColor="var(--palette-gold)" />
                </linearGradient>
              </defs>
              <path d={MID_WAVE_PATH} fill="url(#zionWaterMidGrad)" opacity="0.92" />
            </svg>

            {/* Wave Layer 3: Sunlit front rolling current */}
            <svg
              viewBox="0 0 400 28"
              preserveAspectRatio="none"
              className={`${styles.liquidWaveSvg} ${styles.liquidWaveFront}`}
            >
              <defs>
                <linearGradient id="zionWaterFrontGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--palette-booklet-cover)" />
                  <stop offset="65%" stopColor="var(--palette-client-section)" />
                  <stop offset="100%" stopColor="var(--palette-gold-ink)" stopOpacity="0.65" />
                </linearGradient>
              </defs>
              <path d={FRONT_WAVE_PATH} fill="url(#zionWaterFrontGrad)" />
            </svg>

            {/* Crisp white surface foam ripple along the front crests */}
            <svg
              viewBox="0 0 400 28"
              preserveAspectRatio="none"
              className={`${styles.liquidWaveSvg} ${styles.liquidWaveFront}`}
            >
              <path
                d={CREST_LINE_PATH}
                fill="none"
                stroke="var(--palette-white)"
                strokeWidth="1.9"
                opacity="0.88"
              />
            </svg>

            {/* Directional shimmer & micro-bubbles */}
            <span className={styles.liquidCurrentShimmer} />
            <span className={styles.liquidBubbles} />
          </div>

          {/* Top glass tube specular reflection */}
          <span className="pointer-events-none absolute inset-x-3 top-0.5 h-1 rounded-full bg-[var(--palette-white)]/60" />
        </div>

        {/* 5 Dynamic Event-Matched Step Nodes */}
        <ol className="relative z-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 md:gap-0">
          {BASE_STEPS.map((node, index) => {
            const emoji = activeEmotes[index];
            const isCompleted = phase !== 'journey' || node.step < currentStep;
            const isCurrent = phase === 'journey' && node.step === currentStep;
            const isUnlocked = phase === 'journey' && node.step <= highestUnlocked;

            return (
              <li key={node.step} className="relative flex flex-col items-center text-center">
                {isCurrent ? (
                  <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-zentra-green px-2.5 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-on-action)] shadow-sm">
                    You are here
                  </span>
                ) : null}

                <button
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => onSelectStep(node.step)}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`${node.code}: ${node.milestoneTitle}`}
                  className={`group flex w-full flex-col items-center rounded-2xl px-2 py-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palette-gold-ink)] ${
                    isUnlocked ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <span
                    className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 text-2xl transition-all duration-300 sm:h-16 sm:w-16 ${
                      isCurrent
                        ? `${styles.activeNodeHalo} scale-105 border-[var(--palette-booklet-cover)] bg-[var(--palette-paper)] shadow-md`
                        : isCompleted
                          ? 'border-[var(--palette-booklet-cover)] bg-[var(--palette-cream)] shadow-sm group-hover:scale-105'
                          : 'border-[var(--palette-gold)]/35 bg-[var(--palette-paper)] shadow-2xs'
                    }`}
                  >
                    <span
                      key={`${selectedEventType || 'default'}-${node.step}`}
                      role="img"
                      aria-hidden="true"
                      className={`${styles.emotePop} leading-none ${
                        isCurrent || isCompleted ? '' : 'opacity-55'
                      }`}
                    >
                      {emoji}
                    </span>

                    {isCompleted ? (
                      <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--palette-paper)] bg-[var(--palette-booklet-cover)] text-[var(--text-on-action)] shadow-xs">
                        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                      </span>
                    ) : null}
                  </span>

                  <span
                    className={`mt-2.5 font-sans text-xs font-bold uppercase tracking-[0.14em] ${
                      isCurrent || isCompleted
                        ? 'text-[var(--palette-gold-ink)]'
                        : 'text-[var(--palette-gold-ink)]/60'
                    }`}
                  >
                    {node.code}
                  </span>
                  <span
                    className={`mt-0.5 font-serif text-sm font-medium ${
                      isCurrent || isCompleted ? 'text-ink' : 'text-ink/55'
                    }`}
                  >
                    {node.milestoneTitle}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
