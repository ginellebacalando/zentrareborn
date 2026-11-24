'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { containDialogFocus } from '@/lib/dialog-focus';

const menuItems = [
  { label: 'Home', href: '/' },
  {
    label: 'Packages',
    href: '/events/weddings',
    subItems: [
      { label: 'Weddings', href: '/events/weddings' },
      { label: 'Debuts', href: '/events/debuts' },
      { label: 'Christening', href: '/events/christening' },
      { label: 'Birthdays', href: '/events/birthdays' },
      { label: 'Gender Reveal', href: '/events/gender-reveal' },
      { label: 'Christmas Party', href: '/events/christmas-party' },
    ],
  },
  { label: 'Gallery', href: '/gallery' },
  { label: 'About Us', href: '/about' },
  { label: 'Facilities', href: '/facilities' },
  { label: 'Testimonies', href: '/testimonies' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'FAQ', href: '/faq' },
] as const;

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.dataset.publicMenuOpen = 'true';
    const dialog = dialogRef.current;
    const menuButton = menuButtonRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.addEventListener('keydown', containDialogFocus);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      delete document.documentElement.dataset.publicMenuOpen;
      dialog?.removeEventListener('keydown', containDialogFocus);
      dialog?.close();
      menuButton?.focus({ preventScroll: true });
    };
  }, [isMenuOpen]);

  const closeMenu = () => {
    setIsMenuOpen(false);
    setExpandedItem(null);
  };

  return (
    <nav
      aria-label="Primary navigation"
      className="pointer-events-auto relative z-50 flex items-center"
    >
      <button
        aria-controls="primary-navigation-panel"
        aria-expanded={isMenuOpen}
        aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        ref={menuButtonRef}
        className={`touch-target relative z-[70] flex items-center justify-center rounded-full text-center transition-all duration-300 ${
          isMenuOpen
            ? 'scale-105 bg-black/10 text-[var(--palette-gold)] drop-shadow-[0_0_10px_color-mix(in_srgb,var(--palette-gold)_60%,transparent)] backdrop-blur-sm'
            : 'text-white drop-shadow-md hover:scale-105 hover:bg-black/10 hover:text-[var(--palette-gold)] hover:drop-shadow-[0_0_10px_color-mix(in_srgb,var(--palette-gold)_40%,transparent)]'
        }`}
        onClick={() => setIsMenuOpen((open) => !open)}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-7 w-7 sm:h-8 sm:w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isMenuOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.25}
              d="M6 18 18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Primary navigation menu"
        className="navigation-dialog"
        id="primary-navigation-panel"
        onCancel={(event) => {
          event.preventDefault();
          closeMenu();
        }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) closeMenu();
        }}
      >
        <button
          type="button"
          onClick={closeMenu}
          className="group touch-target absolute left-0 top-6 inline-flex h-12 w-12 items-center justify-center rounded-r-2xl bg-[var(--palette-client-button)] text-ink transition-all duration-300 hover:bg-[var(--palette-client-button-hover)] active:scale-95"
          aria-label="Close navigation menu"
          title="Close navigation menu"
        >
          <ArrowRight
            aria-hidden="true"
            className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
            strokeWidth={2.2}
          />
        </button>
        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden pr-1 sm:gap-4">
          {menuItems.map((item, index) => {
            const hasSubItems = 'subItems' in item;
            const isExpanded = expandedItem === item.label;
            const isActive = hasSubItems
              ? item.subItems.some((subItem) => pathname === subItem.href)
              : pathname === item.href;

            return (
              <div className="flex flex-col items-end" key={item.label}>
                <div className="flex w-full items-center justify-end gap-1">
                  {hasSubItems ? (
                    <button
                      aria-expanded={isExpanded}
                      aria-controls="package-navigation-items"
                      className={`inline-flex min-h-11 items-center gap-2 bg-transparent py-1.5 text-right font-sans text-[0.95rem] font-medium uppercase tracking-[0.13em] transition-all duration-300 hover:-translate-x-1 hover:text-[var(--palette-client-button)] sm:py-2 sm:text-lg sm:tracking-[0.2em] ${
                        isActive || isExpanded
                          ? 'font-semibold text-[var(--palette-client-button)]'
                          : 'text-ink'
                      }`}
                      onClick={() => setExpandedItem(isExpanded ? null : item.label)}
                      style={{ transitionDelay: `${isMenuOpen ? index * 35 : 0}ms` }}
                      tabIndex={isMenuOpen ? 0 : -1}
                      type="button"
                    >
                      <span>{item.label}</span>
                      <svg
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="m6 9 6 6 6-6"
                        />
                      </svg>
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`inline-flex min-h-11 items-center bg-transparent py-1.5 text-right font-sans text-[0.95rem] font-medium uppercase tracking-[0.13em] transition-all duration-300 hover:-translate-x-1 hover:text-[var(--palette-client-button)] sm:py-2 sm:text-lg sm:tracking-[0.2em] ${
                        isActive ? 'font-semibold text-[var(--palette-client-button)]' : 'text-ink'
                      }`}
                      onClick={closeMenu}
                      style={{ transitionDelay: `${isMenuOpen ? index * 35 : 0}ms` }}
                      tabIndex={isMenuOpen ? 0 : -1}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>

                {hasSubItems ? (
                  <div
                    id="package-navigation-items"
                    inert={!isExpanded}
                    className={`events-scrollbar flex flex-col items-end gap-1 overflow-y-auto border-r-2 border-[var(--palette-client-button)]/65 pr-4 transition-[max-height,opacity,margin] duration-300 ${
                      isExpanded ? 'mt-1 max-h-64 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    {item.subItems.map((subItem) => {
                      const isSubActive = pathname === subItem.href;
                      return (
                        <Link
                          className={`inline-flex min-h-11 items-center bg-transparent py-2 text-right font-sans text-sm uppercase tracking-[0.12em] transition-all duration-300 hover:-translate-x-1 hover:text-[var(--palette-client-button)] sm:text-base sm:tracking-[0.15em] ${
                            isSubActive
                              ? 'font-semibold text-[var(--palette-client-button)]'
                              : 'text-muted'
                          }`}
                          href={subItem.href}
                          aria-current={isSubActive ? 'page' : undefined}
                          key={subItem.href}
                          onClick={closeMenu}
                          tabIndex={isMenuOpen && isExpanded ? 0 : -1}
                        >
                          {subItem.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="shrink-0 pt-6 sm:pt-8">
          <Link
            href="/booking"
            data-cta-button="true"
            aria-current={pathname === '/booking' ? 'page' : undefined}
            className="group relative inline-flex min-h-12 w-full items-center justify-center gap-4 overflow-hidden border border-[var(--palette-client-button)] bg-transparent px-6 py-3 font-sans text-[0.95rem] font-medium uppercase tracking-[0.2em] text-ink no-underline transition-[background-color,color,border-color] duration-300 hover:border-[var(--palette-client-button)] motion-reduce:transition-none sm:text-base"
            onClick={closeMenu}
            tabIndex={isMenuOpen ? 0 : -1}
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 translate-y-full bg-[var(--palette-client-button)] transition-transform duration-500 ease-in-out group-hover:translate-y-0 motion-reduce:hidden"
            />
            <span className="relative z-10">Book Now</span>
            <ArrowRight
              aria-hidden="true"
              className="relative z-10 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
              strokeWidth={2}
            />
          </Link>
        </div>
      </dialog>
    </nav>
  );
}
