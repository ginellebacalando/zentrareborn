'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
const ESTIMATED_CALENDAR_HEIGHT = 360;
const CALENDAR_WIDTH = 312;
const VIEWPORT_MARGIN = 12;

export type ZionDateStatus = 'available' | 'inquired' | 'booked' | 'unavailable';

interface ZionDatePickerProps {
  id?: string;
  value: string;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
  disabled?: boolean;
  getDateStatus?: (iso: string) => ZionDateStatus;
  onChange: (value: string) => void;
}

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatReadableDate(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default function ZionDatePicker({
  id,
  value,
  minDate,
  maxDate,
  placeholder = 'Select event date',
  disabled = false,
  getDateStatus,
  onChange,
}: ZionDatePickerProps) {
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(
    () => toIsoDate(today.getFullYear(), today.getMonth(), today.getDate()),
    [today],
  );
  const initialDate = parseIsoDate(value) ?? today;

  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(CALENDAR_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    if (spaceBelow >= ESTIMATED_CALENDAR_HEIGHT + 12 || spaceBelow >= spaceAbove) {
      top = Math.min(
        rect.bottom + 8,
        window.innerHeight - ESTIMATED_CALENDAR_HEIGHT - VIEWPORT_MARGIN,
      );
    } else {
      top = rect.top - ESTIMATED_CALENDAR_HEIGHT - 8;
    }
    top = Math.max(VIEWPORT_MARGIN, top);

    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN),
    );

    setPosition({ top, left, width });
  }, []);

  const toggleOpen = () => {
    if (disabled) return;
    if (!open) {
      const target = parseIsoDate(value) ?? today;
      setViewYear(target.getFullYear());
      setViewMonth(target.getMonth());
      updatePosition();
    }
    setOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, updatePosition]);

  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<number | null> = [];
    for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);
    return cells;
  }, [viewMonth, viewYear]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const formattedLabel = formatReadableDate(value);

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggleOpen}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl border ${
          open
            ? 'border-zion-accent bg-surface ring-4 ring-zion-accent/15'
            : 'border-zion-accent/25 bg-surface/85 hover:border-zion-accent/45 hover:bg-surface'
        } py-3.5 pl-4 pr-4 text-left shadow-sm transition-all duration-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Calendar aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-ink" />
          <span
            className={`block min-w-0 truncate font-sans text-sm ${
              formattedLabel ? 'font-medium text-ink' : 'text-muted/75'
            }`}
          >
            {formattedLabel || placeholder}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-accent-ink transition-transform duration-300 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        position &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Choose event date"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            className="z-[220] rounded-2xl border border-zion-accent/25 bg-surface/95 p-4 shadow-[0_18px_48px_color-mix(in_srgb,var(--palette-night)_18%,transparent)] backdrop-blur-xl"
          >
            {/* Month / Year Header */}
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-zion-accent/15 pb-3">
              <button
                type="button"
                onClick={goPrevMonth}
                aria-label="Previous month"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-zion-accent/20 bg-surface text-ink transition-colors hover:border-[var(--palette-client-button)] hover:bg-[var(--palette-gold-soft)]"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>

              <span className="font-serif text-base font-semibold text-ink">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>

              <button
                type="button"
                onClick={goNextMonth}
                aria-label="Next month"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-zion-accent/20 bg-surface text-ink transition-colors hover:border-[var(--palette-client-button)] hover:bg-[var(--palette-gold-soft)]"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="mb-1.5 grid grid-cols-7 text-center">
              {WEEKDAYS.map((day) => (
                <span
                  key={day}
                  className="py-1 font-sans text-xs font-bold uppercase tracking-wider text-accent-ink/80"
                >
                  {day}
                </span>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((day, idx) => {
                if (day === null) {
                  return <span key={`empty-${idx}`} aria-hidden="true" />;
                }

                const iso = toIsoDate(viewYear, viewMonth, day);
                const isSelected = iso === value;
                const isToday = iso === todayIso;
                const isOutOfBounds = Boolean(
                  (minDate && iso < minDate) || (maxDate && iso > maxDate),
                );
                const dateStatus = !isOutOfBounds && getDateStatus ? getDateStatus(iso) : undefined;
                const isBlocked = dateStatus === 'booked' || dateStatus === 'unavailable';
                const isDisabled = isOutOfBounds || isBlocked;

                const statusDotClass =
                  dateStatus === 'booked'
                    ? 'bg-[var(--palette-danger)]'
                    : dateStatus === 'unavailable'
                      ? 'bg-muted/50'
                      : dateStatus === 'inquired'
                        ? 'bg-[var(--palette-booklet-cover)]'
                        : dateStatus === 'available'
                          ? 'bg-[var(--palette-success)]'
                          : '';

                const statusLabel =
                  dateStatus === 'booked'
                    ? 'Already booked'
                    : dateStatus === 'unavailable'
                      ? 'Not available'
                      : dateStatus === 'inquired'
                        ? 'Available — high demand'
                        : dateStatus === 'available'
                          ? 'Available'
                          : '';

                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    title={statusLabel || undefined}
                    aria-label={
                      statusLabel ? `${formatReadableDate(iso)} (${statusLabel})` : undefined
                    }
                    onClick={() => {
                      onChange(iso);
                      setOpen(false);
                    }}
                    className={`relative flex h-9 w-full flex-col items-center justify-center rounded-xl font-sans text-sm transition-all duration-200 ${
                      isSelected
                        ? 'bg-[var(--palette-client-button)] font-bold text-[var(--text-on-action)] shadow-sm'
                        : dateStatus === 'booked'
                          ? 'cursor-not-allowed bg-[var(--palette-danger-soft)] text-[var(--palette-danger)]/65 line-through'
                          : dateStatus === 'unavailable'
                            ? 'cursor-not-allowed bg-[var(--palette-cream)]/40 text-muted/45 line-through'
                            : isOutOfBounds
                              ? 'cursor-not-allowed text-muted/35'
                              : isToday
                                ? 'cursor-pointer border border-zion-accent/50 font-semibold text-accent-ink hover:bg-[var(--palette-gold-soft)]'
                                : 'cursor-pointer text-ink/85 hover:bg-[var(--palette-gold-soft)]/70 hover:text-ink'
                    }`}
                  >
                    <span className="leading-none">{day}</span>
                    {statusDotClass ? (
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 h-1.5 w-1.5 rounded-full ${statusDotClass}`}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Optional status legend */}
            {getDateStatus ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zion-accent/15 pt-2.5 font-sans text-xs text-ink/75">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--palette-success)]" />
                  Available
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--palette-booklet-cover)]" />
                  Inquired
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--palette-danger)]" />
                  Booked
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted/50" />
                  Unavailable
                </span>
              </div>
            ) : null}

            {/* Quick footer */}
            <div className="mt-3 flex items-center justify-between border-t border-zion-accent/15 pt-3">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="cursor-pointer rounded-full px-3 py-1 font-sans text-xs font-semibold text-muted transition-colors hover:bg-[var(--palette-gold-soft)]/60 hover:text-ink"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={Boolean(maxDate && todayIso > maxDate)}
                onClick={() => {
                  onChange(todayIso);
                  setOpen(false);
                }}
                className="cursor-pointer rounded-full bg-[var(--palette-gold-soft)] px-3.5 py-1 font-sans text-xs font-semibold text-accent-ink transition-colors hover:bg-[var(--palette-client-button)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
