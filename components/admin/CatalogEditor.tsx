'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import type { CatalogCategory, CatalogInclusion, CatalogPackage } from '@/lib/admin/catalog-types';
import { enumLabel } from './AdminBadge';
import styles from './admin.module.css';
import { containDialogFocus } from '@/lib/dialog-focus';
import { Button, IconButton } from '@/components/shared/Button';

export type CatalogEditing =
  | { type: 'category'; item: CatalogCategory | null }
  | { type: 'package'; item: CatalogPackage | null };
const priceFields = [
  ['price', 'Package price'],
  ['reservationFee', 'Reservation fee'],
  ['downPaymentAmount', 'Down payment amount'],
  ['fullPaymentAmount', 'Full payment amount'],
  ['excessPaxFee', 'Excess guest fee'],
] as const;
const textFields = [
  ['checkInTime', 'Check-in time', 80],
  ['checkOutTime', 'Check-out time', 80],
  ['contractItemDescription', 'Contract item description', 5000],
  ['contractInclusionDescription', 'Contract inclusions description', 10000],
  ['internalNotes', 'Internal notes', 5000],
] as const;
function makeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

export default function CatalogEditor({
  editing,
  category,
  busy,
  error,
  onSave,
  onClose,
}: {
  editing: CatalogEditing;
  category: CatalogCategory | null;
  busy: boolean;
  error: string;
  onSave: (payload: unknown) => Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const isCategory = editing.type === 'category';
  const entry = editing.item;
  const packageEntry = editing.type === 'package' ? editing.item : null;
  const categoryEntry = editing.type === 'category' ? editing.item : null;
  const [slug, setSlug] = useState(entry?.slug || '');
  const [autoSlug, setAutoSlug] = useState(!entry);
  const [inclusions, setInclusions] = useState<(CatalogInclusion & { key: string })[]>(() =>
    (packageEntry?.inclusions || []).map((item, index) => ({
      ...item,
      key: item.id || `inclusion-${index}`,
    })),
  );
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    dialog?.addEventListener('keydown', containDialogFocus);
    dialog?.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    return () => {
      dialog?.removeEventListener('keydown', containDialogFocus);
      dialog?.close();
    };
  }, []);
  useEffect(() => {
    if (error) {
      errorRef.current?.focus({ preventScroll: true });
      if (dialogRef.current) dialogRef.current.scrollTop = 0;
    }
  }, [error]);
  function updateInclusion(key: string, changes: Partial<CatalogInclusion>) {
    setInclusions((current) =>
      current.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    );
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) || '');
    const number = (name: string) => Number(form.get(name) || 0);
    const common = {
      slug,
      description: text('description'),
      status: text('status'),
      clientVisible: form.get('clientVisible') === 'on',
    };
    const identity = { id: entry?.id ?? null, updatedAt: entry?.updatedAt ?? null };
    const payload = isCategory
      ? {
          op: 'catalog-category',
          ...identity,
          category: {
            ...common,
            name: text('name'),
            coverImageUrl: text('image'),
            displayOrder: number('displayOrder'),
          },
        }
      : {
          op: 'catalog-package',
          ...identity,
          package: {
            ...common,
            eventCategoryId: category?.id,
            packageName: text('name'),
            packageImageUrl: text('image'),
            currency: text('currency'),
            paxIncluded: number('paxIncluded'),
            ...Object.fromEntries(priceFields.map(([key]) => [key, number(key)])),
            ...Object.fromEntries(textFields.map(([key]) => [key, text(key)])),
            inclusions: inclusions.map((item, index) => ({
              ...(item.id ? { id: item.id } : {}),
              inclusionName: item.inclusionName,
              description: item.description || '',
              isFree: item.isFree,
              isOptional: item.isOptional,
              displayOrder: index * 10,
            })),
          },
        };
    try {
      await onSave(payload);
    } catch {
      /* The parent displays the server error without closing the editor. */
    }
  }
  const title = `${entry ? 'Edit' : 'New'} ${isCategory ? 'Event Category' : 'Package'}`;
  return (
    <dialog
      ref={dialogRef}
      className={styles.catalogDialog}
      aria-labelledby="catalog-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className={styles.catalogDialogHeading}>
        <div>
          <h2 id="catalog-editor-title">{title}</h2>
          {!isCategory && <p>{category?.name}</p>}
        </div>
        <IconButton
          type="button"
          label="Close editor"
          tooltipAlign="end"
          icon={<X aria-hidden="true" />}
          disabled={busy}
          onClick={onClose}
        />
      </div>
      <form onSubmit={submit}>
        {error && (
          <div ref={errorRef} tabIndex={-1} className={styles.catalogFormError} role="alert">
            {error}
          </div>
        )}
        <fieldset disabled={busy} className={styles.catalogFields}>
          <div className={styles.formGrid}>
            <label>
              {isCategory ? 'Category name' : 'Package name'}
              <input
                name="name"
                required
                minLength={2}
                maxLength={180}
                defaultValue={categoryEntry?.name || packageEntry?.packageName || ''}
                onChange={(event) => {
                  if (autoSlug) setSlug(makeSlug(event.target.value));
                }}
              />
            </label>
            <label>
              Slug
              <input
                name="slug"
                required
                maxLength={140}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={slug}
                onChange={(event) => {
                  setAutoSlug(false);
                  setSlug(event.target.value);
                }}
              />
              <small>Lowercase words separated by hyphens.</small>
            </label>
            <label className={styles.full}>
              Description
              <textarea
                name="description"
                maxLength={isCategory ? 5000 : 10000}
                defaultValue={entry?.description || ''}
              />
            </label>
            <label>
              Status
              <select name="status" defaultValue={entry?.status || 'ACTIVE'}>
                {(isCategory
                  ? ['ACTIVE', 'HIDDEN', 'ARCHIVED']
                  : ['ACTIVE', 'INACTIVE', 'HIDDEN', 'ARCHIVED']
                ).map((status) => (
                  <option key={status} value={status}>
                    {enumLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            {isCategory ? (
              <label>
                Display order
                <input
                  type="number"
                  name="displayOrder"
                  min={0}
                  max={100000}
                  step={1}
                  required
                  defaultValue={categoryEntry?.displayOrder ?? 0}
                />
              </label>
            ) : (
              <label>
                Currency
                <input
                  name="currency"
                  required
                  maxLength={3}
                  pattern="[A-Za-z]{3}"
                  defaultValue={packageEntry?.currency || 'PHP'}
                />
              </label>
            )}
            <label className={`${styles.checkbox} ${styles.full}`}>
              <input
                type="checkbox"
                name="clientVisible"
                defaultChecked={entry?.clientVisible ?? false}
              />
              Client-visible when active{!isCategory ? ' and the event category is visible' : ''}
            </label>
            <label className={styles.full}>
              Image path or HTTPS URL
              <input
                name="image"
                maxLength={1500}
                placeholder="/images/… or https://…"
                defaultValue={categoryEntry?.coverImageUrl || packageEntry?.packageImageUrl || ''}
              />
            </label>
            {!isCategory && (
              <>
                <div className={styles.full}>
                  <h3>Pricing & guest capacity</h3>
                  <p className={styles.help}>
                    Enter catalog amounts. Existing bookings keep their agreed details.
                  </p>
                </div>
                {priceFields.map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      name={key}
                      type="number"
                      min={0}
                      max={20000000}
                      step="0.01"
                      required
                      defaultValue={packageEntry?.[key] ?? 0}
                    />
                  </label>
                ))}
                <label>
                  Guests included
                  <input
                    name="paxIncluded"
                    type="number"
                    min={0}
                    max={100000}
                    step={1}
                    required
                    defaultValue={packageEntry?.paxIncluded ?? 0}
                  />
                </label>
                <div className={styles.full}>
                  <h3>Additional details</h3>
                </div>
                {textFields.map(([key, label, maxLength]) => (
                  <label key={key} className={maxLength > 80 ? styles.full : undefined}>
                    {label}
                    {maxLength > 80 ? (
                      <textarea
                        name={key}
                        maxLength={maxLength}
                        defaultValue={packageEntry?.[key] || ''}
                      />
                    ) : (
                      <input
                        name={key}
                        maxLength={maxLength}
                        defaultValue={packageEntry?.[key] || ''}
                      />
                    )}
                  </label>
                ))}
                <div className={styles.full}>
                  <div className={styles.catalogInclusionHeading}>
                    <h3>Package inclusions</h3>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={inclusions.length >= 80}
                      onClick={() =>
                        setInclusions((current) => [
                          ...current,
                          {
                            key: crypto.randomUUID(),
                            inclusionName: '',
                            description: '',
                            isFree: true,
                            isOptional: false,
                            displayOrder: current.length * 10,
                          },
                        ])
                      }
                    >
                      <Plus size={16} />
                      Add inclusion
                    </Button>
                  </div>
                  {inclusions.map((item, index) => (
                    <div key={item.key} className={styles.catalogInclusionEditor}>
                      <div className={styles.catalogInclusionHeading}>
                        <strong>Inclusion {index + 1}</strong>
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={`Remove inclusion ${index + 1}`}
                          onClick={() =>
                            setInclusions((current) =>
                              current.filter((row) => row.key !== item.key),
                            )
                          }
                        >
                          <X size={16} />
                          Remove
                        </Button>
                      </div>
                      <label>
                        Name
                        <input
                          required
                          maxLength={200}
                          value={item.inclusionName}
                          onChange={(event) =>
                            updateInclusion(item.key, { inclusionName: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Description
                        <textarea
                          maxLength={2000}
                          value={item.description || ''}
                          onChange={(event) =>
                            updateInclusion(item.key, { description: event.target.value })
                          }
                        />
                      </label>
                      <div className={styles.actions}>
                        <label className={styles.checkbox}>
                          <input
                            type="checkbox"
                            checked={item.isFree}
                            onChange={(event) =>
                              updateInclusion(item.key, { isFree: event.target.checked })
                            }
                          />
                          Included at no extra charge
                        </label>
                        <label className={styles.checkbox}>
                          <input
                            type="checkbox"
                            checked={item.isOptional}
                            onChange={(event) =>
                              updateInclusion(item.key, { isOptional: event.target.checked })
                            }
                          />
                          Optional
                        </label>
                      </div>
                    </div>
                  ))}
                  {!inclusions.length && <p className={styles.help}>No inclusions added yet.</p>}
                </div>
              </>
            )}
          </div>
        </fieldset>
        <div className={styles.catalogDialogActions}>
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={<Save aria-hidden="true" />}
            loading={busy}
            loadingLabel="Saving…"
          >
            {isCategory ? 'Save category' : 'Save package'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
