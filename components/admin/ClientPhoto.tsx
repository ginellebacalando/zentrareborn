'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Camera, ImageUp, X } from 'lucide-react';
import { Button, IconButton } from '@/components/shared/Button';
import { photoAsJpeg, UNREADABLE_PHOTO } from '@/components/client-photo/browser-photo';
import {
  CLIENT_PHOTO_LIMITS,
  CLIENT_PHOTO_REVIEW_LABELS,
  type StaffClientPhoto,
} from '@/config/client-photos';
import overlay from './Overlays.module.css';
import styles from './ClientPhoto.module.css';

/**
 * A client's optional arrival photo in the admin (docs/client-photos.md), so staff recognize
 * clients when they arrive. Small photos sit in lists (40 to 64 px); clicking one opens a larger
 * view. Without a photo the initials show, with "No photo yet" and "Request photo". Staff can
 * mark a photo OK, ask for a new one, remove it, or take one at the venue after asking the
 * client. Photos load only through short-lived signed addresses from the server.
 */
export type PhotoSubjectRef = { kind: 'booking' | 'visit'; id: string };

type Common = {
  name: string;
  /** Undefined when this role may not see photos: nothing is shown. */
  photo: StaffClientPhoto | null | undefined;
  subject: PhotoSubjectRef;
  /** Reloads the page's data after a change. */
  onChanged?: () => unknown;
};

export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return (
    letters
      .map((word) => word[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function endpoint(subject: PhotoSubjectRef) {
  return `/api/admin/${subject.kind === 'booking' ? 'bookings' : 'front-desk'}`;
}

/** The photo actions and their progress, shared by the avatar's dialog and the status line. */
function usePhotoActions(subject: PhotoSubjectRef, onChanged?: () => unknown) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function run(request: () => Promise<Response>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await request();
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? 'The photo could not be updated. Try again.');
        return false;
      }
      setNotice(success);
      await onChanged?.();
      return true;
    } catch {
      setError('The photo could not be updated. Check the connection.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const send = (body: Record<string, unknown>, success: string) =>
    run(
      () =>
        fetch(endpoint(subject), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, subject }),
        }),
      success,
    );

  return {
    busy,
    error,
    notice,
    review: (decision: 'OK' | 'RETAKE', name: string) =>
      send(
        { op: 'client-photo-review', decision },
        decision === 'OK'
          ? `${name}'s photo is marked OK.`
          : `${name} was emailed a link to send a new photo.`,
      ),
    request: (name: string) =>
      send({ op: 'client-photo-request' }, `${name} was emailed a link to add a photo.`),
    remove: (name: string) =>
      send({ op: 'client-photo-remove' }, `${name}'s photo was removed and deleted.`),
    upload: (photo: Blob, name: string) => {
      const form = new FormData();
      form.set('kind', subject.kind);
      form.set('id', subject.id);
      form.set('consent', 'yes');
      form.set('photo', photo, 'photo.jpg');
      return run(
        () => fetch('/api/admin/client-photos', { method: 'POST', body: form }),
        `${name}'s photo is saved.`,
      );
    },
  };
}

function Face({
  name,
  photo,
  size,
}: {
  name: string;
  photo: StaffClientPhoto | null;
  size: number;
}) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed address
    <img src={photo.url} alt="" className={styles.image} width={size} height={size} />
  ) : (
    <span className={styles.initials} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

/** The larger view, with what staff can do with the photo. */
function PhotoDialog({
  name,
  photo,
  subject,
  onChanged,
  onClose,
}: Common & { photo: StaffClientPhoto | null; onClose: () => void }) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [localError, setLocalError] = useState('');
  const actions = usePhotoActions(subject, onChanged);

  useEffect(() => {
    const dialog = dialogRef.current;
    opener.current = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener.current instanceof HTMLElement && opener.current.isConnected)
        opener.current.focus();
    };
  }, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLocalError('');
    if (file.size > CLIENT_PHOTO_LIMITS.maxUploadBytes)
      return setLocalError('That photo is too large. Choose one under 10 MB.');
    try {
      const blob = await photoAsJpeg(file);
      setPreview({ blob, url: URL.createObjectURL(blob) });
      setConsent(false);
    } catch {
      setLocalError(UNREADABLE_PHOTO);
    }
  }

  async function save() {
    if (!preview) return;
    if (!consent) return setLocalError('Ask the client first, then tick the consent box.');
    if (await actions.upload(preview.blob, name)) {
      setPreview(null);
      setCapturing(false);
    }
  }

  const error = localError || actions.error;
  return (
    <dialog
      ref={dialogRef}
      className={`${overlay.dialog} ${styles.dialog}`}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={overlay.dialogBody}>
        <div className={overlay.dialogHeading}>
          <h2 id={`${id}-title`}>{name}</h2>
          <IconButton
            type="button"
            size="sm"
            label="Close"
            icon={<X aria-hidden="true" />}
            onClick={onClose}
          />
        </div>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview (blob: URL)
          <img src={preview.url} alt={`${name}, not saved yet`} className={styles.large} />
        ) : photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed address
          <img src={photo.url} alt={name} className={styles.large} />
        ) : (
          <div className={styles.largeInitials} aria-hidden="true">
            {initialsOf(name)}
          </div>
        )}
        <p className={overlay.dialogSummary}>
          {photo
            ? `${CLIENT_PHOTO_REVIEW_LABELS[photo.review]} · ${photo.source === 'STAFF' ? 'Taken at the venue' : 'Added by the client'}. If you are unsure at the venue, ask for the booking reference.`
            : 'No photo yet. The photo is optional; the client can add one through a link we email.'}
        </p>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className={styles.input}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => void choose(event)}
        />
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          className={styles.input}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => void choose(event)}
        />

        {capturing ? (
          <div className={styles.capture}>
            <div className={styles.actions}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Camera aria-hidden="true" />}
                onClick={() => cameraRef.current?.click()}
              >
                Take a photo
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<ImageUp aria-hidden="true" />}
                onClick={() => uploadRef.current?.click()}
              >
                Upload a photo
              </Button>
            </div>
            <label className={styles.consent}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked);
                  if (event.target.checked) setLocalError('');
                }}
              />
              <span>
                I asked {name}, and they agreed that Zion staff may use this photo to recognize them
                when they arrive.
              </span>
            </label>
            <div className={overlay.dialogActions}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setCapturing(false);
                  setPreview(null);
                  setLocalError('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={actions.busy}
                disabledReason={preview ? null : 'Take or upload a photo first'}
                onClick={() => void save()}
              >
                Save photo
              </Button>
            </div>
          </div>
        ) : confirmRemove ? (
          <div className={styles.capture}>
            <p className={overlay.dialogSummary}>
              Remove {name}&apos;s photo? It is deleted right away.
            </p>
            <div className={overlay.dialogActions}>
              <Button type="button" variant="secondary" onClick={() => setConfirmRemove(false)}>
                Keep photo
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={actions.busy}
                onClick={async () => {
                  if (await actions.remove(name)) setConfirmRemove(false);
                }}
              >
                Remove photo
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            {photo ? (
              <>
                {photo.review !== 'OK' && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={actions.busy}
                    onClick={() => void actions.review('OK', name)}
                  >
                    Photo OK
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={actions.busy}
                  onClick={() => void actions.review('RETAKE', name)}
                >
                  Ask for a new one
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCapturing(true)}>
                  Take a new photo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmRemove(true)}
                >
                  Remove photo
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={actions.busy}
                  onClick={() => void actions.request(name)}
                >
                  Request photo
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCapturing(true)}
                >
                  Take or upload a photo
                </Button>
              </>
            )}
          </div>
        )}
        {error && (
          <p className={overlay.dialogError} role="alert">
            {error}
          </p>
        )}
        <p className={styles.notice} role="status">
          {actions.notice}
        </p>
      </div>
    </dialog>
  );
}

/** The client's photo (or initials) as a button that opens the larger view. */
export default function ClientPhotoAvatar({
  name,
  photo,
  subject,
  onChanged,
  size = 48,
}: Common & { size?: 48 | 64 }) {
  const [open, setOpen] = useState(false);
  if (photo === undefined) return null;
  return (
    <>
      <button
        type="button"
        className={styles.avatar}
        style={{ '--photo-size': `${size}px` } as CSSProperties}
        aria-label={photo ? `Open ${name}'s photo` : `${name} has no photo yet. Open photo options`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Face name={name} photo={photo} size={size} />
      </button>
      {open && (
        <PhotoDialog
          name={name}
          photo={photo}
          subject={subject}
          onChanged={onChanged}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * The photo (or initials) without a button, for rows that are links themselves, such as the
 * dashboard's "Coming up at Zion". The booking page opens the larger view.
 */
export function ClientPhotoFace({
  name,
  photo,
  size = 48,
}: {
  name: string;
  photo: StaffClientPhoto | null | undefined;
  size?: 48 | 64;
}) {
  if (photo === undefined) return null;
  return (
    <span
      className={styles.avatar}
      style={{ '--photo-size': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <Face name={name} photo={photo} size={size} />
    </span>
  );
}

/**
 * The photo's state in words with the next step: "No photo yet" with "Request photo", or the
 * review ("Not checked yet", "Photo OK", "New photo asked for") with "Photo OK" and "Ask for a
 * new one" when it still needs a look. Sits next to the contact verification.
 */
export function ClientPhotoStatus({ name, photo, subject, onChanged }: Common) {
  const actions = usePhotoActions(subject, onChanged);
  if (photo === undefined) return null;
  return (
    <span className={styles.status}>
      <span className={photo ? styles[`review${photo.review}`] : styles.missing}>
        {photo ? CLIENT_PHOTO_REVIEW_LABELS[photo.review] : 'No photo yet'}
      </span>
      {!photo && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={actions.busy}
          onClick={() => void actions.request(name)}
        >
          Request photo
        </Button>
      )}
      {photo && photo.review === 'UNREVIEWED' && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={actions.busy}
            onClick={() => void actions.review('OK', name)}
          >
            Photo OK
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={actions.busy}
            onClick={() => void actions.review('RETAKE', name)}
          >
            Ask for a new one
          </Button>
        </>
      )}
      {actions.error && (
        <span className={styles.error} role="alert">
          {actions.error}
        </span>
      )}
      <span className={styles.srOnly} role="status">
        {actions.notice}
      </span>
    </span>
  );
}
