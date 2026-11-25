'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const MAX_LISTBOX_HEIGHT = 256;
const VIEWPORT_MARGIN = 12;

export interface ZionSelectOption {
  value: string;
  label: string;
}

interface ZionSelectPopoverProps {
  id?: string;
  value: string;
  options: readonly ZionSelectOption[];
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  leadingIcon?: React.ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  onChange: (value: string) => void;
}

export default function ZionSelectPopover({
  id,
  value,
  options,
  placeholder = 'Select an option',
  ariaLabel,
  disabled = false,
  leadingIcon,
  triggerClassName = '',
  panelClassName = '',
  onChange,
}: ZionSelectPopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const updatePosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 224), window.innerWidth - VIEWPORT_MARGIN * 2);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    if (spaceBelow >= MAX_LISTBOX_HEIGHT + 12 || spaceBelow >= spaceAbove) {
      top = Math.min(rect.bottom + 8, window.innerHeight - MAX_LISTBOX_HEIGHT - VIEWPORT_MARGIN);
    } else {
      top = rect.top - MAX_LISTBOX_HEIGHT - 8;
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

  const selected = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={toggleOpen}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 text-left transition-all duration-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${triggerClassName}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          {leadingIcon && <span className="shrink-0">{leadingIcon}</span>}
          <span
            className={`block min-w-0 truncate font-sans text-sm ${
              selected ? 'font-medium text-ink' : 'text-muted/80'
            }`}
          >
            {selected?.label || placeholder}
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
            id={listboxId}
            role="listbox"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              minWidth: position.width,
            }}
            className={`events-scrollbar z-[220] max-h-64 overflow-y-auto rounded-2xl border border-zion-accent/25 bg-surface py-1.5 shadow-[0_18px_48px_color-mix(in_srgb,var(--palette-night)_18%,transparent)] ${panelClassName}`}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center px-4 py-2.5 text-left font-sans text-sm transition-colors duration-200 ${
                    isSelected
                      ? 'bg-[var(--palette-gold-soft)] font-semibold text-accent-ink'
                      : 'text-ink/85 hover:bg-[var(--palette-gold-soft)]/50 hover:text-ink'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
