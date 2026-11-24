'use client';

/** Resolve the current route's main landmark, including independently owned panels. */
export default function SkipLink() {
  return (
    <a
      className="skip-link"
      href="#main-content"
      onClick={(event) => {
        const main = document.querySelector<HTMLElement>('main');
        if (!main) return;
        event.preventDefault();
        if (!main.id) main.id = 'main-content';
        if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
        main.focus({ preventScroll: true });
        main.scrollIntoView({ block: 'start', behavior: 'instant' });
      }}
    >
      Skip to main content
    </a>
  );
}
