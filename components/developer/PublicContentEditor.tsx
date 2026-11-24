'use client';
import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import type { PublicItem, PublicVersion } from '@/lib/developer/types';
import { developerApi, type Mutation } from './api';
import styles from './developer.module.css';

const domains = [
  { type: 'GALLERY_ITEM', label: 'Gallery' },
  { type: 'FACILITY', label: 'Facilities' },
  { type: 'RULES', label: 'Rules & regulations' },
  { type: 'PRIVACY', label: 'Privacy policy' },
  { type: 'TERMS', label: 'Terms & conditions' },
  { type: 'ABOUT', label: 'About' },
  { type: 'CONTACT', label: 'Contact' },
];
function defaultPayload(type: string) {
  if (type === 'GALLERY_ITEM')
    return {
      title: '',
      caption: '',
      altText: '',
      imageUrl: '',
      featured: false,
      displayOrder: 0,
    };
  if (type === 'FACILITY')
    return {
      name: '',
      slug: '',
      summary: '',
      description: '',
      amenities: [],
      accessibilityGuidance: '',
      imageUrls: [],
      cta: null,
      displayOrder: 0,
      visible: true,
    };
  return {
    title: '',
    summary: '',
    effectiveDate: '',
    blocks: [
      { type: 'heading', level: 2, text: 'Overview' },
      { type: 'paragraph', text: '' },
    ],
  };
}
export default function PublicContentEditor({ busy, mutate }: { busy: boolean; mutate: Mutation }) {
  const [items, setItems] = useState<PublicItem[]>([]),
    [type, setType] = useState('ABOUT'),
    [selected, setSelected] = useState(''),
    [generation, setGeneration] = useState(0),
    [error, setError] = useState('');
  const load = useCallback(
    () =>
      developerApi<PublicItem[]>('/api/developer/control?section=content')
        .then(setItems)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);
  const action: Mutation = async (input) => {
    await mutate(input);
    await load();
    setGeneration((g) => g + 1);
  };
  const current = items.find((i) => i.id === selected);
  return (
    <div className={styles.stack}>
      <div className={styles.tabs} aria-label="Public content types">
        {domains.map((d) => (
          <button
            key={d.type}
            onClick={() => {
              setType(d.type);
              setSelected('');
            }}
            className={type === d.type ? styles.tabActive : ''}
          >
            {d.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.editorLayout}>
        <section className={styles.card}>
          <div className={styles.cardTop}>
            <h2>{domains.find((d) => d.type === type)?.label}</h2>
            <button
              onClick={() => {
                setSelected('');
                setGeneration((g) => g + 1);
              }}
              disabled={busy}
            >
              <Plus size={15} />
              New
            </button>
          </div>
          <div className={styles.sourceList}>
            {!items.some((i) => i.type === type) && (
              <div className={styles.empty}>
                <FileText size={24} />
                <p>No managed content yet. Create a draft to add reviewed information.</p>
              </div>
            )}
            {items
              .filter((i) => i.type === type)
              .map((i) => (
                <button
                  key={i.id}
                  className={selected === i.id ? styles.sourceSelected : ''}
                  onClick={() => setSelected(i.id)}
                >
                  <strong>{i.title}</strong>
                  <small>
                    {i.versions[0]?.status || 'No version'} · v{i.versions[0]?.version_number || 0}
                  </small>
                  <span>{i.slug}</span>
                </button>
              ))}
          </div>
        </section>
        <ContentForm
          key={`${current?.id || type}-${generation}`}
          type={type}
          item={current}
          busy={busy}
          mutate={action}
        />
      </div>
    </div>
  );
}
function ContentForm({
  type,
  item,
  busy,
  mutate,
}: {
  type: string;
  item?: PublicItem;
  busy: boolean;
  mutate: Mutation;
}) {
  const [title, setTitle] = useState(item?.title || ''),
    [slug, setSlug] = useState(item?.slug || ''),
    [payload, setPayload] = useState(
      JSON.stringify(item?.versions[0]?.payload || defaultPayload(type), null, 2),
    ),
    [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const latest = item?.versions[0];
  const run = (v: PublicVersion, action: string) => {
    setError('');
    void mutate({
      op: 'content-action',
      id: item!.id,
      versionId: v.id,
      action,
    }).catch((e) => setError(e instanceof Error ? e.message : 'Content change failed.'));
  };
  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>
        <p className={styles.eyebrow}>GOVERNED PUBLIC CONTENT</p>
        <h2>{item ? 'Create a new revision' : 'Create content draft'}</h2>
        <p>
          Saved drafts leave the published client website unchanged. Each publication requires
          review, approval, and a fresh verification code.
        </p>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          try {
            const parsed = JSON.parse(payload);
            await mutate({
              op: 'content-save',
              data: {
                ...(item ? { id: item.id } : {}),
                type,
                title,
                slug,
                payload: parsed,
                latestVersionId: latest?.id || null,
              },
            });
            setDirty(false);
          } catch (e) {
            setError(
              e instanceof SyntaxError
                ? 'The content payload must be valid JSON.'
                : e instanceof Error
                  ? e.message
                  : 'Content could not be saved.',
            );
          }
        }}
      >
        <fieldset disabled={busy} className={styles.fieldset}>
          <div className={styles.formGrid}>
            <label>
              Title
              <input
                required
                maxLength={180}
                disabled={Boolean(item)}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                  if (!item && !slug)
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, ''),
                    );
                }}
              />
            </label>
            <label>
              Slug
              <input
                required
                maxLength={120}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                disabled={Boolean(item)}
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
          </div>
          <label>
            Structured content (JSON)
            <textarea
              className={styles.codeEditor}
              spellCheck={false}
              rows={17}
              required
              maxLength={60000}
              value={payload}
              onChange={(e) => {
                setPayload(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <p className={styles.help}>
            Gallery entries need an approved image URL and alt text. Policy pages use heading,
            paragraph, list, callout, and link blocks. Existing image paths and HTTPS media URLs are
            supported.
          </p>
          <button disabled={busy} className={styles.primary}>
            Save new draft
          </button>
          {dirty && <small className={styles.muted}>Unsaved changes</small>}
        </fieldset>
      </form>
      {item && (
        <div className={styles.sourceActions}>
          <h3>Version history & publication</h3>
          {item.versions.map((v) => (
            <div className={styles.versionRow} key={v.id}>
              <div>
                <strong>Version {v.version_number}</strong>
                <small>{v.status}</small>
              </div>
              <div className={styles.actions}>
                {v.id === latest?.id && (
                  <>
                    {v.status === 'DRAFT' && (
                      <button disabled={busy || dirty} onClick={() => run(v, 'review')}>
                        Submit for review
                      </button>
                    )}
                    {v.status === 'IN_REVIEW' && (
                      <button disabled={busy || dirty} onClick={() => run(v, 'approve')}>
                        Approve reviewed draft
                      </button>
                    )}
                    {v.status === 'APPROVED' && (
                      <button
                        disabled={busy || dirty}
                        className={styles.primary}
                        onClick={() => {
                          if (
                            window.confirm('Publish this approved version to the client website?')
                          )
                            run(v, 'publish');
                        }}
                      >
                        Publish to client
                      </button>
                    )}
                  </>
                )}
                {v.status === 'PUBLISHED' && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm('Archive this live version and remove it from the website?')
                      )
                        run(v, 'archive');
                    }}
                  >
                    Archive
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Restore this version as a new draft?')) run(v, 'rollback');
                  }}
                >
                  Restore as draft
                </button>
                <button
                  onClick={() => {
                    setPayload(JSON.stringify(v.payload, null, 2));
                    setDirty(true);
                  }}
                >
                  View payload
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
