'use client';
import { useEffect, useId, useRef, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button, IconButton } from '@/components/shared/Button';
import overlay from './Overlays.module.css';

/**
 * Asks for the decision note an action needs (the server requires 5 to 2,000 characters), in a
 * native modal dialog instead of a box that is always on screen. Escape or Cancel closes it, and
 * focus returns to the control that opened it.
 */
export default function ActionDialog({
  title,
  summary,
  confirmLabel,
  destructive = false,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  /** One sentence on what happens next. */
  summary: string;
  confirmLabel: string;
  destructive?: boolean;
  busy: boolean;
  /** Why the server refused the action, shown in the dialog. */
  error?: string;
  onConfirm: (note: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    opener.current = document.activeElement;
    dialog?.showModal();
    // Start in the note field, the one thing the dialog asks for.
    dialog?.querySelector('textarea')?.focus();
    return () => {
      dialog?.close();
      if (opener.current instanceof HTMLElement && opener.current.isConnected)
        opener.current.focus();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get('note') ?? '').trim();
    await onConfirm(note);
  }

  return (
    <dialog
      ref={dialogRef}
      className={overlay.dialog}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-summary`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form className={overlay.dialogBody} onSubmit={submit}>
        <div className={overlay.dialogHeading}>
          <h2 id={`${id}-title`}>{title}</h2>
          <IconButton
            type="button"
            size="sm"
            label="Close"
            icon={<X aria-hidden="true" />}
            onClick={onClose}
          />
        </div>
        <p id={`${id}-summary`} className={overlay.dialogSummary}>
          {summary}
        </p>
        <label className={overlay.dialogField}>
          Decision note
          <textarea
            name="note"
            required
            minLength={5}
            maxLength={2000}
            rows={3}
            placeholder="For example: checked the details with the client by phone"
          />
          <small>Saved in the booking history. At least 5 characters.</small>
        </label>
        {error && (
          <p className={overlay.dialogError} role="alert">
            {error}
          </p>
        )}
        <div className={overlay.dialogActions}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={destructive ? 'destructive' : 'primary'}
            loading={busy}
            loadingLabel="Saving…"
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
