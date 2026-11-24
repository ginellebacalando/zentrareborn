/** Plain page surface behind every public screen; Figma keeps the site on white. */
export default function GlobalBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-50 h-full w-full bg-[var(--surface-page)]"
    />
  );
}
