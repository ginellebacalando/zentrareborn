/** Keep modal keyboard navigation inside the dialog, including reverse Tab. */
export function containDialogFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !(event.currentTarget instanceof HTMLDialogElement)) return;
  const dialog = event.currentTarget;
  const controls = Array.from(
    dialog.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]'),
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(':disabled') &&
      !element.closest('[inert]') &&
      element.getClientRects().length > 0,
  );
  const first = controls[0];
  const last = controls.at(-1);
  if (!first || !last) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  if (
    event.shiftKey &&
    (document.activeElement === first || !dialog.contains(document.activeElement))
  ) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || !dialog.contains(document.activeElement))
  ) {
    event.preventDefault();
    first.focus();
  }
}
