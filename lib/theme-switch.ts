import { flushSync } from 'react-dom';

/** Set on <html> while a theme switch runs; app/globals.css pauses colour transitions under it. */
const SWITCHING_ATTRIBUTE = 'data-theme-switching';
let runningSwitches = 0;

function finishSwitch() {
  runningSwitches = Math.max(0, runningSwitches - 1);
  if (!runningSwitches) document.documentElement.removeAttribute(SWITCHING_ATTRIBUTE);
}

/**
 * Switches between the light and dark themes. `apply` makes the change (a React state update or
 * a class on <html>) and runs inside flushSync, so the page is updated before the browser takes
 * its picture of the new theme.
 *
 * Colour transitions are paused for the switch so every element changes together. Before this,
 * dozens of cards, links and buttons each faded at their own speed, which made the switch look
 * uneven and slow. Where the View Transitions API is available and motion is allowed, the new
 * theme sweeps in from top to bottom with a soft edge over --motion-theme (app/globals.css);
 * otherwise it changes at once.
 */
export function switchTheme(apply: () => void) {
  const root = document.documentElement;
  const update = () => flushSync(apply);
  const sweep =
    typeof document.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  runningSwitches += 1;
  root.setAttribute(SWITCHING_ATTRIBUTE, '');
  if (!sweep) {
    try {
      update();
      // Computes the new colours while transitions are paused, so none of them animate.
      void root.offsetHeight;
    } finally {
      requestAnimationFrame(finishSwitch);
    }
    return;
  }
  void document.startViewTransition(update).finished.finally(finishSwitch);
}
