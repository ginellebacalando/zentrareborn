'use client';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { Pencil, Plus, Search } from 'lucide-react';
import type { CatalogData } from '@/lib/admin/catalog-types';
import { useAdminDate } from './AdminPreferencesProvider';
import CatalogEditor, { type CatalogEditing } from './CatalogEditor';
import { enumLabel } from './AdminBadge';
import LoadingSkeleton from './LoadingSkeleton';
import styles from './admin.module.css';
import { Button, IconButton } from '@/components/shared/Button';

function price(value: number, currency: string) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(value);
}
export default function ServicesPackages() {
  const returnFocus = useRef<HTMLElement | null>(null);
  const createCategoryRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1),
    [query, setQuery] = useState(''),
    [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CatalogEditing | null>(null);
  const [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(''),
    [notice, setNotice] = useState('');
  const date = useAdminDate();
  const params = new URLSearchParams({
    page: String(page),
    ...(categoryId ? { category: categoryId } : {}),
    ...(search ? { q: search } : {}),
  });
  const { data, error, isLoading, mutate } = useSWR<CatalogData>(
    `/api/admin/services?${params}`,
    async (url) => {
      const response = await fetch(url, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load the catalog.');
      return body;
    },
    { shouldRetryOnError: false },
  );
  useEffect(() => {
    if (!editing && data && restoreFocus.current) {
      const target = returnFocus.current?.isConnected
        ? returnFocus.current
        : createCategoryRef.current;
      target?.focus();
      restoreFocus.current = false;
    }
  }, [editing, data]);
  function close() {
    restoreFocus.current = true;
    setEditing(null);
  }
  function open(editor: CatalogEditing) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(editor);
    setSaveError('');
    setNotice('');
  }
  async function save(payload: unknown) {
    setBusy(true);
    setSaveError('');
    try {
      const response = await fetch('/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save the catalog entry.');
      await mutate();
      setCategoryId(body.categoryId);
      setPage(1);
      close();
      setNotice('Catalog entry saved.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save.');
      throw error;
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <div className={styles.error} role="alert">
        {error.message}{' '}
        <Button variant="ghost" onClick={() => void mutate()}>
          Try again
        </Button>
      </div>
    );
  if (!data) return <LoadingSkeleton label="Loading services and packages…" />;
  return (
    <>
      {notice && (
        <div className={styles.success} role="status">
          {notice}
        </div>
      )}
      {!data.canEdit && (
        <p className={styles.help}>
          Read-only catalog. A super administrator can create or edit entries.
        </p>
      )}
      <div className={styles.catalogLayout}>
        <section className={styles.card} aria-label="Event categories">
          <div className={styles.cardHeading}>
            <div>
              <h2>Event categories</h2>
              <p>{data.categoryCount} categories</p>
            </div>
            {data.canEdit && data.categories.length > 0 && (
              <IconButton
                type="button"
                variant="secondary"
                label="New event category"
                ref={createCategoryRef}
                icon={<Plus aria-hidden="true" />}
                onClick={() => open({ type: 'category', item: null })}
              />
            )}
          </div>
          <div className={styles.catalogCategories}>
            {data.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={data.category?.id === category.id}
                className={styles.catalogCategory}
                onClick={() => {
                  setCategoryId(category.id);
                  setPage(1);
                  setQuery('');
                  setSearch('');
                }}
              >
                <strong>{category.name}</strong>
                <span>
                  {category._count.packages} packages · {category.status.toLowerCase()}
                </span>
              </button>
            ))}
          </div>
          {!data.categories.length && (
            <div className={styles.empty}>
              <h3>No event categories yet</h3>
              <p>Create a category to start adding packages.</p>
              {data.canEdit && (
                <Button
                  variant="secondary"
                  ref={createCategoryRef}
                  onClick={() => open({ type: 'category', item: null })}
                >
                  <Plus size={16} />
                  New event category
                </Button>
              )}
            </div>
          )}
          {data.categoryCount > data.categories.length && (
            <p className={styles.help}>Showing the first {data.categories.length} categories.</p>
          )}
        </section>
        <div>
          {data.category ? (
            <>
              <section className={styles.card}>
                <div className={styles.cardHeading}>
                  <div>
                    <h2>{data.category.name}</h2>
                    <p>
                      {data.category.description || 'Manage packages within this event category.'}
                    </p>
                  </div>
                  {data.canEdit && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => open({ type: 'category', item: data.category })}
                    >
                      <Pencil size={16} />
                      Edit category
                    </Button>
                  )}
                </div>
                <div className={styles.actions}>
                  <span
                    className={`${styles.badge} ${data.category.status === 'ACTIVE' ? styles.good : styles.neutral}`}
                  >
                    {enumLabel(data.category.status)}
                  </span>
                  <span className={styles.help}>
                    {data.category.clientVisible
                      ? 'Client-visible when active'
                      : 'Hidden from clients'}
                  </span>
                </div>
              </section>
              <div className={styles.catalogPackagesHeading}>
                <h2>In this category</h2>
                {data.canEdit && (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={isLoading}
                    onClick={() => open({ type: 'package', item: null })}
                  >
                    <Plus size={16} />
                    New package
                  </Button>
                )}
              </div>
              <form
                className={`${styles.toolbar} ${styles.toolbarRow}`}
                role="search"
                aria-label="Search packages"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSearch(query);
                  setPage(1);
                }}
              >
                <label className={styles.searchBox}>
                  <span className={styles.srOnly}>Search packages</span>
                  <Search size={16} aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Search package name or description"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <Button type="submit" variant="secondary">
                  Search
                </Button>
              </form>
              {data.packages.map((item) => (
                <section key={item.id} className={styles.card}>
                  <div className={styles.cardHeading}>
                    <div>
                      <h3>{item.packageName}</h3>
                      <p>
                        {price(item.price, item.currency)} · {item.paxIncluded} guests
                      </p>
                    </div>
                    {data.canEdit && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => open({ type: 'package', item })}
                      >
                        <Pencil size={16} />
                        Edit package
                      </Button>
                    )}
                  </div>
                  <div className={styles.actions}>
                    <span
                      className={`${styles.badge} ${item.status === 'ACTIVE' ? styles.good : styles.neutral}`}
                    >
                      {enumLabel(item.status)}
                    </span>
                    <span className={styles.help}>
                      {item.clientVisible
                        ? 'Client-visible when category is visible'
                        : 'Hidden from clients'}{' '}
                      · Version {item.currentVersion}
                    </span>
                  </div>
                  {item.description && <p>{item.description}</p>}
                  <details className={styles.noticeRow}>
                    <summary>Package details</summary>
                    <dl className={styles.detailGrid}>
                      <div>
                        <dt>Reservation fee</dt>
                        <dd>{price(item.reservationFee, item.currency)}</dd>
                        <dt>Down payment</dt>
                        <dd>{price(item.downPaymentAmount, item.currency)}</dd>
                      </div>
                      <div>
                        <dt>Full payment</dt>
                        <dd>{price(item.fullPaymentAmount, item.currency)}</dd>
                        <dt>Excess guest fee</dt>
                        <dd>{price(item.excessPaxFee, item.currency)}</dd>
                      </div>
                    </dl>
                    <p>
                      {item.checkInTime && `Check-in: ${item.checkInTime}`}
                      {item.checkInTime && item.checkOutTime ? ' · ' : ''}
                      {item.checkOutTime && `Check-out: ${item.checkOutTime}`}
                    </p>
                    <h3>Inclusions</h3>
                    {item.inclusions.length ? (
                      <ul className={styles.catalogInclusions}>
                        {item.inclusions.map((inclusion, index) => (
                          <li key={inclusion.id || index}>
                            <strong>{inclusion.inclusionName}</strong>
                            {inclusion.isOptional ? ' · Optional' : ''}
                            {inclusion.isFree ? ' · Included' : ''}
                            {inclusion.description && <p>{inclusion.description}</p>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No inclusions listed.</p>
                    )}
                    {item.internalNotes && (
                      <p>
                        <strong>Internal notes: </strong>
                        {item.internalNotes}
                      </p>
                    )}
                    <p className={styles.help}>Updated {date(item.updatedAt)}</p>
                  </details>
                </section>
              ))}
              {!data.packages.length && (
                <div className={`${styles.card} ${styles.empty}`}>
                  <h3>{search ? 'No matching packages' : 'No packages yet'}</h3>
                  <p>{search ? 'Try another search.' : 'Add a package to this event category.'}</p>
                </div>
              )}
              <div className={styles.pagination}>
                <span>
                  {data.total} packages · page {data.page}
                </span>
                <Button
                  variant="secondary"
                  disabled={data.page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={data.page * 25 >= data.total}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          ) : (
            <section className={`${styles.card} ${styles.empty}`}>
              <h2>No category selected</h2>
              <p>Select or create an event category to manage its packages.</p>
            </section>
          )}
        </div>
      </div>
      {editing && (
        <CatalogEditor
          editing={editing}
          category={data.category}
          busy={busy}
          error={saveError}
          onSave={save}
          onClose={close}
        />
      )}
    </>
  );
}
