'use client';

import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Tag,
  User,
} from 'lucide-react';
import ZionSelectPopover from '@/components/client/ZionSelectPopover';
import { useReducedMotion } from '@/components/shared/useReducedMotion';

const COUNTRIES = [
  {
    code: '+63',
    iso: 'ph',
    label: 'Philippines',
    format: '9XX XXX XXXX',
    regex: /^(\d{0,3})(\d{0,3})(\d{0,4})$/,
  },
  {
    code: '+1',
    iso: 'us',
    label: 'United States',
    format: 'XXX XXX XXXX',
    regex: /^(\d{0,3})(\d{0,3})(\d{0,4})$/,
  },
  {
    code: '+44',
    iso: 'gb',
    label: 'United Kingdom',
    format: 'XXXX XXXXXX',
    regex: /^(\d{0,4})(\d{0,6})$/,
  },
  {
    code: '+61',
    iso: 'au',
    label: 'Australia',
    format: '4XX XXX XXX',
    regex: /^(\d{0,3})(\d{0,3})(\d{0,3})$/,
  },
  {
    code: '+65',
    iso: 'sg',
    label: 'Singapore',
    format: 'XXXX XXXX',
    regex: /^(\d{0,4})(\d{0,4})$/,
  },
  {
    code: '+81',
    iso: 'jp',
    label: 'Japan',
    format: 'XX XXXX XXXX',
    regex: /^(\d{0,2})(\d{0,4})(\d{0,4})$/,
  },
  {
    code: '+82',
    iso: 'kr',
    label: 'South Korea',
    format: 'XX XXXX XXXX',
    regex: /^(\d{0,2})(\d{0,4})(\d{0,4})$/,
  },
  {
    code: '+86',
    iso: 'cn',
    label: 'China',
    format: '1XX XXXX XXXX',
    regex: /^(\d{0,3})(\d{0,4})(\d{0,4})$/,
  },
  {
    code: '+971',
    iso: 'ae',
    label: 'UAE',
    format: '5X XXX XXXX',
    regex: /^(\d{0,2})(\d{0,3})(\d{0,4})$/,
  },
  {
    code: '+49',
    iso: 'de',
    label: 'Germany',
    format: '15X XXXXXXX',
    regex: /^(\d{0,3})(\d{0,7})$/,
  },
  {
    code: '+33',
    iso: 'fr',
    label: 'France',
    format: 'X XX XX XX XX',
    regex: /^(\d{0,1})(\d{0,2})(\d{0,2})(\d{0,2})(\d{0,2})$/,
  },
  { code: '+39', iso: 'it', label: 'Italy', format: '3XX XXXXXXX', regex: /^(\d{0,3})(\d{0,7})$/ },
  {
    code: '+34',
    iso: 'es',
    label: 'Spain',
    format: '6XX XXX XXX',
    regex: /^(\d{0,3})(\d{0,3})(\d{0,3})$/,
  },
  {
    code: '+55',
    iso: 'br',
    label: 'Brazil',
    format: 'XX 9XXXX XXXX',
    regex: /^(\d{0,2})(\d{0,5})(\d{0,4})$/,
  },
  { code: '+91', iso: 'in', label: 'India', format: '9XXXX XXXXX', regex: /^(\d{0,5})(\d{0,5})$/ },
];

const SUBJECT_OPTIONS = [
  'General Message',
  'Feedback / Suggestion',
  'Technical Issue',
  'Concern / Complaint',
  'Others',
];

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phoneNumber: '',
  subject: '',
  message: '',
};

const ERROR_TOAST_VISIBLE_DURATION_MS = 5000;
const SUCCESS_TOAST_VISIBLE_DURATION_MS = 3000;
const TOAST_EXIT_DURATION_MS = 280;

type FieldErrors = {
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  subject?: string;
  message?: string;
};

function inputSurfaceClass(invalid: boolean) {
  return invalid
    ? 'border-zion-accent/70 bg-[var(--palette-gold-soft)]/90 ring-4 ring-zion-accent/10'
    : 'border-zion-accent/25 bg-surface/80';
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, '');
}

function selectedPhoneCountry(code: string) {
  return COUNTRIES.find((country) => country.code === code) || COUNTRIES[0];
}

function requiredPhoneDigits(format: string) {
  return (format.match(/[X0-9]/g) || []).length;
}

function FormNotice({
  tone,
  title,
  children,
}: {
  tone: 'warning' | 'success';
  title: string;
  children: React.ReactNode;
}) {
  const isSuccess = tone === 'success';
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-[0_10px_30px_color-mix(in_srgb,var(--palette-night)_6%,transparent)] backdrop-blur-md ${
        isSuccess
          ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-900'
          : 'border-zion-accent/35 bg-[var(--palette-gold-soft)]/95 text-[var(--palette-gold-ink)]'
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-zion-accent/15 text-accent-ink'}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-serif text-base font-semibold leading-snug">{title}</span>
        <span className="mt-0.5 block font-sans text-sm font-medium leading-relaxed opacity-85">
          {children}
        </span>
      </span>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p
      id={id}
      className="mt-1 -mb-1 flex items-center gap-1.5 px-1.5 font-sans text-sm font-semibold leading-relaxed text-accent-ink animate-[fadeInUp_160ms_ease-out]"
    >
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

function ValidationToast({
  tone,
  title,
  message,
  leaving = false,
}: {
  tone: 'warning' | 'success';
  title: string;
  message: string;
  leaving?: boolean;
}) {
  const isSuccess = tone === 'success';
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed right-3 top-24 z-[1000] w-[calc(100vw-1.5rem)] max-w-sm sm:right-6">
      <div
        key={`${tone}-${message}`}
        role={isSuccess ? 'status' : 'alert'}
        className={`relative overflow-hidden rounded-2xl border shadow-[0_22px_60px_color-mix(in_srgb,var(--palette-night)_18%,transparent)] ring-1 ring-white/70 backdrop-blur-xl motion-reduce:animate-none ${
          leaving
            ? 'animate-[inquiryToastSlideOutRight_280ms_ease-in_both]'
            : 'animate-[inquiryToastSlideInLeft_420ms_ease-out_both]'
        } ${
          isSuccess
            ? 'border-emerald-200/80 bg-emerald-50/95 text-emerald-950'
            : 'border-zion-accent/35 bg-[var(--palette-white)]/95 text-[var(--palette-forest)]'
        }`}
      >
        <div
          className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent ${isSuccess ? 'via-emerald-400/75' : 'via-zion-accent/70'} to-transparent`}
        />
        <div className="flex items-start gap-3 px-4 py-3">
          <span
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-zion-accent/15 text-accent-ink'}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-serif text-base font-semibold leading-snug text-ink">
              {title}
            </span>
            <span
              className={`mt-0.5 block font-sans text-sm font-medium leading-snug ${isSuccess ? 'text-emerald-900/85' : 'text-[var(--palette-gold-ink)]/85'}`}
            >
              {message}
            </span>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const COUNTRY_SELECT_OPTIONS = COUNTRIES.map((country) => ({
  value: country.code,
  label: `${country.label} (${country.code})`,
}));

function CountrySelect({
  value,
  disabled = false,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="composite-field-country-divider shrink-0">
      <ZionSelectPopover
        value={value}
        options={COUNTRY_SELECT_OPTIONS}
        ariaLabel="Country calling code"
        disabled={disabled}
        onChange={onChange}
        triggerClassName="composite-field-focus-target rounded-l-2xl bg-transparent py-3.5 pl-4 pr-3.5 hover:bg-[var(--palette-gold-soft)]/35"
        panelClassName="min-w-[14.5rem]"
      />
    </div>
  );
}

export default function InquiryForm({
  enabled = true,
  disabledMessage = 'Client inquiries are temporarily unavailable.',
}: {
  enabled?: boolean;
  disabledMessage?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [form, setForm] = useState(EMPTY_FORM);
  const [phoneCode, setPhoneCode] = useState('+63');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isToastLeaving, setIsToastLeaving] = useState(false);
  const [toastTick, setToastTick] = useState(0);
  const [placeholderText, setPlaceholderText] = useState('Write your message here...');
  const toastDismissTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const text = 'Write your message here...';
    if (prefersReducedMotion) {
      return;
    }

    let index = 0;
    let isDeleting = false;
    let timeoutId: NodeJS.Timeout;
    let blinkCount = 0;

    const animate = () => {
      const currentText = text.substring(0, index);

      if (!isDeleting && index === text.length) {
        if (blinkCount < 6) {
          setPlaceholderText(currentText + (blinkCount % 2 === 0 ? '|' : ''));
          blinkCount++;
          timeoutId = setTimeout(animate, 500);
        } else {
          isDeleting = true;
          blinkCount = 0;
          animate();
        }
      } else if (isDeleting && index === 0) {
        if (blinkCount < 2) {
          setPlaceholderText(blinkCount % 2 === 0 ? '|' : '');
          blinkCount++;
          timeoutId = setTimeout(animate, 400);
        } else {
          isDeleting = false;
          blinkCount = 0;
          animate();
        }
      } else {
        setPlaceholderText(currentText + '|');
        index += isDeleting ? -1 : 1;
        timeoutId = setTimeout(animate, isDeleting ? 30 : 80);
      }
    };

    timeoutId = setTimeout(animate, 500);
    return () => clearTimeout(timeoutId);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!error && !success) {
      return;
    }

    const visibleDuration = error
      ? ERROR_TOAST_VISIBLE_DURATION_MS
      : SUCCESS_TOAST_VISIBLE_DURATION_MS;
    toastDismissTimeoutRef.current = window.setTimeout(() => {
      setIsToastLeaving(true);

      toastDismissTimeoutRef.current = window.setTimeout(() => {
        setError('');
        setSuccess('');
        setIsToastLeaving(false);
        toastDismissTimeoutRef.current = null;
      }, TOAST_EXIT_DURATION_MS);
    }, visibleDuration);

    return () => {
      if (toastDismissTimeoutRef.current) {
        window.clearTimeout(toastDismissTimeoutRef.current);
        toastDismissTimeoutRef.current = null;
      }
    };
  }, [error, success, toastTick]);

  useEffect(() => {
    return () => {
      if (toastDismissTimeoutRef.current) {
        window.clearTimeout(toastDismissTimeoutRef.current);
        toastDismissTimeoutRef.current = null;
      }
    };
  }, []);

  const resetToastMotion = () => {
    if (toastDismissTimeoutRef.current) {
      window.clearTimeout(toastDismissTimeoutRef.current);
      toastDismissTimeoutRef.current = null;
    }
    setIsToastLeaving(false);
  };

  const clearNotice = () => {
    resetToastMotion();
    setError('');
    setSuccess('');
  };

  const showErrorToast = (message: string) => {
    setSuccess('');
    setError(message);
    setToastTick((current) => current + 1);
  };

  const showSuccessToast = (message: string) => {
    setError('');
    setSuccess(message);
    setToastTick((current) => current + 1);
  };

  const clearFieldError = (key: keyof FieldErrors) => {
    setFieldErrors((current) => {
      if (!current[key]) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const setField = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    clearFieldError(key);
    clearNotice();
  };

  const setPhoneCountry = (value: string) => {
    setPhoneCode(value);
    clearFieldError('phoneNumber');
    clearNotice();
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.startsWith('0')) {
      val = val.substring(1);
    }

    const country = selectedPhoneCountry(phoneCode);
    let formatted = val;

    const match = val.match(country.regex);
    if (match) {
      formatted = match.slice(1).filter(Boolean).join(' ');
    }

    setPhoneNumber(formatted);
    clearFieldError('phoneNumber');
    clearNotice();
  };

  const getPhonePlaceholder = () => {
    const country = selectedPhoneCountry(phoneCode);
    return country.format;
  };

  const getFieldError = (key: keyof FieldErrors) => {
    if (key === 'fullName' && !form.fullName.trim()) {
      return 'Please enter your full name.';
    }
    if (key === 'phoneNumber') {
      const country = selectedPhoneCountry(phoneCode);
      const currentDigits = phoneDigits(phoneNumber);
      const requiredDigits = requiredPhoneDigits(country.format);

      if (!currentDigits) {
        return 'Please enter your phone number.';
      }

      if (currentDigits.length < requiredDigits) {
        return `Please complete your phone number using the ${country.format} format.`;
      }
    }
    if (key === 'email') {
      if (!form.email.trim()) {
        return 'Please enter your email address.';
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        return 'Please enter a valid email address.';
      }
    }
    if (key === 'subject' && !form.subject.trim()) {
      return 'Please select a message subject.';
    }
    if (key === 'message') {
      if (!form.message.trim()) {
        return 'Please write your message.';
      }
      if (form.message.trim().length < 10) {
        return 'Please write a message with at least 10 characters.';
      }
    }

    return '';
  };

  const validateField = (key: keyof FieldErrors) => {
    if (!enabled) {
      return;
    }

    const fieldError = getFieldError(key);

    setFieldErrors((current) => {
      if (!fieldError && !current[key]) {
        return current;
      }
      const next = { ...current };
      if (fieldError) {
        next[key] = fieldError;
      } else {
        delete next[key];
      }
      return next;
    });

    if (fieldError) {
      setSuccess('');
    }
  };

  const validateInquiry = () => {
    const nextFieldErrors: FieldErrors = {};

    const fields: Array<keyof FieldErrors> = [
      'fullName',
      'phoneNumber',
      'email',
      'subject',
      'message',
    ];
    fields.forEach((field) => {
      const fieldError = getFieldError(field);
      if (fieldError) {
        nextFieldErrors[field] = fieldError;
      }
    });

    return {
      fieldErrors: nextFieldErrors,
      notice:
        Object.keys(nextFieldErrors).length > 0
          ? 'Please review the highlighted fields below before submitting.'
          : '',
    };
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    resetToastMotion();
    setError('');
    setSuccess('');
    setFieldErrors({});

    if (!enabled) {
      showErrorToast(disabledMessage);
      return;
    }

    const validation = validateInquiry();
    if (validation.notice) {
      setFieldErrors(validation.fieldErrors);
      showErrorToast(validation.notice);
      const firstInvalidKey = Object.keys(validation.fieldErrors)[0];
      if (firstInvalidKey === 'subject') {
        const firstSubjectBtn = event.currentTarget.querySelector<HTMLButtonElement>(
          'button[data-subject-option]',
        );
        firstSubjectBtn?.focus();
      } else {
        const field = event.currentTarget.elements.namedItem(firstInvalidKey);
        if (field instanceof HTMLElement) field.focus();
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/client/inquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          message: form.message.trim(),
          phoneNumber: `${phoneCode} ${phoneNumber}`.trim(),
          eventInterest: form.subject,
          sourcePage: 'contact_us',
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        inquiryReference?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            'Unable to submit your inquiry. Please check your details and try again.',
        );
      }

      showSuccessToast(payload.message || 'Your inquiry has been submitted successfully.');
      setForm(EMPTY_FORM);
      setFieldErrors({});
      setPhoneNumber('');
    } catch (caughtError) {
      showErrorToast(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to submit your inquiry. Please check your details and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const commonInputClasses = (invalid: boolean) =>
    `peer w-full rounded-2xl border ${inputSurfaceClass(invalid)} py-3.5 pl-12 pr-5 font-sans text-sm text-ink shadow-sm backdrop-blur-md transition-all duration-300 placeholder:text-muted/70 hover:border-zion-accent/45 hover:bg-surface focus:border-zion-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-zion-accent/15 disabled:cursor-not-allowed`;

  return (
    <>
      {error && (
        <ValidationToast
          tone="warning"
          title="Almost there"
          message={error}
          leaving={isToastLeaving}
        />
      )}
      {!error && success && (
        <ValidationToast
          tone="success"
          title="Message sent"
          message={success}
          leaving={isToastLeaving}
        />
      )}

      <form
        className="relative z-10 flex w-full flex-col gap-6"
        onSubmit={submit}
        noValidate
        aria-busy={isSubmitting}
      >
        {!enabled && (
          <FormNotice tone="warning" title="Messages paused">
            {disabledMessage}
          </FormNotice>
        )}

        {/* Full Name */}
        <div className="group/input relative z-50">
          <label
            htmlFor="contact-name"
            className="mb-2.5 block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink"
          >
            Full Name <span className="text-accent-ink">*</span>
          </label>
          <div className="relative flex items-center">
            <User
              aria-hidden="true"
              className="pointer-events-none absolute left-4 z-10 h-4 w-4 text-accent-ink transition-transform duration-300 group-focus-within/input:scale-110"
            />
            <input
              required
              disabled={!enabled}
              aria-invalid={fieldErrors.fullName ? true : undefined}
              aria-describedby={
                fieldErrors.fullName ? 'contact-message-full-name-error' : undefined
              }
              maxLength={180}
              type="text"
              id="contact-name"
              name="fullName"
              autoComplete="name"
              placeholder="Enter your full name"
              value={form.fullName}
              onChange={(event) => setField('fullName', event.target.value)}
              onBlur={() => validateField('fullName')}
              className={commonInputClasses(Boolean(fieldErrors.fullName))}
            />
          </div>
          <FieldError id="contact-message-full-name-error" message={fieldErrors.fullName} />
        </div>

        {/* Phone Number (Full Width for Ample Room) */}
        <div className="group/input relative z-40">
          <label
            htmlFor="contact-phone"
            className="mb-2.5 block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink"
          >
            Phone Number <span className="text-accent-ink">*</span>
          </label>
          <div
            className={`composite-field-focus-shell flex overflow-hidden rounded-2xl border ${inputSurfaceClass(Boolean(fieldErrors.phoneNumber))} shadow-sm backdrop-blur-md transition-all duration-300 hover:border-zion-accent/45 hover:bg-surface focus-within:border-zion-accent focus-within:bg-surface focus-within:ring-4 focus-within:ring-zion-accent/15`}
          >
            <CountrySelect value={phoneCode} disabled={!enabled} onChange={setPhoneCountry} />
            <div className="relative flex min-w-0 flex-1 items-center rounded-r-2xl">
              <Phone
                aria-hidden="true"
                className="pointer-events-none absolute left-4 z-10 h-4 w-4 text-accent-ink transition-transform duration-300 group-focus-within/input:scale-110"
              />
              <input
                required
                disabled={!enabled}
                aria-invalid={fieldErrors.phoneNumber ? true : undefined}
                aria-describedby={
                  fieldErrors.phoneNumber ? 'contact-message-phone-error' : undefined
                }
                maxLength={40}
                id="contact-phone"
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                value={phoneNumber}
                onChange={handlePhoneChange}
                onBlur={() => validateField('phoneNumber')}
                placeholder={getPhonePlaceholder()}
                className="composite-field-focus-target min-w-0 flex-1 rounded-r-2xl bg-transparent py-3.5 pl-11 pr-5 font-sans text-sm text-ink placeholder:text-muted/70 focus:outline-none"
              />
            </div>
          </div>
          <FieldError id="contact-message-phone-error" message={fieldErrors.phoneNumber} />
        </div>

        {/* Email Address */}
        <div className="group/input relative z-30">
          <label
            htmlFor="contact-email"
            className="mb-2.5 block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink"
          >
            Email Address <span className="text-accent-ink">*</span>
          </label>
          <div className="relative flex items-center">
            <Mail
              aria-hidden="true"
              className="pointer-events-none absolute left-4 z-10 h-4 w-4 text-accent-ink transition-transform duration-300 group-focus-within/input:scale-110"
            />
            <input
              required
              disabled={!enabled}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? 'contact-message-email-error' : undefined}
              maxLength={255}
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) => setField('email', event.target.value)}
              onBlur={() => validateField('email')}
              className={commonInputClasses(Boolean(fieldErrors.email))}
            />
          </div>
          <FieldError id="contact-message-email-error" message={fieldErrors.email} />
        </div>

        {/* Subject (Clean Interactive Pill Selector — No Redundant Dropdown) */}
        <div className="relative z-20">
          <span
            id="contact-subject-label"
            className="mb-3 inline-flex items-center gap-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink"
          >
            <Tag aria-hidden="true" className="h-3.5 w-3.5 text-accent-ink" />
            <span>
              Subject <span className="text-accent-ink">*</span>
            </span>
          </span>
          <div
            role="radiogroup"
            aria-labelledby="contact-subject-label"
            aria-invalid={fieldErrors.subject ? true : undefined}
            aria-describedby={fieldErrors.subject ? 'contact-message-subject-error' : undefined}
            className={`flex flex-wrap gap-2.5 rounded-2xl border p-3.5 transition-colors duration-300 ${
              fieldErrors.subject
                ? 'border-zion-accent/70 bg-[var(--palette-gold-soft)]/70'
                : 'border-zion-accent/20 bg-surface/55'
            }`}
          >
            {SUBJECT_OPTIONS.map((option) => {
              const isSelected = form.subject === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  data-subject-option="true"
                  disabled={!enabled}
                  onClick={() => setField('subject', option)}
                  className={`rounded-full border px-4 py-2 font-sans text-xs font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSelected
                      ? 'border-[var(--palette-client-button)] bg-[var(--palette-client-button)] text-ink shadow-sm'
                      : 'border-zion-accent/25 bg-surface/85 text-muted hover:-translate-y-0.5 hover:border-[var(--palette-client-button)] hover:bg-surface hover:text-ink'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <FieldError id="contact-message-subject-error" message={fieldErrors.subject} />
        </div>

        {/* Message */}
        <div className="group/input relative z-10">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <label
              htmlFor="contact-message"
              className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink"
            >
              Message <span className="text-accent-ink">*</span>
            </label>
            <span className="font-sans text-xs font-medium text-muted">
              {form.message.length.toLocaleString()} / 3,000
            </span>
          </div>
          <div className="relative">
            <MessageSquare
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-4 z-10 h-4 w-4 text-accent-ink transition-transform duration-300 group-focus-within/input:scale-110"
            />
            <textarea
              id="contact-message"
              name="message"
              required
              disabled={!enabled}
              aria-invalid={fieldErrors.message ? true : undefined}
              aria-describedby={fieldErrors.message ? 'contact-message-body-error' : undefined}
              minLength={10}
              maxLength={3000}
              placeholder={
                prefersReducedMotion
                  ? 'Write your message here...'
                  : placeholderText || 'Write your message here...'
              }
              value={form.message}
              onChange={(event) => setField('message', event.target.value)}
              onBlur={() => validateField('message')}
              rows={5}
              className={`${commonInputClasses(Boolean(fieldErrors.message))} min-h-[8.5rem] resize-y`}
            />
          </div>
          <FieldError id="contact-message-body-error" message={fieldErrors.message} />
        </div>

        {/* Submit Row */}
        <div className="flex flex-col items-start justify-between gap-4 pt-2 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={isSubmitting || !enabled}
            className="group/submit relative z-0 inline-flex min-h-12 w-full items-center justify-center overflow-hidden rounded-full border-2 border-[var(--palette-client-button)] bg-[var(--palette-client-button)] px-10 py-3.5 font-sans text-sm font-bold uppercase tracking-[0.18em] text-ink shadow-sm transition-all duration-500 hover:shadow-[0_16px_34px_-14px_color-mix(in_srgb,var(--palette-client-button)_65%,transparent)] focus:outline-none focus:ring-4 focus:ring-[var(--palette-client-button)]/30 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 translate-y-full bg-[var(--palette-client-button-hover)] transition-transform duration-500 ease-in-out group-hover/submit:translate-y-0 motion-reduce:hidden"
            />
            <span className="relative z-10 flex items-center justify-center gap-2.5">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send
                  className="h-4 w-4 transition-transform duration-300 group-hover/submit:-translate-y-0.5 group-hover/submit:translate-x-0.5 motion-reduce:transform-none"
                  aria-hidden="true"
                />
              )}
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </span>
          </button>

          <p className="font-serif text-xs leading-relaxed text-muted">
            We typically respond within 24 hours.
          </p>
        </div>
      </form>
    </>
  );
}
