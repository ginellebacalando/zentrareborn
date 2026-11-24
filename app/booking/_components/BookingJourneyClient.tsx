'use client';

import Image from 'next/image';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Mail,
  Minus,
  PartyPopper,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import styles from './BookingJourney.module.css';
import {
  DownpaymentView,
  PackageSuggestionsView,
  type DownpaymentDetails,
} from './BookingPostReviewFlow';
import JourneyMountainMap from './JourneyMountainMap';
import OfficialBookingReceipt from './OfficialBookingReceipt';
import { formatPhp, getRecommendedPackages } from './packageRecommendations';
import { bookingPrefillNote, hasBookingPrefill, parseBookingPrefill } from './bookingPrefill';

import ZionDatePicker, { type ZionDateStatus } from '@/components/client/ZionDatePicker';
import ZionSelectPopover from '@/components/client/ZionSelectPopover';
import { BRAND } from '@/config/brand';

type JourneyPhase = 'journey' | 'loading' | 'suggestions' | 'downpayment' | 'summary';
type StepNumber = 1 | 2 | 3 | 4 | 5;

const INITIAL_DOWNPAYMENT: DownpaymentDetails = {
  method: 'GCash',
  senderName: '',
  referenceNumber: '',
  receiptFileName: '',
  agreedToTerms: false,
};

interface JourneyStepMeta {
  readonly step: StepNumber;
  readonly code: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly subtitle: string;
}

const JOURNEY_STEPS: readonly JourneyStepMeta[] = [
  {
    step: 1,
    code: 'Step 1',
    title: 'What are we Celebrating?',
    shortTitle: 'Celebration',
    subtitle: 'Choose the occasion you are hosting at Zion Events Place.',
  },
  {
    step: 2,
    code: 'Step 2',
    title: 'Package & Guest Scale',
    shortTitle: 'Package & Guests',
    subtitle:
      'Select your preferred package style and estimated headcount—one exclusive event per day.',
  },
  {
    step: 3,
    code: 'Step 3',
    title: 'Date & Budget Range',
    shortTitle: 'Date & Budget',
    subtitle:
      'Check date availability, choose your celebration date, and select your target budget range.',
  },
  {
    step: 4,
    code: 'Step 4',
    title: 'Client Information',
    shortTitle: 'Client Details',
    subtitle: 'Complete your booking details to reserve your date.',
  },
  {
    step: 5,
    code: 'Step 5',
    title: 'Review & Complete Booking',
    shortTitle: 'Final Review',
    subtitle: 'Verify every step before generating your official Zion booking summary.',
  },
] as const;

const EVENT_TYPES = [
  {
    id: 'Wedding',
    label: 'Wedding',
    emoji: '💍',
    tagline: 'Ceremony & reception tailored for timeless vows',
    imageSrc: '/images/events/weddings/wedding1.webp',
    imageAlt: 'Romantic wedding ceremony at Zion Events Place',
  },
  {
    id: 'Debut',
    label: 'Debut',
    emoji: '👑',
    tagline: 'An unforgettable 18th milestone celebration',
    imageSrc: '/images/events/debuts-birthdays/debut1.webp',
    imageAlt: 'Elegant 18th birthday debut celebration at Zion Events Place',
  },
  {
    id: 'Birthday',
    label: 'Birthday',
    emoji: '🎂',
    tagline: 'Intimate dinners to lively milestone parties',
    imageSrc: '/images/events/debuts-birthdays/birthday1.webp',
    imageAlt: 'Festive birthday celebration setup at Zion Events Place',
  },
  {
    id: 'Christening',
    label: 'Christening',
    emoji: '🕊️',
    tagline: 'Warm daytime gatherings for family & loved ones',
    imageSrc: '/images/events/christenings/christening1.webp',
    imageAlt: 'Warm family christening reception at Zion Events Place',
  },
  {
    id: 'Christmas Party',
    label: 'Christmas Party',
    emoji: '🎄',
    tagline: 'Festive corporate nights & holiday reunions',
    imageSrc: '/images/events/holidays/christmas-party.webp',
    imageAlt: 'Holiday Christmas party celebration at Zion Events Place',
  },
  {
    id: 'Gender Reveal',
    label: 'Gender Reveal',
    emoji: '🎀',
    tagline: 'Scenic sunset reveals with curated styling',
    imageSrc: '/images/events/gender-reveals/gender-reveal.webp',
    imageAlt: 'Curated gender reveal celebration at Zion Events Place',
  },
] as const;

const PACKAGE_STYLES = [
  {
    id: 'Zion Classic',
    label: 'Zion Classic',
    summary: 'Essential venue experience, full catering, and dedicated coordination.',
    imageSrc: '/images/about/about-story-2.webp',
    imageAlt: 'Classic indoor hall reception setup at Zion Events Place',
  },
  {
    id: 'Zion Signature',
    label: 'Zion Signature',
    summary: 'Elevated styling, enhanced audio-visuals, and curated celebration perks.',
    imageSrc: '/images/events/weddings/minimalist-luxury-ceremony-backdrop.webp',
    imageAlt: 'Signature curated ceremony and reception backdrop at Zion Events Place',
  },
  {
    id: 'Zion Grand',
    label: 'Zion Grand',
    summary: 'Comprehensive all-in luxury production for flagship milestones.',
    imageSrc: '/images/events/weddings/gorgeous-wedding-decor.webp',
    imageAlt: 'Grand floral and chandelier event production at Zion Events Place',
  },
  {
    id: 'Custom Proposal',
    label: 'Custom Proposal',
    summary: 'Bespoke inclusions crafted directly with a Zion Events coordinator.',
    imageSrc: '/images/venue/venue-view.webp',
    imageAlt: 'Scenic overlooking event venue for custom celebrations at Zion Events Place',
  },
] as const;

const GUEST_PRESETS = [30, 50, 80, 100, 150] as const;

interface BudgetRangeOption {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
}

const DEFAULT_BUDGET_RANGES: readonly BudgetRangeOption[] = [
  {
    id: 'Under ₱150,000',
    label: 'Under ₱150,000',
    detail: 'Intimate celebrations & essential venue setups',
  },
  {
    id: '₱150,000 – ₱250,000',
    label: '₱150,000 – ₱250,000',
    detail: 'Classic full-service gatherings & catering',
  },
  {
    id: '₱250,000 – ₱400,000',
    label: '₱250,000 – ₱400,000',
    detail: 'Elevated styling & signature inclusions',
  },
  {
    id: '₱400,000 – ₱600,000',
    label: '₱400,000 – ₱600,000',
    detail: 'Grand production & premium amenities',
  },
  {
    id: '₱600,000+',
    label: '₱600,000+',
    detail: 'Flagship luxury & bespoke all-in experience',
  },
  {
    id: 'Flexible / Open to Proposal',
    label: 'Flexible / Open to Proposal',
    detail: 'Tailored around your celebration priorities',
  },
] as const;

const INTIMATE_MILESTONE_BUDGET_RANGES: readonly BudgetRangeOption[] = [
  {
    id: '₱80,000 – ₱100,000',
    label: '₱80,000 – ₱100,000',
    detail: 'Intimate celebration & essential setup',
  },
  {
    id: '₱100,000 – ₱125,000',
    label: '₱100,000 – ₱125,000',
    detail: 'Classic gathering with curated styling',
  },
  {
    id: '₱125,000 – ₱150,000',
    label: '₱125,000 – ₱150,000',
    detail: 'Elevated styling & full-course catering',
  },
  {
    id: '₱150,000 – ₱180,000',
    label: '₱150,000 – ₱180,000',
    detail: 'Grand bespoke setup & premium perks',
  },
  {
    id: 'Flexible / Open to Proposal',
    label: 'Flexible / Open to Proposal',
    detail: 'Tailored around your celebration priorities',
  },
] as const;

const BIRTHDAY_BUDGET_RANGES: readonly BudgetRangeOption[] = [
  {
    id: '₱100,000 – ₱130,000',
    label: '₱100,000 – ₱130,000',
    detail: 'Intimate birthday celebration & essentials',
  },
  {
    id: '₱130,000 – ₱160,000',
    label: '₱130,000 – ₱160,000',
    detail: 'Classic full-service birthday gathering',
  },
  {
    id: '₱160,000 – ₱190,000',
    label: '₱160,000 – ₱190,000',
    detail: 'Elevated styling & signature inclusions',
  },
  {
    id: '₱190,000 – ₱220,000',
    label: '₱190,000 – ₱220,000',
    detail: 'Grand milestone production & premium perks',
  },
  {
    id: 'Flexible / Open to Proposal',
    label: 'Flexible / Open to Proposal',
    detail: 'Tailored around your celebration priorities',
  },
] as const;

function getBudgetRangesForEvent(eventType: string): readonly BudgetRangeOption[] {
  if (eventType === 'Christening' || eventType === 'Gender Reveal') {
    return INTIMATE_MILESTONE_BUDGET_RANGES;
  }
  if (eventType === 'Birthday') {
    return BIRTHDAY_BUDGET_RANGES;
  }
  return DEFAULT_BUDGET_RANGES;
}

const CURATED_ADDONS = [
  'LED Wall & Ambient Lighting',
  'Full-Course Catering & Grazing',
  'Photo & Video Coverage',
  'Event Styling & Florals',
  'Acoustic / Live Entertainment',
  'Poolside Cocktail Hour',
] as const;

const COUNTRY_CODES = [
  { value: '+63', label: 'Philippines (+63)' },
  { value: '+1', label: 'United States (+1)' },
  { value: '+44', label: 'United Kingdom (+44)' },
  { value: '+61', label: 'Australia (+61)' },
  { value: '+65', label: 'Singapore (+65)' },
  { value: '+81', label: 'Japan (+81)' },
  { value: '+971', label: 'UAE (+971)' },
] as const;

const LOADING_MESSAGES = [
  'Matching packages to your event & budget…',
  'Ranking best-match & best-value options…',
  'Preparing your tailored Zion recommendations…',
] as const;

interface JourneyFormState {
  eventType: string;
  packageTier: string;
  guestCount: number;
  eventDate: string;
  budgetRange: string;
  addOns: string[];
  fullName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  facebookAccount: string;
  notes: string;
}

type Step4Field = 'fullName' | 'email' | 'phoneNumber' | 'facebookAccount';

const INITIAL_TOUCHED_STEP4: Record<Step4Field, boolean> = {
  fullName: false,
  email: false,
  phoneNumber: false,
  facebookAccount: false,
};

const INITIAL_FORM_STATE: JourneyFormState = {
  eventType: '',
  packageTier: '',
  guestCount: 80,
  eventDate: '',
  budgetRange: '',
  addOns: [],
  fullName: '',
  email: '',
  countryCode: '+63',
  phoneNumber: '',
  facebookAccount: '',
  notes: '',
};

function validateFullName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Please enter the client’s full name.';
  }
  if (trimmed.length < 3) {
    return 'Full name must be at least 3 characters.';
  }
  if (!/^[a-zA-ZÀ-ÿ'’.\-\s]+$/.test(trimmed)) {
    return 'Full name can only contain letters, spaces, hyphens, or apostrophes.';
  }
  const wordParts = trimmed.split(/\s+/).filter((part) => /[a-zA-ZÀ-ÿ]/.test(part));
  if (wordParts.length < 2) {
    return 'Please enter both first and last name.';
  }
  return '';
}

function validateEmail(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Please enter an official email address for your booking confirmation.';
  }
  if (trimmed.includes('..') || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return 'Please enter a valid email address (e.g., name@domain.com).';
  }
  return '';
}

interface CountryPhoneRule {
  readonly placeholder: string;
  readonly maxDigits: number;
  readonly groups: readonly number[];
  readonly stripLeadingZero: boolean;
  readonly pattern: RegExp;
  readonly errorMessage: string;
}

const COUNTRY_PHONE_RULES: Record<string, CountryPhoneRule> = {
  '+63': {
    placeholder: '917 123 4567',
    maxDigits: 10,
    groups: [3, 3, 4],
    stripLeadingZero: true,
    pattern: /^9\d{9}$/,
    errorMessage:
      'Philippine mobile numbers must start with 9 and have 10 digits (e.g., 917 123 4567).',
  },
  '+1': {
    placeholder: '212 555 0198',
    maxDigits: 10,
    groups: [3, 3, 4],
    stripLeadingZero: false,
    pattern: /^[2-9]\d{9}$/,
    errorMessage: 'US numbers must start with 2–9 and have 10 digits (e.g., 212 555 0198).',
  },
  '+44': {
    placeholder: '7700 900123',
    maxDigits: 10,
    groups: [4, 6],
    stripLeadingZero: true,
    pattern: /^7\d{9}$/,
    errorMessage: 'UK mobile numbers must start with 7 and have 10 digits (e.g., 7700 900123).',
  },
  '+61': {
    placeholder: '412 345 678',
    maxDigits: 9,
    groups: [3, 3, 3],
    stripLeadingZero: true,
    pattern: /^4\d{8}$/,
    errorMessage:
      'Australian mobile numbers must start with 4 and have 9 digits (e.g., 412 345 678).',
  },
  '+65': {
    placeholder: '8123 4567',
    maxDigits: 8,
    groups: [4, 4],
    stripLeadingZero: false,
    pattern: /^[89]\d{7}$/,
    errorMessage:
      'Singapore mobile numbers must start with 8 or 9 and have 8 digits (e.g., 8123 4567).',
  },
  '+81': {
    placeholder: '90 1234 5678',
    maxDigits: 10,
    groups: [2, 4, 4],
    stripLeadingZero: true,
    pattern: /^[789]0\d{8}$/,
    errorMessage:
      'Japanese mobile numbers must start with 70, 80, or 90 and have 10 digits (e.g., 90 1234 5678).',
  },
  '+971': {
    placeholder: '50 123 4567',
    maxDigits: 9,
    groups: [2, 3, 4],
    stripLeadingZero: true,
    pattern: /^5\d{8}$/,
    errorMessage: 'UAE mobile numbers must start with 5 and have 9 digits (e.g., 50 123 4567).',
  },
};

function getPhoneRule(countryCode: string): CountryPhoneRule {
  return COUNTRY_PHONE_RULES[countryCode] ?? COUNTRY_PHONE_RULES['+63'];
}

function formatPhoneForCountry(countryCode: string, rawValue: string): string {
  const rule = getPhoneRule(countryCode);
  let digits = rawValue.replace(/\D/g, '');
  if (rule.stripLeadingZero && digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }
  digits = digits.slice(0, rule.maxDigits);

  const parts: string[] = [];
  let cursor = 0;
  for (const size of rule.groups) {
    if (cursor >= digits.length) break;
    parts.push(digits.slice(cursor, cursor + size));
    cursor += size;
  }
  if (cursor < digits.length) {
    parts.push(digits.slice(cursor));
  }
  return parts.join(' ');
}

function validatePhone(countryCode: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Please enter an active mobile number.';
  }
  if (!/^[0-9\s\-().]+$/.test(trimmed)) {
    return 'Mobile number can only contain digits, spaces, or hyphens.';
  }
  const rule = getPhoneRule(countryCode);
  let digits = trimmed.replace(/\D/g, '');
  if (rule.stripLeadingZero && digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }
  if (!rule.pattern.test(digits)) {
    return rule.errorMessage;
  }
  return '';
}

function validateFacebookAccount(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Please enter your Facebook account name or profile link.';
  }
  if (trimmed.length < 3) {
    return 'Facebook account must be at least 3 characters.';
  }
  if (/^(?:https?:\/\/|www\.|m\.|facebook\.com|fb\.com)/i.test(trimmed)) {
    if (
      !/^(?:https?:\/\/)?(?:www\.|m\.)?(?:facebook\.com|fb\.com)\/[a-zA-Z0-9._?=&%-]{2,}\/?$/i.test(
        trimmed,
      )
    ) {
      return 'Enter a valid Facebook profile URL (e.g., facebook.com/yourname).';
    }
    return '';
  }
  if (!/[a-zA-Z0-9]{2,}/.test(trimmed)) {
    return 'Enter a valid Facebook account name, handle, or profile link.';
  }
  return '';
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatReadableDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Flexible / To be decided';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

function generateBookingReference(): string {
  const year = new Date().getFullYear();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `ZION-${year}-${suffix}`;
}

function getGuestScaleLabel(count: number): string {
  if (count <= 0) return 'Enter Headcount';
  if (count <= 50) return 'Intimate Gathering';
  if (count <= 100) return 'Classic Celebration';
  return 'Grand Reception';
}

/**
 * Deterministic schedule preview indicator for upcoming dates:
 * - 'booked': date already reserved for an exclusive event
 * - 'unavailable': blocked for maintenance / private hold
 * - 'inquired': available, but another client is actively inquiring (high demand)
 * - 'available': open for exclusive full-day reservation
 */
type CalendarDays = { booked: ReadonlySet<string>; inquired: ReadonlySet<string> };

const EMPTY_CALENDAR: CalendarDays = { booked: new Set(), inquired: new Set() };
/** How far ahead the date picker loads real availability. */
const AVAILABILITY_WINDOW_DAYS = 365;

function addDaysToIso(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export default function BookingJourneyClient() {
  const [phase, setPhase] = useState<JourneyPhase>('journey');
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [highestUnlocked, setHighestUnlocked] = useState<StepNumber>(1);
  const [form, setForm] = useState<JourneyFormState>(INITIAL_FORM_STATE);
  const [touchedStep4, setTouchedStep4] =
    useState<Record<Step4Field, boolean>>(INITIAL_TOUCHED_STEP4);
  const [editingReviewStep, setEditingReviewStep] = useState<1 | 2 | 3 | 4 | null>(null);
  const [stepError, setStepError] = useState<string>('');
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [bookingRef, setBookingRef] = useState<string>('');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [downpayment, setDownpayment] = useState<DownpaymentDetails>(INITIAL_DOWNPAYMENT);

  const [isSendingInquiry, setIsSendingInquiry] = useState(false);
  const [inquiryFeedback, setInquiryFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const stageTopRef = useRef<HTMLDivElement>(null);
  const todayIso = useMemo(() => getTodayIso(), []);

  // Zeni links may pre-fill the journey (see ./bookingPrefill.ts); invalid values are ignored.
  // Applied after hydration so the server-rendered first step always matches.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const prefill = parseBookingPrefill(window.location.search, todayIso);
      if (!hasBookingPrefill(prefill)) return;
      const eventType = EVENT_TYPES.find((item) => item.id === prefill.eventType)?.id;
      const packageTier = PACKAGE_STYLES.find((item) => item.id === prefill.packageTier)?.id;
      const note = bookingPrefillNote(prefill);
      setForm((prev) => ({
        ...prev,
        ...(eventType ? { eventType } : {}),
        ...(packageTier ? { packageTier } : {}),
        ...(prefill.guestCount ? { guestCount: prefill.guestCount } : {}),
        ...(prefill.eventDate ? { eventDate: prefill.eventDate } : {}),
        ...(note && !prev.notes.includes(note)
          ? { notes: prev.notes ? `${prev.notes}\n${note}` : note }
          : {}),
      }));
      const firstOpenStep: StepNumber = !eventType ? 1 : !packageTier ? 2 : 3;
      setCurrentStep(firstOpenStep);
      setHighestUnlocked(firstOpenStep);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [todayIso]);

  // Real availability from the admin calendar: confirmed reservations are "booked" and open
  // requests are "inquired". Until it loads (or if it fails) dates show as open; staff confirmation
  // still rechecks every conflict.
  const [calendarDays, setCalendarDays] = useState<CalendarDays>(EMPTY_CALENDAR);
  useEffect(() => {
    const controller = new AbortController();
    const to = addDaysToIso(todayIso, AVAILABILITY_WINDOW_DAYS);
    fetch(`/api/client/availability?from=${todayIso}&to=${to}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { booked?: string[]; inquired?: string[] } | null) => {
        if (data) {
          setCalendarDays({ booked: new Set(data.booked), inquired: new Set(data.inquired) });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [todayIso]);
  const getDateStatus = useCallback(
    (iso: string): ZionDateStatus =>
      calendarDays.booked.has(iso)
        ? 'booked'
        : calendarDays.inquired.has(iso)
          ? 'inquired'
          : 'available',
    [calendarDays],
  );
  const selectedDateStatus = useMemo(
    () => (form.eventDate ? getDateStatus(form.eventDate) : null),
    [form.eventDate, getDateStatus],
  );
  const activeBudgetRanges = useMemo(
    () => getBudgetRangesForEvent(form.eventType),
    [form.eventType],
  );
  const recommendations = useMemo(
    () =>
      getRecommendedPackages({
        eventType: form.eventType,
        packageTier: form.packageTier,
        guestCount: form.guestCount,
        budgetRange: form.budgetRange,
        addOns: form.addOns,
      }),
    [form.eventType, form.packageTier, form.guestCount, form.budgetRange, form.addOns],
  );
  const selectedRecommendation = useMemo(
    () =>
      recommendations.find((item) => item.pkg.id === selectedPackageId) ??
      recommendations[0] ??
      null,
    [recommendations, selectedPackageId],
  );

  const handleSelectEventType = (eventId: string) => {
    const allowedBudgets = getBudgetRangesForEvent(eventId);
    setForm((prev) => ({
      ...prev,
      eventType: eventId,
      budgetRange: allowedBudgets.some((item) => item.id === prev.budgetRange)
        ? prev.budgetRange
        : '',
    }));
    setStepError('');
  };

  const currentMeta = JOURNEY_STEPS[currentStep - 1];

  const progressPercent = useMemo(() => {
    if (phase !== 'journey') return 100;
    return Math.round(((currentStep - 1) / (JOURNEY_STEPS.length - 1)) * 100);
  }, [phase, currentStep]);

  useEffect(() => {
    if (phase !== 'loading') {
      return;
    }

    const stepOneTimer = window.setTimeout(() => setLoadingStepIndex(1), 550);
    const stepTwoTimer = window.setTimeout(() => setLoadingStepIndex(2), 1100);
    const finishTimer = window.setTimeout(() => {
      setSelectedPackageId((prev) =>
        recommendations.some((item) => item.pkg.id === prev)
          ? prev
          : (recommendations[0]?.pkg.id ?? ''),
      );
      setDownpayment((prev) => ({
        ...prev,
        senderName: prev.senderName.trim() ? prev.senderName : form.fullName.trim(),
      }));
      setPhase('suggestions');
    }, 1650);

    return () => {
      window.clearTimeout(stepOneTimer);
      window.clearTimeout(stepTwoTimer);
      window.clearTimeout(finishTimer);
    };
  }, [phase, recommendations, form.fullName]);

  const scrollToTopOfJourney = () => {
    stageTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const step4FieldErrors = useMemo(
    () => ({
      fullName: validateFullName(form.fullName),
      email: validateEmail(form.email),
      phoneNumber: validatePhone(form.countryCode, form.phoneNumber),
      facebookAccount: validateFacebookAccount(form.facebookAccount),
    }),
    [form.fullName, form.email, form.countryCode, form.phoneNumber, form.facebookAccount],
  );

  const validateStep = (step: StepNumber): string => {
    if (step === 1 && !form.eventType) {
      return 'Please choose what you are celebrating to proceed to Step 2.';
    }
    if (step === 2) {
      if (!form.packageTier) return 'Please select a package style to continue.';
      if (!Number.isFinite(form.guestCount) || form.guestCount < 1) {
        return 'Please enter a valid estimated guest count.';
      }
    }
    if (step === 3) {
      if (!form.eventDate) return 'Please pick an available celebration date.';
      const status = getDateStatus(form.eventDate);
      if (status === 'booked' || status === 'unavailable') {
        return 'That date is no longer open. Please choose an available date.';
      }
      if (!form.budgetRange) return 'Please select a budget range to proceed to Step 4.';
    }
    if (step === 4) {
      if (step4FieldErrors.fullName) return step4FieldErrors.fullName;
      if (step4FieldErrors.email) return step4FieldErrors.email;
      if (step4FieldErrors.phoneNumber) return step4FieldErrors.phoneNumber;
      if (step4FieldErrors.facebookAccount) return step4FieldErrors.facebookAccount;
    }
    if (step === 5) {
      for (const s of [1, 2, 3, 4] as const) {
        const sectionError = validateStep(s);
        if (sectionError) return sectionError;
      }
    }
    return '';
  };

  const handleToggleReviewEdit = (section: 1 | 2 | 3 | 4) => {
    if (editingReviewStep === section) {
      const error = validateStep(section);
      if (error) {
        if (section === 4) {
          setTouchedStep4({
            fullName: true,
            email: true,
            phoneNumber: true,
            facebookAccount: true,
          });
        }
        setStepError(error);
        return;
      }
      setStepError('');
      setEditingReviewStep(null);
      return;
    }

    if (editingReviewStep !== null) {
      const prevError = validateStep(editingReviewStep);
      if (prevError) {
        if (editingReviewStep === 4) {
          setTouchedStep4({
            fullName: true,
            email: true,
            phoneNumber: true,
            facebookAccount: true,
          });
        }
        setStepError(prevError);
        return;
      }
    }

    setStepError('');
    setEditingReviewStep(section);
  };

  const handleNextStep = () => {
    const error = validateStep(currentStep);
    if (error) {
      if (currentStep === 4 || currentStep === 5) {
        setTouchedStep4({
          fullName: true,
          email: true,
          phoneNumber: true,
          facebookAccount: true,
        });
      }
      setStepError(error);
      return;
    }

    setStepError('');
    if (currentStep < 5) {
      const next = (currentStep + 1) as StepNumber;
      setCurrentStep(next);
      setHighestUnlocked((prev) => (next > prev ? next : prev));
      scrollToTopOfJourney();
    } else {
      setEditingReviewStep(null);
      setInquiryFeedback(null);
      setLoadingStepIndex(0);
      setPhase('loading');
      scrollToTopOfJourney();
    }
  };

  const handlePrevStep = () => {
    setStepError('');
    setEditingReviewStep(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as StepNumber);
      scrollToTopOfJourney();
    }
  };

  const jumpToStep = (target: StepNumber) => {
    if (target <= highestUnlocked && phase === 'journey') {
      setStepError('');
      setEditingReviewStep(null);
      setCurrentStep(target);
      scrollToTopOfJourney();
    }
  };

  const toggleAddOn = (addon: string) => {
    setForm((prev) => ({
      ...prev,
      addOns: prev.addOns.includes(addon)
        ? prev.addOns.filter((item) => item !== addon)
        : [...prev.addOns, addon],
    }));
  };

  const adjustGuestCount = (delta: number) => {
    setForm((prev) => ({
      ...prev,
      guestCount: Math.max(1, Math.min(500, (prev.guestCount || 0) + delta)),
    }));
    setStepError('');
  };

  const handleResetJourney = () => {
    setForm(INITIAL_FORM_STATE);
    setTouchedStep4(INITIAL_TOUCHED_STEP4);
    setEditingReviewStep(null);
    setSelectedPackageId('');
    setDownpayment(INITIAL_DOWNPAYMENT);
    setCurrentStep(1);
    setHighestUnlocked(1);
    setStepError('');
    setInquiryFeedback(null);
    setBookingRef('');
    setPhase('journey');
    scrollToTopOfJourney();
  };

  const handleSendToZion = async () => {
    if (isSendingInquiry) return;
    setIsSendingInquiry(true);
    setInquiryFeedback(null);

    const summaryLines = [
      `Booking Reference: ${bookingRef}`,
      `Event Type: ${form.eventType}`,
      `Package Style Preference: ${form.packageTier}`,
      selectedRecommendation
        ? `Selected Package: ${selectedRecommendation.pkg.name} (${formatPhp(selectedRecommendation.estimatedTotal)})`
        : null,
      `Estimated Guests: ${form.guestCount} pax`,
      `Event Date: ${formatReadableDate(form.eventDate)}`,
      `Budget Range: ${form.budgetRange}`,
      `Curated Add-ons: ${form.addOns.length > 0 ? form.addOns.join(', ') : 'None selected'}`,
      selectedRecommendation
        ? `Downpayment (${selectedRecommendation.pkg.downpaymentPercent}%): ${formatPhp(selectedRecommendation.downpaymentAmount)} via ${downpayment.method}`
        : null,
      downpayment.referenceNumber.trim()
        ? `Payment Reference No.: ${downpayment.referenceNumber.trim()} (Sender: ${downpayment.senderName.trim()})`
        : null,
      downpayment.receiptFileName ? `Receipt Attached: ${downpayment.receiptFileName}` : null,
      selectedRecommendation
        ? `Remaining Balance: ${formatPhp(selectedRecommendation.remainingBalance)}`
        : null,
      `Facebook Account: ${form.facebookAccount.trim()}`,
      form.notes.trim() ? `Booking Requests & Notes: ${form.notes.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await fetch('/api/client/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: `${form.countryCode} ${form.phoneNumber.trim()}`,
          subject: 'General Message',
          message: summaryLines,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        inquiryReference?: string;
        message?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        setInquiryFeedback({
          type: 'error',
          text:
            payload?.error ??
            payload?.message ??
            'Unable to submit your booking right now. Please contact Zion Events Place directly with your reference code.',
        });
      } else {
        setInquiryFeedback({
          type: 'success',
          text: payload?.inquiryReference
            ? `Your event booking has been submitted to the Zion Events Place booking team (Confirmation Ref: ${payload.inquiryReference}).`
            : 'Your event booking has been submitted to the Zion Events Place booking team. Our coordinator will finalize your reservation shortly.',
        });
      }
    } catch {
      setInquiryFeedback({
        type: 'error',
        text: 'Network error while submitting your booking. You can print or save this summary and reach us via the Contact page.',
      });
    } finally {
      setIsSendingInquiry(false);
    }
  };

  return (
    <div
      ref={stageTopRef}
      className="mx-auto w-full max-w-[96rem] scroll-mt-24 px-4 pt-28 pb-20 sm:px-6 lg:px-10 xl:px-12 md:pt-32 print:p-0"
    >
      {/* Editorial Header */}
      <header data-booking-no-print="true" className="mb-8 text-center md:mb-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--palette-gold)]/30 bg-[var(--palette-paper)]/90 px-4 py-1.5 font-sans text-xs font-semibold uppercase tracking-[0.22em] text-[var(--palette-gold-ink)] shadow-xs">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
          Zion Celebration Journey
        </span>

        <h1 className="mt-4 font-serif text-3xl tracking-tight text-ink sm:text-4xl md:text-5xl">
          Plan Your Event at Zion
        </h1>

        <p className="mx-auto mt-3 max-w-2xl font-sans text-sm leading-relaxed text-ink/75 sm:text-base">
          Move through each step from start to finish to craft your personalized event plan and
          receive a complete Zion booking summary.
        </p>
      </header>

      {/* Flowing Liquid Wave Step Progress Bar */}
      <div data-booking-no-print="true">
        <JourneyMountainMap
          phase={phase === 'journey' ? 'journey' : phase === 'loading' ? 'loading' : 'summary'}
          currentStep={currentStep}
          highestUnlocked={highestUnlocked}
          progressPercent={progressPercent}
          selectedEventType={form.eventType}
          onSelectStep={jumpToStep}
        />
      </div>

      {/* PHASE 1: Interactive 5-Step Journey */}
      {phase === 'journey' ? (
        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-12 xl:gap-9">
          {/* Active Step Process Container */}
          <section
            key={currentStep}
            aria-labelledby="journey-step-heading"
            className={`${styles.stepEnter} rounded-[2rem] border border-[var(--palette-gold)]/30 bg-[var(--palette-paper)]/95 p-6 shadow-[0_26px_64px_-32px_color-mix(in_srgb,var(--palette-ink)_24%,transparent)] backdrop-blur-md sm:p-8 lg:col-span-9 lg:p-10`}
          >
            <div className="mb-7 flex flex-col gap-1.5 border-b border-[var(--palette-gold)]/20 pb-6">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="block h-px w-8 bg-[var(--palette-booklet-cover)]"
                />
                <p className="font-sans text-xs font-bold uppercase tracking-[0.22em] text-[var(--palette-gold-ink)]">
                  {currentMeta.code}
                </p>
              </div>
              <h2
                id="journey-step-heading"
                className="font-serif text-2xl tracking-tight text-ink sm:text-3xl lg:text-[2.15rem]"
              >
                {currentMeta.title}
              </h2>
              <p className="font-sans text-sm text-ink/75 sm:text-base">{currentMeta.subtitle}</p>
            </div>

            {/* STEP 1: What are we Celebrating? */}
            {currentStep === 1 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {EVENT_TYPES.map((eventOption) => {
                  const selected = form.eventType === eventOption.id;
                  return (
                    <button
                      key={eventOption.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleSelectEventType(eventOption.id)}
                      className={`group flex flex-col overflow-hidden rounded-[1.5rem] border text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palette-gold-ink)] focus-visible:ring-offset-2 ${
                        selected
                          ? 'border-[var(--palette-booklet-cover)] bg-[var(--palette-cream)]/85 shadow-[0_18px_40px_-18px_color-mix(in_srgb,var(--palette-ink)_30%,transparent)] ring-2 ring-[var(--palette-booklet-cover)]/50'
                          : 'border-[var(--palette-gold)]/25 bg-[var(--palette-white)]/90 shadow-xs hover:-translate-y-1 hover:border-[var(--palette-booklet-cover)] hover:shadow-md'
                      }`}
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--palette-cream)]">
                        <Image
                          src={eventOption.imageSrc}
                          alt={eventOption.imageAlt}
                          fill
                          sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw"
                          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                        />
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-transparent"
                        />

                        <span
                          aria-hidden="true"
                          className="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--palette-white)]/60 bg-[var(--palette-paper)]/92 text-lg shadow-sm backdrop-blur-xs"
                        >
                          {eventOption.emoji}
                        </span>

                        {selected ? (
                          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-[var(--palette-booklet-cover)] px-3 py-1 font-sans text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-on-action)] shadow-sm">
                            <Check className="h-3.5 w-3.5" strokeWidth={2.8} aria-hidden="true" />
                            Selected
                          </span>
                        ) : null}
                      </div>

                      <div className="flex flex-1 flex-col justify-between p-5">
                        <div>
                          <h3 className="font-serif text-xl font-medium text-ink">
                            {eventOption.label}
                          </h3>
                          <p className="mt-1.5 font-sans text-xs leading-relaxed text-ink/75 sm:text-sm">
                            {eventOption.tagline}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* STEP 2: Package Style & Modern Guest Count */}
            {currentStep === 2 ? (
              <div className="space-y-8">
                <div>
                  <h3 className="mb-3.5 font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--palette-gold-ink)]">
                    Select Package Style
                  </h3>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {PACKAGE_STYLES.map((tier) => {
                      const selected = form.packageTier === tier.id;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setForm((prev) => ({ ...prev, packageTier: tier.id }));
                            setStepError('');
                          }}
                          className={`group overflow-hidden rounded-[1.5rem] border text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palette-gold-ink)] focus-visible:ring-offset-2 ${
                            selected
                              ? 'border-[var(--palette-booklet-cover)] bg-[var(--palette-cream)]/85 shadow-md ring-2 ring-[var(--palette-booklet-cover)]/50'
                              : 'border-[var(--palette-gold)]/25 bg-[var(--palette-white)]/90 hover:-translate-y-0.5 hover:border-[var(--palette-booklet-cover)] hover:shadow-md'
                          }`}
                        >
                          <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--palette-cream)]">
                            <Image
                              src={tier.imageSrc}
                              alt={tier.imageAlt}
                              fill
                              sizes="(max-width: 639px) 100vw, 440px"
                              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                            />
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent"
                            />
                            {selected ? (
                              <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-[var(--palette-booklet-cover)] px-3 py-1 font-sans text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-on-action)] shadow-sm">
                                <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
                                Selected
                              </span>
                            ) : null}
                          </div>
                          <div className="p-5">
                            <p className="font-serif text-xl font-medium text-ink">{tier.label}</p>
                            <p className="mt-1 font-sans text-xs leading-relaxed text-ink/75 sm:text-sm">
                              {tier.summary}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Rebuilt Modern, Interactive, Luxury Guest Count Card */}
                <div className="overflow-hidden rounded-[1.75rem] border border-[var(--palette-gold)]/25 bg-gradient-to-br from-[var(--palette-white)] via-[var(--palette-paper)] to-[var(--palette-cream)]/60 p-6 shadow-sm sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--palette-booklet-cover)]/40 text-ink">
                          <Users className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                        </span>
                        <label
                          htmlFor="booking-guest-count-input"
                          className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--palette-gold-ink)]"
                        >
                          Estimated Guest Count
                        </label>
                      </div>
                      <p className="mt-2 font-sans text-xs text-ink/70 sm:text-sm">
                        Adjust with the controls, type your exact count, or select a quick preset.
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--palette-booklet-cover)]/60 bg-[var(--palette-booklet-cover)]/25 px-3.5 py-1.5 font-sans text-xs font-semibold text-ink">
                      <Sparkles
                        className="h-3.5 w-3.5 text-[var(--palette-gold-ink)]"
                        aria-hidden="true"
                      />
                      {getGuestScaleLabel(form.guestCount)}
                    </span>
                  </div>

                  {/* Interactive Center Stepper + Borderless Direct Number Entry */}
                  <div className="mt-6 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 rounded-full border border-[var(--palette-gold)]/30 bg-[var(--palette-white)] p-2 shadow-xs transition-shadow focus-within:border-[var(--palette-booklet-cover)] focus-within:ring-2 focus-within:ring-[var(--palette-booklet-cover)]/45">
                      <button
                        type="button"
                        onClick={() => adjustGuestCount(-1)}
                        disabled={form.guestCount <= 1}
                        aria-label="Decrease guest count by 1"
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--palette-booklet-cover)]/70 bg-[var(--palette-booklet-cover)]/35 text-ink shadow-xs transition-all hover:bg-[var(--palette-booklet-cover)] hover:text-[var(--text-on-action)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus className="h-5 w-5" strokeWidth={2.4} />
                      </button>

                      <div className="flex items-baseline gap-1.5 px-4">
                        <input
                          id="booking-guest-count-input"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          aria-label="Estimated guest count"
                          value={form.guestCount === 0 ? '' : String(form.guestCount)}
                          onChange={(event) => {
                            const digits = event.target.value.replace(/\D/g, '');
                            if (digits === '') {
                              setForm((prev) => ({ ...prev, guestCount: 0 }));
                              return;
                            }
                            const parsed = Number.parseInt(digits, 10);
                            if (!Number.isNaN(parsed)) {
                              setForm((prev) => ({
                                ...prev,
                                guestCount: Math.max(0, Math.min(500, parsed)),
                              }));
                              setStepError('');
                            }
                          }}
                          className={`${styles.guestCountInput} w-16 border-0 bg-transparent text-center font-serif text-3xl font-semibold text-ink`}
                        />
                        <span className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]">
                          Guests
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => adjustGuestCount(1)}
                        disabled={form.guestCount >= 500}
                        aria-label="Increase guest count by 1"
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--palette-booklet-cover)]/70 bg-[var(--palette-booklet-cover)]/35 text-ink shadow-xs transition-all hover:bg-[var(--palette-booklet-cover)] hover:text-[var(--text-on-action)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-5 w-5" strokeWidth={2.4} />
                      </button>
                    </div>

                    {/* Quick Preset Pills */}
                    <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
                      {GUEST_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setForm((prev) => ({ ...prev, guestCount: preset }));
                            setStepError('');
                          }}
                          className={`min-h-10 rounded-full border px-4 py-1.5 font-sans text-xs font-semibold transition-all ${
                            form.guestCount === preset
                              ? 'border-[var(--palette-booklet-cover)] bg-[var(--palette-booklet-cover)] text-[var(--text-on-action)] shadow-xs'
                              : 'border-[var(--palette-gold)]/30 bg-[var(--palette-white)] text-ink/80 hover:border-[var(--palette-booklet-cover)] hover:bg-[var(--palette-cream)]/60'
                          }`}
                        >
                          {preset} pax
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Smooth Range Slider with Scale Markers */}
                  <div className="mt-6">
                    <input
                      id="booking-guest-count"
                      aria-label="Estimated guest count slider"
                      type="range"
                      min={20}
                      max={200}
                      step={5}
                      value={Math.min(200, Math.max(20, form.guestCount || 20))}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, guestCount: Number(event.target.value) }));
                        setStepError('');
                      }}
                      className="h-2 w-full cursor-pointer accent-[var(--palette-gold-ink)]"
                    />
                    <div className="mt-2 flex justify-between font-sans text-xs text-ink/55">
                      <span>20 pax</span>
                      <span>65 pax</span>
                      <span>110 pax</span>
                      <span>155 pax</span>
                      <span>200+ pax</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* STEP 3: Target Date With Strict Availability Status, Package Tier & Add-ons */}
            {currentStep === 3 ? (
              <div className="space-y-7">
                <div>
                  <label
                    htmlFor="booking-event-date"
                    className="mb-2 block font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--palette-gold-ink)]"
                  >
                    Target Celebration Date
                  </label>
                  <ZionDatePicker
                    id="booking-event-date"
                    value={form.eventDate}
                    minDate={todayIso}
                    getDateStatus={getDateStatus}
                    placeholder="Select an available celebration date"
                    onChange={(dateIso) => {
                      setForm((prev) => ({ ...prev, eventDate: dateIso }));
                      setStepError('');
                    }}
                  />

                  {/* Live Date Availability & High-Demand Reminder Banner */}
                  {form.eventDate && selectedDateStatus ? (
                    <div
                      role="status"
                      aria-live="polite"
                      className={`mt-3.5 flex items-start gap-3 rounded-2xl border p-4 font-sans text-sm ${
                        selectedDateStatus === 'inquired'
                          ? 'border-[var(--palette-booklet-cover)] bg-[var(--palette-cream)]/80 text-ink'
                          : selectedDateStatus === 'available'
                            ? 'border-[var(--palette-success)]/35 bg-[var(--palette-success-soft)] text-[var(--palette-success)]'
                            : 'border-[var(--palette-danger)]/35 bg-[var(--palette-danger-soft)] text-[var(--palette-danger)]'
                      }`}
                    >
                      {selectedDateStatus === 'inquired' ? (
                        <AlertTriangle
                          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--palette-gold-ink)]"
                          aria-hidden="true"
                        />
                      ) : selectedDateStatus === 'available' ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      )}
                      <div>
                        {selectedDateStatus === 'inquired' ? (
                          <>
                            <p className="font-semibold text-ink">
                              Available — High Demand on {formatReadableDate(form.eventDate)}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-ink/80 sm:text-sm">
                              Another client is currently inquiring about this date as well. Since
                              Zion hosts only one exclusive event per day, we strongly remind you to
                              secure this date right away to lock it in.
                            </p>
                          </>
                        ) : selectedDateStatus === 'available' ? (
                          <>
                            <p className="font-semibold">
                              Available — {formatReadableDate(form.eventDate)}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed opacity-90 sm:text-sm">
                              This date is currently open for an exclusive full-day celebration at
                              Zion Events Place.
                            </p>
                          </>
                        ) : selectedDateStatus === 'booked' ? (
                          <p className="font-semibold">
                            Already Booked — {formatReadableDate(form.eventDate)} is reserved.
                            Please pick another open date.
                          </p>
                        ) : (
                          <p className="font-semibold">
                            Not Available — {formatReadableDate(form.eventDate)} is currently
                            blocked. Please select an available date.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 font-sans text-xs text-ink/65">
                      Open the calendar to see which dates are available, in high demand, booked, or
                      unavailable.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--palette-gold-ink)]">
                    Select Budget Range
                  </h3>
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                    {activeBudgetRanges.map((budget) => {
                      const selected = form.budgetRange === budget.id;
                      return (
                        <button
                          key={budget.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setForm((prev) => ({ ...prev, budgetRange: budget.id }));
                            setStepError('');
                          }}
                          className={`rounded-2xl border p-4 text-left transition-all ${
                            selected
                              ? 'border-[var(--palette-booklet-cover)] bg-[var(--palette-cream)]/85 shadow-sm ring-1 ring-[var(--palette-booklet-cover)]/50'
                              : 'border-[var(--palette-gold)]/25 bg-[var(--palette-white)]/85 hover:border-[var(--palette-booklet-cover)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-serif text-lg font-medium text-ink">
                              {budget.label}
                            </span>
                            {selected ? (
                              <Check className="h-4 w-4 shrink-0 text-ink" strokeWidth={2.5} />
                            ) : null}
                          </div>
                          <p className="mt-1 font-sans text-xs leading-relaxed text-ink/70">
                            {budget.detail}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--palette-gold-ink)]">
                    Optional Curated Add-Ons
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {CURATED_ADDONS.map((addon) => {
                      const active = form.addOns.includes(addon);
                      return (
                        <button
                          key={addon}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleAddOn(addon)}
                          className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 font-sans text-xs font-semibold transition-all ${
                            active
                              ? 'border-[var(--palette-booklet-cover)] bg-[var(--palette-booklet-cover)] text-[var(--text-on-action)] shadow-xs'
                              : 'border-[var(--palette-gold)]/30 bg-[var(--palette-white)] text-ink/80 hover:bg-[var(--palette-cream)]/60'
                          }`}
                        >
                          {active ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}
                          <span>{addon}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {/* STEP 4: Client Information (Minimalist) */}
            {currentStep === 4 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {/* Client Full Name */}
                  <div>
                    <label
                      htmlFor="booking-full-name"
                      className="mb-2 flex items-center justify-between font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]"
                    >
                      <span>
                        Client Full Name{' '}
                        <span className="text-[var(--palette-danger)]" aria-hidden="true">
                          *
                        </span>
                      </span>
                      {!step4FieldErrors.fullName ? (
                        <CheckCircle2
                          className="h-4 w-4 text-[var(--palette-success)]"
                          aria-label="Valid"
                        />
                      ) : null}
                    </label>
                    <div className="relative">
                      <User
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-4 z-10 h-4 w-4 -translate-y-1/2 text-[var(--palette-gold-ink)]"
                      />
                      <input
                        id="booking-full-name"
                        type="text"
                        required
                        autoComplete="name"
                        aria-invalid={touchedStep4.fullName && Boolean(step4FieldErrors.fullName)}
                        aria-describedby={
                          touchedStep4.fullName && step4FieldErrors.fullName
                            ? 'booking-full-name-error'
                            : undefined
                        }
                        value={form.fullName}
                        onBlur={() => setTouchedStep4((prev) => ({ ...prev, fullName: true }))}
                        onChange={(event) => {
                          setForm((prev) => ({ ...prev, fullName: event.target.value }));
                          setStepError('');
                        }}
                        placeholder="Maria Clara Santos"
                        className={`w-full rounded-2xl border bg-[var(--palette-white)] py-3.5 pr-4 pl-11 font-sans text-sm text-ink shadow-2xs transition-all placeholder:text-ink/40 focus:shadow-sm focus:outline-none ${
                          touchedStep4.fullName && step4FieldErrors.fullName
                            ? 'border-[var(--palette-danger)] focus:border-[var(--palette-danger)]'
                            : 'border-[var(--palette-gold)]/30 hover:border-[var(--palette-gold)]/55 focus:border-[var(--palette-gold-ink)]'
                        }`}
                      />
                    </div>
                    {touchedStep4.fullName && step4FieldErrors.fullName ? (
                      <p
                        id="booking-full-name-error"
                        role="alert"
                        className="mt-1.5 flex items-center gap-1.5 font-sans text-xs text-[var(--palette-danger)]"
                      >
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{step4FieldErrors.fullName}</span>
                      </p>
                    ) : null}
                  </div>

                  {/* Email Address */}
                  <div>
                    <label
                      htmlFor="booking-email"
                      className="mb-2 flex items-center justify-between font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]"
                    >
                      <span>
                        Email Address{' '}
                        <span className="text-[var(--palette-danger)]" aria-hidden="true">
                          *
                        </span>
                      </span>
                      {!step4FieldErrors.email ? (
                        <CheckCircle2
                          className="h-4 w-4 text-[var(--palette-success)]"
                          aria-label="Valid"
                        />
                      ) : null}
                    </label>
                    <div className="relative">
                      <Mail
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-4 z-10 h-4 w-4 -translate-y-1/2 text-[var(--palette-gold-ink)]"
                      />
                      <input
                        id="booking-email"
                        type="email"
                        required
                        autoComplete="email"
                        aria-invalid={touchedStep4.email && Boolean(step4FieldErrors.email)}
                        aria-describedby={
                          touchedStep4.email && step4FieldErrors.email
                            ? 'booking-email-error'
                            : undefined
                        }
                        value={form.email}
                        onBlur={() => setTouchedStep4((prev) => ({ ...prev, email: true }))}
                        onChange={(event) => {
                          setForm((prev) => ({ ...prev, email: event.target.value }));
                          setStepError('');
                        }}
                        placeholder="maria.santos@email.com"
                        className={`w-full rounded-2xl border bg-[var(--palette-white)] py-3.5 pr-4 pl-11 font-sans text-sm text-ink shadow-2xs transition-all placeholder:text-ink/40 focus:shadow-sm focus:outline-none ${
                          touchedStep4.email && step4FieldErrors.email
                            ? 'border-[var(--palette-danger)] focus:border-[var(--palette-danger)]'
                            : 'border-[var(--palette-gold)]/30 hover:border-[var(--palette-gold)]/55 focus:border-[var(--palette-gold-ink)]'
                        }`}
                      />
                    </div>
                    {touchedStep4.email && step4FieldErrors.email ? (
                      <p
                        id="booking-email-error"
                        role="alert"
                        className="mt-1.5 flex items-center gap-1.5 font-sans text-xs text-[var(--palette-danger)]"
                      >
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{step4FieldErrors.email}</span>
                      </p>
                    ) : null}
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label
                      htmlFor="booking-phone"
                      className="mb-2 flex items-center justify-between font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]"
                    >
                      <span>
                        Mobile Number{' '}
                        <span className="text-[var(--palette-danger)]" aria-hidden="true">
                          *
                        </span>
                      </span>
                      {!step4FieldErrors.phoneNumber ? (
                        <CheckCircle2
                          className="h-4 w-4 text-[var(--palette-success)]"
                          aria-label="Valid"
                        />
                      ) : null}
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="sm:w-44">
                        <ZionSelectPopover
                          ariaLabel="Country calling code"
                          value={form.countryCode}
                          options={COUNTRY_CODES}
                          onChange={(value) => {
                            setForm((prev) => ({
                              ...prev,
                              countryCode: value,
                              phoneNumber: formatPhoneForCountry(value, prev.phoneNumber),
                            }));
                            setStepError('');
                          }}
                        />
                      </div>
                      <div className="relative flex-1">
                        <Phone
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-4 z-10 h-4 w-4 -translate-y-1/2 text-[var(--palette-gold-ink)]"
                        />
                        <input
                          id="booking-phone"
                          type="tel"
                          required
                          inputMode="numeric"
                          autoComplete="tel-national"
                          maxLength={getPhoneRule(form.countryCode).placeholder.length}
                          aria-invalid={
                            touchedStep4.phoneNumber && Boolean(step4FieldErrors.phoneNumber)
                          }
                          aria-describedby={
                            touchedStep4.phoneNumber && step4FieldErrors.phoneNumber
                              ? 'booking-phone-error'
                              : undefined
                          }
                          value={form.phoneNumber}
                          onBlur={() => setTouchedStep4((prev) => ({ ...prev, phoneNumber: true }))}
                          onChange={(event) => {
                            const formatted = formatPhoneForCountry(
                              form.countryCode,
                              event.target.value,
                            );
                            setForm((prev) => ({ ...prev, phoneNumber: formatted }));
                            setStepError('');
                          }}
                          placeholder={getPhoneRule(form.countryCode).placeholder}
                          className={`w-full rounded-2xl border bg-[var(--palette-white)] py-3.5 pr-4 pl-11 font-sans text-sm text-ink shadow-2xs transition-all placeholder:text-ink/40 focus:shadow-sm focus:outline-none ${
                            touchedStep4.phoneNumber && step4FieldErrors.phoneNumber
                              ? 'border-[var(--palette-danger)] focus:border-[var(--palette-danger)]'
                              : 'border-[var(--palette-gold)]/30 hover:border-[var(--palette-gold)]/55 focus:border-[var(--palette-gold-ink)]'
                          }`}
                        />
                      </div>
                    </div>
                    {touchedStep4.phoneNumber && step4FieldErrors.phoneNumber ? (
                      <p
                        id="booking-phone-error"
                        role="alert"
                        className="mt-1.5 flex items-center gap-1.5 font-sans text-xs text-[var(--palette-danger)]"
                      >
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{step4FieldErrors.phoneNumber}</span>
                      </p>
                    ) : null}
                  </div>

                  {/* Facebook Account */}
                  <div>
                    <label
                      htmlFor="booking-facebook"
                      className="mb-2 flex items-center justify-between font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]"
                    >
                      <span>
                        Facebook Account{' '}
                        <span className="text-[var(--palette-danger)]" aria-hidden="true">
                          *
                        </span>
                      </span>
                      {!step4FieldErrors.facebookAccount ? (
                        <CheckCircle2
                          className="h-4 w-4 text-[var(--palette-success)]"
                          aria-label="Valid"
                        />
                      ) : null}
                    </label>
                    <div className="relative">
                      <AtSign
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-4 z-10 h-4 w-4 -translate-y-1/2 text-[var(--palette-gold-ink)]"
                      />
                      <input
                        id="booking-facebook"
                        type="text"
                        required
                        aria-invalid={
                          touchedStep4.facebookAccount && Boolean(step4FieldErrors.facebookAccount)
                        }
                        aria-describedby={
                          touchedStep4.facebookAccount && step4FieldErrors.facebookAccount
                            ? 'booking-facebook-error'
                            : undefined
                        }
                        value={form.facebookAccount}
                        onBlur={() =>
                          setTouchedStep4((prev) => ({ ...prev, facebookAccount: true }))
                        }
                        onChange={(event) => {
                          setForm((prev) => ({ ...prev, facebookAccount: event.target.value }));
                          setStepError('');
                        }}
                        placeholder="facebook.com/yourprofile or FB name"
                        className={`w-full rounded-2xl border bg-[var(--palette-white)] py-3.5 pr-4 pl-11 font-sans text-sm text-ink shadow-2xs transition-all placeholder:text-ink/40 focus:shadow-sm focus:outline-none ${
                          touchedStep4.facebookAccount && step4FieldErrors.facebookAccount
                            ? 'border-[var(--palette-danger)] focus:border-[var(--palette-danger)]'
                            : 'border-[var(--palette-gold)]/30 hover:border-[var(--palette-gold)]/55 focus:border-[var(--palette-gold-ink)]'
                        }`}
                      />
                    </div>
                    {touchedStep4.facebookAccount && step4FieldErrors.facebookAccount ? (
                      <p
                        id="booking-facebook-error"
                        role="alert"
                        className="mt-1.5 flex items-center gap-1.5 font-sans text-xs text-[var(--palette-danger)]"
                      >
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{step4FieldErrors.facebookAccount}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Optional Special Requests */}
                <div>
                  <label
                    htmlFor="booking-notes"
                    className="mb-2 block font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]"
                  >
                    Special Requests <span className="font-normal text-ink/50">(Optional)</span>
                  </label>
                  <textarea
                    id="booking-notes"
                    rows={3}
                    value={form.notes}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    placeholder="Color motif, setup preferences, or special instructions…"
                    className="w-full rounded-2xl border border-[var(--palette-gold)]/30 bg-[var(--palette-white)] p-4 font-sans text-sm text-ink shadow-2xs transition-all placeholder:text-ink/40 hover:border-[var(--palette-gold)]/55 focus:border-[var(--palette-gold-ink)] focus:shadow-sm focus:outline-none"
                  />
                </div>
              </div>
            ) : null}

            {/* STEP 5: Final Review with Direct Inline Editing */}
            {currentStep === 5 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Step 1 Review / Inline Edit Card */}
                  <div
                    className={`rounded-2xl border p-4 transition-all ${
                      editingReviewStep === 1
                        ? 'border-[var(--palette-gold)] bg-[var(--palette-white)] shadow-md sm:col-span-2'
                        : 'border-[var(--palette-gold)]/20 bg-[var(--palette-cream)]/35'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]">
                        Step 1 · Celebration
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleReviewEdit(1)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-xs font-semibold transition-colors ${
                          editingReviewStep === 1
                            ? 'bg-[var(--palette-booklet-cover)] text-[var(--text-on-action)] hover:bg-[var(--palette-client-button-hover)]'
                            : 'text-ink underline underline-offset-4 hover:text-[var(--palette-gold-ink)]'
                        }`}
                      >
                        {editingReviewStep === 1 ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Save Changes</span>
                          </>
                        ) : (
                          <>
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                            <span>Edit</span>
                          </>
                        )}
                      </button>
                    </div>

                    {editingReviewStep === 1 ? (
                      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        {EVENT_TYPES.map((eventItem) => {
                          const selected = form.eventType === eventItem.id;
                          return (
                            <button
                              key={eventItem.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => handleSelectEventType(eventItem.id)}
                              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left font-sans text-xs font-semibold transition-all ${
                                selected
                                  ? 'border-[var(--palette-gold)] bg-[var(--palette-cream)] text-ink shadow-xs'
                                  : 'border-[var(--palette-gold)]/25 bg-[var(--palette-white)] text-ink/80 hover:border-[var(--palette-gold)]/60'
                              }`}
                            >
                              <span aria-hidden="true" className="text-base leading-none">
                                {eventItem.emoji}
                              </span>
                              <span className="flex-1">{eventItem.label}</span>
                              {selected ? (
                                <Check
                                  className="h-3.5 w-3.5 text-[var(--palette-gold-ink)]"
                                  aria-hidden="true"
                                />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 font-serif text-xl text-ink">{form.eventType}</p>
                    )}
                  </div>

                  {/* Step 2 Review / Inline Edit Card */}
                  <div
                    className={`rounded-2xl border p-4 transition-all ${
                      editingReviewStep === 2
                        ? 'border-[var(--palette-gold)] bg-[var(--palette-white)] shadow-md sm:col-span-2'
                        : 'border-[var(--palette-gold)]/20 bg-[var(--palette-cream)]/35'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]">
                        Step 2 · Package &amp; Guests
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleReviewEdit(2)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-xs font-semibold transition-colors ${
                          editingReviewStep === 2
                            ? 'bg-[var(--palette-booklet-cover)] text-[var(--text-on-action)] hover:bg-[var(--palette-client-button-hover)]'
                            : 'text-ink underline underline-offset-4 hover:text-[var(--palette-gold-ink)]'
                        }`}
                      >
                        {editingReviewStep === 2 ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Save Changes</span>
                          </>
                        ) : (
                          <>
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                            <span>Edit</span>
                          </>
                        )}
                      </button>
                    </div>

                    {editingReviewStep === 2 ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink/70">
                            Package Style
                          </p>
                          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                            {PACKAGE_STYLES.map((tier) => {
                              const selected = form.packageTier === tier.id;
                              return (
                                <button
                                  key={tier.id}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => {
                                    setForm((prev) => ({ ...prev, packageTier: tier.id }));
                                    setStepError('');
                                  }}
                                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left font-sans text-xs font-semibold transition-all ${
                                    selected
                                      ? 'border-[var(--palette-gold)] bg-[var(--palette-cream)] text-ink shadow-xs'
                                      : 'border-[var(--palette-gold)]/25 bg-[var(--palette-white)] text-ink/80 hover:border-[var(--palette-gold)]/60'
                                  }`}
                                >
                                  <span>{tier.label}</span>
                                  {selected ? (
                                    <Check
                                      className="h-3.5 w-3.5 text-[var(--palette-gold-ink)]"
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-xl border border-[var(--palette-gold)]/20 bg-[var(--palette-cream)]/35 p-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <label
                                htmlFor="review-guest-count"
                                className="block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink/70"
                              >
                                Estimated Guests
                              </label>
                              <p className="font-sans text-xs text-ink/65">
                                {getGuestScaleLabel(form.guestCount)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                aria-label="Decrease guest count by 1"
                                onClick={() => adjustGuestCount(-1)}
                                disabled={form.guestCount <= 1}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--palette-gold)]/40 bg-[var(--palette-white)] text-ink transition-colors hover:bg-[var(--palette-cream)] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Minus className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <input
                                id="review-guest-count"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                aria-label="Estimated guest count"
                                value={form.guestCount === 0 ? '' : String(form.guestCount)}
                                onChange={(event) => {
                                  const raw = event.target.value.replace(/\D/g, '');
                                  const parsed = raw === '' ? 0 : Number.parseInt(raw, 10);
                                  setForm((prev) => ({
                                    ...prev,
                                    guestCount: Math.min(500, Math.max(0, parsed)),
                                  }));
                                  setStepError('');
                                }}
                                onBlur={() => {
                                  if (form.guestCount < 1) {
                                    setForm((prev) => ({ ...prev, guestCount: 1 }));
                                  }
                                }}
                                className={`${styles.guestCountInput} w-16 bg-transparent text-center font-serif text-2xl font-bold text-ink`}
                              />
                              <button
                                type="button"
                                aria-label="Increase guest count by 1"
                                onClick={() => adjustGuestCount(1)}
                                disabled={form.guestCount >= 500}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--palette-booklet-cover)] bg-[var(--palette-booklet-cover)] text-[var(--text-on-action)] transition-colors hover:bg-[var(--palette-client-button-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {GUEST_PRESETS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  setForm((prev) => ({ ...prev, guestCount: preset }));
                                  setStepError('');
                                }}
                                className={`rounded-full border px-3 py-1 font-sans text-xs font-semibold transition-colors ${
                                  form.guestCount === preset
                                    ? 'border-[var(--palette-gold)] bg-[var(--palette-booklet-cover)] text-[var(--text-on-action)]'
                                    : 'border-[var(--palette-gold)]/25 bg-[var(--palette-white)] text-ink/75 hover:border-[var(--palette-gold)]'
                                }`}
                              >
                                {preset} pax
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mt-2 font-serif text-lg text-ink">{form.packageTier}</p>
                        <p className="mt-0.5 font-sans text-xs text-ink/75">
                          {form.guestCount} guests · Exclusive full-day booking
                        </p>
                      </>
                    )}
                  </div>

                  {/* Step 3 Review / Inline Edit Card */}
                  <div
                    className={`rounded-2xl border p-4 transition-all ${
                      editingReviewStep === 3
                        ? 'border-[var(--palette-gold)] bg-[var(--palette-white)] shadow-md sm:col-span-2'
                        : 'border-[var(--palette-gold)]/20 bg-[var(--palette-cream)]/35'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]">
                        Step 3 · Date &amp; Budget
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleReviewEdit(3)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-xs font-semibold transition-colors ${
                          editingReviewStep === 3
                            ? 'bg-[var(--palette-booklet-cover)] text-[var(--text-on-action)] hover:bg-[var(--palette-client-button-hover)]'
                            : 'text-ink underline underline-offset-4 hover:text-[var(--palette-gold-ink)]'
                        }`}
                      >
                        {editingReviewStep === 3 ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Save Changes</span>
                          </>
                        ) : (
                          <>
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                            <span>Edit</span>
                          </>
                        )}
                      </button>
                    </div>

                    {editingReviewStep === 3 ? (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label
                            htmlFor="review-event-date"
                            className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink/70"
                          >
                            Celebration Date
                          </label>
                          <ZionDatePicker
                            id="review-event-date"
                            value={form.eventDate}
                            minDate={todayIso}
                            getDateStatus={getDateStatus}
                            onChange={(nextDate) => {
                              setForm((prev) => ({ ...prev, eventDate: nextDate }));
                              setStepError('');
                            }}
                          />
                          {selectedDateStatus === 'inquired' ? (
                            <p className="mt-2 flex items-start gap-2 rounded-xl border border-[var(--palette-warning)]/40 bg-[var(--palette-warning-soft)] px-3 py-2 font-sans text-xs text-ink">
                              <AlertTriangle
                                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--palette-warning)]"
                                aria-hidden="true"
                              />
                              <span>
                                Available, but another client is currently inquiring for this date —
                                complete your booking to secure it right away.
                              </span>
                            </p>
                          ) : null}
                        </div>

                        <div>
                          <p className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink/70">
                            Budget Range
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {activeBudgetRanges.map((budget) => {
                              const selected = form.budgetRange === budget.id;
                              return (
                                <button
                                  key={budget.id}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => {
                                    setForm((prev) => ({ ...prev, budgetRange: budget.id }));
                                    setStepError('');
                                  }}
                                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left font-sans text-xs font-semibold transition-all ${
                                    selected
                                      ? 'border-[var(--palette-gold)] bg-[var(--palette-cream)] text-ink shadow-xs'
                                      : 'border-[var(--palette-gold)]/25 bg-[var(--palette-white)] text-ink/80 hover:border-[var(--palette-gold)]/60'
                                  }`}
                                >
                                  <span>{budget.label}</span>
                                  {selected ? (
                                    <Check
                                      className="h-3.5 w-3.5 shrink-0 text-[var(--palette-gold-ink)]"
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink/70">
                            Curated Add-Ons
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {CURATED_ADDONS.map((addon) => {
                              const active = form.addOns.includes(addon);
                              return (
                                <button
                                  key={addon}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => toggleAddOn(addon)}
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-sans text-xs font-medium transition-all ${
                                    active
                                      ? 'border-[var(--palette-gold)] bg-[var(--palette-gold)] text-[var(--palette-white)]'
                                      : 'border-[var(--palette-gold)]/25 bg-[var(--palette-white)] text-ink/80 hover:border-[var(--palette-gold)]'
                                  }`}
                                >
                                  {active ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
                                  <span>{addon}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mt-2 font-serif text-lg text-ink">
                          {formatReadableDate(form.eventDate)}
                        </p>
                        <p className="mt-0.5 font-sans text-xs text-ink/75">
                          {form.budgetRange}
                          {form.addOns.length > 0 ? ` · ${form.addOns.length} add-on(s)` : ''}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Step 4 Review / Inline Edit Card */}
                  <div
                    className={`rounded-2xl border p-4 transition-all ${
                      editingReviewStep === 4
                        ? 'border-[var(--palette-gold)] bg-[var(--palette-white)] shadow-md sm:col-span-2'
                        : 'border-[var(--palette-gold)]/20 bg-[var(--palette-cream)]/35'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]">
                        Step 4 · Client Details
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleReviewEdit(4)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-xs font-semibold transition-colors ${
                          editingReviewStep === 4
                            ? 'bg-[var(--palette-booklet-cover)] text-[var(--text-on-action)] hover:bg-[var(--palette-client-button-hover)]'
                            : 'text-ink underline underline-offset-4 hover:text-[var(--palette-gold-ink)]'
                        }`}
                      >
                        {editingReviewStep === 4 ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Save Changes</span>
                          </>
                        ) : (
                          <>
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                            <span>Edit</span>
                          </>
                        )}
                      </button>
                    </div>

                    {editingReviewStep === 4 ? (
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label
                            htmlFor="review-full-name"
                            className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink/75"
                          >
                            Client Full Name <span className="text-[var(--palette-danger)]">*</span>
                          </label>
                          <input
                            id="review-full-name"
                            type="text"
                            required
                            aria-invalid={Boolean(step4FieldErrors.fullName)}
                            value={form.fullName}
                            onChange={(event) => {
                              setForm((prev) => ({ ...prev, fullName: event.target.value }));
                              setStepError('');
                            }}
                            className={`w-full rounded-xl border bg-[var(--palette-white)] px-3.5 py-2.5 font-sans text-sm text-ink focus:outline-none ${
                              step4FieldErrors.fullName
                                ? 'border-[var(--palette-danger)]'
                                : 'border-[var(--palette-gold)]/30 focus:border-[var(--palette-gold-ink)]'
                            }`}
                          />
                          {step4FieldErrors.fullName ? (
                            <p
                              role="alert"
                              className="mt-1 font-sans text-xs text-[var(--palette-danger)]"
                            >
                              {step4FieldErrors.fullName}
                            </p>
                          ) : null}
                        </div>

                        <div>
                          <label
                            htmlFor="review-email"
                            className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink/75"
                          >
                            Email Address <span className="text-[var(--palette-danger)]">*</span>
                          </label>
                          <input
                            id="review-email"
                            type="email"
                            required
                            aria-invalid={Boolean(step4FieldErrors.email)}
                            value={form.email}
                            onChange={(event) => {
                              setForm((prev) => ({ ...prev, email: event.target.value }));
                              setStepError('');
                            }}
                            className={`w-full rounded-xl border bg-[var(--palette-white)] px-3.5 py-2.5 font-sans text-sm text-ink focus:outline-none ${
                              step4FieldErrors.email
                                ? 'border-[var(--palette-danger)]'
                                : 'border-[var(--palette-gold)]/30 focus:border-[var(--palette-gold-ink)]'
                            }`}
                          />
                          {step4FieldErrors.email ? (
                            <p
                              role="alert"
                              className="mt-1 font-sans text-xs text-[var(--palette-danger)]"
                            >
                              {step4FieldErrors.email}
                            </p>
                          ) : null}
                        </div>

                        <div>
                          <label
                            htmlFor="review-phone"
                            className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink/75"
                          >
                            Mobile Number <span className="text-[var(--palette-danger)]">*</span>
                          </label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <div className="sm:w-40">
                              <ZionSelectPopover
                                ariaLabel="Country calling code"
                                value={form.countryCode}
                                options={COUNTRY_CODES}
                                onChange={(value) => {
                                  setForm((prev) => ({
                                    ...prev,
                                    countryCode: value,
                                    phoneNumber: formatPhoneForCountry(value, prev.phoneNumber),
                                  }));
                                  setStepError('');
                                }}
                              />
                            </div>
                            <input
                              id="review-phone"
                              type="tel"
                              required
                              inputMode="numeric"
                              maxLength={getPhoneRule(form.countryCode).placeholder.length}
                              placeholder={getPhoneRule(form.countryCode).placeholder}
                              aria-invalid={Boolean(step4FieldErrors.phoneNumber)}
                              value={form.phoneNumber}
                              onChange={(event) => {
                                const formatted = formatPhoneForCountry(
                                  form.countryCode,
                                  event.target.value,
                                );
                                setForm((prev) => ({ ...prev, phoneNumber: formatted }));
                                setStepError('');
                              }}
                              className={`flex-1 rounded-xl border bg-[var(--palette-white)] px-3.5 py-2.5 font-sans text-sm text-ink focus:outline-none ${
                                step4FieldErrors.phoneNumber
                                  ? 'border-[var(--palette-danger)]'
                                  : 'border-[var(--palette-gold)]/30 focus:border-[var(--palette-gold-ink)]'
                              }`}
                            />
                          </div>
                          {step4FieldErrors.phoneNumber ? (
                            <p
                              role="alert"
                              className="mt-1 font-sans text-xs text-[var(--palette-danger)]"
                            >
                              {step4FieldErrors.phoneNumber}
                            </p>
                          ) : null}
                        </div>

                        <div>
                          <label
                            htmlFor="review-facebook"
                            className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink/75"
                          >
                            Facebook Account <span className="text-[var(--palette-danger)]">*</span>
                          </label>
                          <input
                            id="review-facebook"
                            type="text"
                            required
                            aria-invalid={Boolean(step4FieldErrors.facebookAccount)}
                            value={form.facebookAccount}
                            onChange={(event) => {
                              setForm((prev) => ({ ...prev, facebookAccount: event.target.value }));
                              setStepError('');
                            }}
                            className={`w-full rounded-xl border bg-[var(--palette-white)] px-3.5 py-2.5 font-sans text-sm text-ink focus:outline-none ${
                              step4FieldErrors.facebookAccount
                                ? 'border-[var(--palette-danger)]'
                                : 'border-[var(--palette-gold)]/30 focus:border-[var(--palette-gold-ink)]'
                            }`}
                          />
                          {step4FieldErrors.facebookAccount ? (
                            <p
                              role="alert"
                              className="mt-1 font-sans text-xs text-[var(--palette-danger)]"
                            >
                              {step4FieldErrors.facebookAccount}
                            </p>
                          ) : null}
                        </div>

                        <div className="md:col-span-2">
                          <label
                            htmlFor="review-notes"
                            className="mb-1.5 block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink/75"
                          >
                            Booking Requests &amp; Styling Notes (Optional)
                          </label>
                          <textarea
                            id="review-notes"
                            rows={2}
                            value={form.notes}
                            onChange={(event) =>
                              setForm((prev) => ({ ...prev, notes: event.target.value }))
                            }
                            className="w-full rounded-xl border border-[var(--palette-gold)]/30 bg-[var(--palette-white)] p-3 font-sans text-sm text-ink focus:border-[var(--palette-gold-ink)] focus:outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mt-2 font-serif text-lg text-ink">{form.fullName}</p>
                        <p className="mt-0.5 font-sans text-xs text-ink/75">
                          {form.email} · {form.countryCode} {form.phoneNumber}
                        </p>
                        <p className="mt-0.5 font-sans text-xs text-ink/75">
                          Facebook: {form.facebookAccount}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Validation feedback */}
            {stepError ? (
              <div
                role="alert"
                className="mt-5 flex items-center gap-2.5 rounded-2xl border border-[var(--palette-danger)]/30 bg-[var(--palette-danger-soft)] px-4 py-3 font-sans text-sm text-[var(--palette-danger)]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{stepError}</span>
              </div>
            ) : null}

            {/* Step Navigation Footer */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--palette-gold)]/20 pt-6">
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={currentStep === 1}
                className={`inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--palette-gold)]/35 px-5 py-2.5 font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink transition-colors ${
                  currentStep === 1
                    ? 'cursor-not-allowed opacity-40'
                    : 'hover:bg-[var(--palette-cream)]'
                }`}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={handleNextStep}
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--palette-booklet-cover)] bg-[var(--palette-booklet-cover)] px-8 py-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-on-action)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--palette-client-button-hover)] hover:shadow-md"
              >
                <span>{currentStep === 5 ? 'View Suggested Packages' : 'Next'}</span>
                {currentStep === 5 ? (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </section>

          {/* Right Live Journey Summary Sidebar (Fixed Position) */}
          <aside
            aria-label="Live event selections"
            className="rounded-[2rem] border border-[var(--palette-gold)]/25 bg-[var(--palette-paper)]/90 p-6 shadow-sm lg:col-span-3"
          >
            <div className="flex items-center justify-between border-b border-[var(--palette-gold)]/20 pb-4">
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--palette-gold-ink)]">
                  Live Overview
                </p>
                <h3 className="mt-0.5 font-serif text-xl text-ink">Your Celebration</h3>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--palette-cream)] text-[var(--palette-gold-ink)]">
                <Sparkles className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </span>
            </div>

            <dl className="mt-5 space-y-4 font-sans text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-2 text-ink/65">
                  <PartyPopper
                    className="h-4 w-4 shrink-0 text-[var(--palette-gold-ink)]"
                    aria-hidden="true"
                  />
                  <span>Occasion</span>
                </dt>
                <dd className="text-right font-medium text-ink">
                  {form.eventType || 'Not selected yet'}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-2 text-ink/65">
                  <Award
                    className="h-4 w-4 shrink-0 text-[var(--palette-gold-ink)]"
                    aria-hidden="true"
                  />
                  <span>Package</span>
                </dt>
                <dd className="text-right font-medium text-ink">
                  {form.packageTier || 'Not selected yet'}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-2 text-ink/65">
                  <Users
                    className="h-4 w-4 shrink-0 text-[var(--palette-gold-ink)]"
                    aria-hidden="true"
                  />
                  <span>Guests</span>
                </dt>
                <dd className="text-right font-medium text-ink">{form.guestCount} pax</dd>
              </div>

              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-2 text-ink/65">
                  <Calendar
                    className="h-4 w-4 shrink-0 text-[var(--palette-gold-ink)]"
                    aria-hidden="true"
                  />
                  <span>Event Date</span>
                </dt>
                <dd className="text-right font-medium text-ink">
                  {form.eventDate ? formatReadableDate(form.eventDate) : 'Not selected yet'}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-2 text-ink/65">
                  <Wallet
                    className="h-4 w-4 shrink-0 text-[var(--palette-gold-ink)]"
                    aria-hidden="true"
                  />
                  <span>Budget</span>
                </dt>
                <dd className="text-right font-medium text-ink">
                  {form.budgetRange || 'Not selected yet'}
                </dd>
              </div>
            </dl>

            <div className="mt-6 rounded-2xl bg-[var(--palette-cream)]/55 p-4 font-sans text-xs leading-relaxed text-ink/75">
              Complete all 5 steps to generate your official Zion booking summary and send it
              directly to our events coordinators.
            </div>
          </aside>
        </div>
      ) : null}

      {/* PHASE 2: Zion Center-Logo Loading Screen */}
      {phase === 'loading' ? (
        <section
          aria-live="polite"
          aria-label="Preparing your booking summary"
          className="flex min-h-[26rem] flex-col items-center justify-center rounded-[2rem] border border-[var(--palette-gold)]/30 bg-[var(--palette-paper)]/95 px-6 py-16 text-center shadow-[0_24px_60px_-30px_color-mix(in_srgb,var(--palette-ink)_22%,transparent)]"
        >
          <div className={styles.zionLoaderRing} role="status">
            <span className={styles.zionLoaderTrack} aria-hidden="true" />
            <span className={styles.zionLoaderArcOuter} aria-hidden="true" />
            <span className={styles.zionLoaderArcInner} aria-hidden="true" />
            <span className={styles.zionLoaderCore}>
              <Image
                src={BRAND.logo.src}
                alt={BRAND.logo.alt}
                width={180}
                height={100}
                priority
                className="h-auto w-full object-contain"
              />
            </span>
          </div>

          <h2 className="mt-8 font-serif text-2xl text-ink sm:text-3xl">
            Curating Your Best-Match Packages
          </h2>
          <p className="mt-2 font-sans text-sm text-ink/70">{LOADING_MESSAGES[loadingStepIndex]}</p>
        </section>
      ) : null}

      {/* PHASE 2B: Relevant Package Suggestions Ranked by Relevancy */}
      {phase === 'suggestions' ? (
        <PackageSuggestionsView
          eventType={form.eventType}
          guestCount={form.guestCount}
          eventDateLabel={formatReadableDate(form.eventDate)}
          budgetRange={form.budgetRange}
          recommendations={recommendations}
          selectedPackageId={selectedRecommendation?.pkg.id ?? ''}
          onSelectPackage={(pkgId) => setSelectedPackageId(pkgId)}
          onBackToReview={() => {
            setPhase('journey');
            setCurrentStep(5);
            scrollToTopOfJourney();
          }}
          onProceedToDownpayment={() => {
            setPhase('downpayment');
            scrollToTopOfJourney();
          }}
        />
      ) : null}

      {/* PHASE 2C: Required Downpayment to Secure Exclusive Date */}
      {phase === 'downpayment' && selectedRecommendation ? (
        <DownpaymentView
          eventType={form.eventType}
          guestCount={form.guestCount}
          eventDateLabel={formatReadableDate(form.eventDate)}
          selectedRecommendation={selectedRecommendation}
          downpayment={downpayment}
          onChangeDownpayment={setDownpayment}
          onBackToSuggestions={() => {
            setPhase('suggestions');
            scrollToTopOfJourney();
          }}
          onSubmitDownpayment={() => {
            setBookingRef(generateBookingReference());
            setPhase('summary');
            scrollToTopOfJourney();
          }}
        />
      ) : null}

      {/* PHASE 3: Official Booking & Downpayment Receipt (PDF / Print Ready) */}
      {phase === 'summary' ? (
        <OfficialBookingReceipt
          bookingRef={bookingRef}
          eventType={form.eventType}
          packageTier={form.packageTier}
          guestCount={form.guestCount}
          eventDateLabel={formatReadableDate(form.eventDate)}
          budgetRange={form.budgetRange}
          addOns={form.addOns}
          fullName={form.fullName}
          email={form.email}
          countryCode={form.countryCode}
          phoneNumber={form.phoneNumber}
          facebookAccount={form.facebookAccount}
          notes={form.notes}
          selectedRecommendation={selectedRecommendation}
          downpayment={downpayment}
          isSendingInquiry={isSendingInquiry}
          inquiryFeedback={inquiryFeedback}
          onSendToZion={handleSendToZion}
          onResetJourney={handleResetJourney}
        />
      ) : null}
    </div>
  );
}
