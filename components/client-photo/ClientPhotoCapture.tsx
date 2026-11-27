'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { Camera, CheckCircle2, CircleAlert, ImageUp } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import {
  CLIENT_PHOTO_CONSENT,
  CLIENT_PHOTO_LIMITS,
  CLIENT_PHOTO_TIPS,
  clientPhotoWhy,
  type OwnClientPhoto,
} from '@/config/client-photos';
import { photoAsJpeg } from './browser-photo';
import styles from './ClientPhotoCapture.module.css';

type Stage = 'idle' | 'preview' | 'saved' | 'confirm-remove' | 'skipped' | 'removed';
type Source = 'camera' | 'upload';

const ENDPOINT = '/api/client/photos';
const UNREADABLE =
  'This photo could not be opened here. Take a selfie instead, or choose a JPG or PNG photo.';

function subscribeToPointer(onChange: () => void) {
  const query = window.matchMedia('(pointer: coarse)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/**
 * "Add your photo (optional)" (docs/client-photos.md): a selfie with the front camera on phones,
 * or an uploaded photo; a preview with tips, Retake and Use this photo; and a separate, unticked
 * consent box without which nothing is saved. Skipping is always possible. A saved photo can be
 * changed or removed; removal deletes it at once.
 */
export default function ClientPhotoCapture({
  photo,
  heading = 'Add your photo (optional)',
  skippable = false,
  skippedNote = 'No problem. You can add a photo later through the link in your email.',
}: {
  photo: OwnClientPhoto;
  heading?: string;
  /** The booking and visit flows offer "Skip for now"; private pages simply leave it optional. */
  skippable?: boolean;
  skippedNote?: string;
}) {
  const id = useId();
  const [current, setCurrent] = useState(photo.photoUrl);
  const [stage, setStage] = useState<Stage>(photo.photoUrl ? 'saved' : 'idle');
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [source, setSource] = useState<Source>('upload');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [retake, setRetake] = useState(photo.retakeRequested);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const phone = useSyncExternalStore(
    subscribeToPointer,
    () => window.matchMedia('(pointer: coarse)').matches,
    () => false,
  );

  // A replaced or cleared preview releases its in-memory image.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  function open(next: Source) {
    setError('');
    setSource(next);
    (next === 'camera' ? cameraRef : uploadRef).current?.click();
  }

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // The same file can be chosen again after Retake.
    event.target.value = '';
    if (!file) return;
    setError('');
    if (file.size > CLIENT_PHOTO_LIMITS.maxUploadBytes)
      return setError('That photo is too large. Choose one under 10 MB.');
    try {
      const blob = await photoAsJpeg(file);
      setPreview({ blob, url: URL.createObjectURL(blob) });
      setConsent(false);
      setStage('preview');
    } catch {
      setError(UNREADABLE);
    }
  }

  async function save() {
    if (!preview) return;
    if (!consent) {
      setError('Tick the box to agree before you save your photo.');
      consentRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.set('token', photo.token);
      form.set('consent', 'yes');
      form.set('website', '');
      form.set('photo', preview.blob, 'photo.jpg');
      const response = await fetch(ENDPOINT, { method: 'POST', body: form });
      const body = (await response.json().catch(() => ({}))) as {
        photoUrl?: string | null;
        error?: string;
      };
      if (!response.ok) return setError(body.error ?? 'Your photo could not be saved. Try again.');
      setCurrent(body.photoUrl ?? preview.url);
      setPreview(null);
      setRetake(false);
      setStage('saved');
      setStatus('Your photo is saved.');
      headingRef.current?.focus();
    } catch {
      setError('We could not reach Zion Events Place. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(ENDPOINT, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: photo.token }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok)
        return setError(body.error ?? 'Your photo could not be removed. Try again.');
      setCurrent(null);
      setStage('removed');
      setStatus('Your photo was removed and deleted.');
      headingRef.current?.focus();
    } catch {
      setError('We could not reach Zion Events Place. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const chooseButtons = (
    <>
      {phone && (
        <Button
          type="button"
          variant="primary"
          icon={<Camera aria-hidden="true" />}
          onClick={() => open('camera')}
        >
          Take a selfie
        </Button>
      )}
      <Button
        type="button"
        variant={phone ? 'secondary' : 'primary'}
        icon={<ImageUp aria-hidden="true" />}
        onClick={() => open('upload')}
      >
        Upload a photo
      </Button>
    </>
  );
  const skipButton = skippable && (
    <Button
      type="button"
      variant="ghost"
      onClick={() => {
        setPreview(null);
        setError('');
        setStage('skipped');
        headingRef.current?.focus();
      }}
    >
      Skip for now
    </Button>
  );

  return (
    <section className={styles.photo} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} className={styles.title}>
        {stage === 'saved' || stage === 'confirm-remove' ? 'Your photo' : heading}
      </h2>
      <p className={styles.why}>{clientPhotoWhy(photo.retentionDays)}</p>
      {retake && current && (
        <p className={styles.notice}>
          Our team asked for a new photo, because your face was not clear in this one. You can add a
          new one below.
        </p>
      )}

      {/* The selfie input opens the front camera on phones; both stay hidden behind buttons. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
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

      {stage === 'idle' &&
        (photo.canAdd ? (
          <>
            <ul className={styles.tips} aria-label="Tips for a good photo">
              {CLIENT_PHOTO_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            <div className={styles.actions}>
              {chooseButtons}
              {current ? (
                <Button type="button" variant="ghost" onClick={() => setStage('saved')}>
                  Keep current photo
                </Button>
              ) : (
                skipButton
              )}
            </div>
          </>
        ) : (
          <p className={styles.muted}>This booking or visit has ended, so no photo is needed.</p>
        ))}

      {stage === 'preview' && preview && (
        <div className={styles.review}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (blob: URL) */}
          <img
            src={preview.url}
            alt="You, as our team will see you (not saved yet)"
            className={styles.preview}
          />
          <div className={styles.reviewText}>
            <ul className={styles.tips} aria-label="Check your photo">
              {CLIENT_PHOTO_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            <label className={styles.consent}>
              <input
                ref={consentRef}
                type="checkbox"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked);
                  if (event.target.checked) setError('');
                }}
                aria-describedby={error ? `${id}-error` : undefined}
              />
              <span>{CLIENT_PHOTO_CONSENT.text}</span>
            </label>
            <div className={styles.actions}>
              <Button type="button" variant="primary" loading={busy} onClick={() => void save()}>
                Use this photo
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => open(source)}
              >
                Retake
              </Button>
              {skipButton}
            </div>
          </div>
        </div>
      )}

      {(stage === 'saved' || stage === 'confirm-remove') && current && (
        <div className={styles.review}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed address */}
          <img src={current} alt="You, as our team will see you" className={styles.saved} />
          <div className={styles.reviewText}>
            <p className={styles.success}>
              <CheckCircle2 aria-hidden="true" className={styles.icon} />
              Our team will see this photo when you arrive.
            </p>
            {stage === 'confirm-remove' ? (
              <div className={styles.confirm}>
                <p>Remove your photo? It is deleted right away.</p>
                <div className={styles.actions}>
                  <Button
                    type="button"
                    variant="destructive"
                    loading={busy}
                    onClick={() => void remove()}
                  >
                    Remove photo
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setStage('saved')}>
                    Keep photo
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                {photo.canAdd && (
                  <Button type="button" variant="secondary" onClick={() => setStage('idle')}>
                    Change photo
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => setStage('confirm-remove')}>
                  Remove photo
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {stage === 'skipped' && <p className={styles.muted}>{skippedNote}</p>}
      {stage === 'removed' && (
        <>
          <p className={styles.muted}>
            Your photo was removed and deleted. You can add a new one anytime.
          </p>
          {photo.canAdd && <div className={styles.actions}>{chooseButtons}</div>}
        </>
      )}

      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          <CircleAlert aria-hidden="true" className={styles.icon} />
          {error}
        </p>
      )}
      <p className={styles.visuallyHidden} role="status">
        {status}
      </p>
    </section>
  );
}
