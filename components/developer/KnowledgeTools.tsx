'use client';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Database,
  FlaskConical,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { Overview, Faq, FaqCategory } from '@/lib/developer/types';
import { developerApi, type Mutation } from './api';
import SourceEditor from './SourceEditor';
import styles from './developer.module.css';

export default function KnowledgeTools({
  data,
  busy,
  mutate,
  csrf,
}: {
  data: Overview;
  busy: boolean;
  mutate: Mutation;
  csrf: string;
}) {
  const [tab, setTab] = useState('sources'),
    [question, setQuestion] = useState(''),
    [testing, setTesting] = useState(false),
    [error, setError] = useState('');
  const [result, setResult] = useState<{
    message: string;
    matches: { id: string; title: string; excerpt: string }[];
  } | null>(null);
  const [coverage, setCoverage] = useState<{
    knowledge: number;
    faqs: number;
    content: number;
    packages: number;
    templates: number;
  } | null>(null);
  const run = (input: Record<string, unknown>) => {
    void mutate(input).catch(() => {});
  };
  return (
    <div className={styles.stack}>
      <div className={styles.tabs} aria-label="Assistant knowledge sections">
        {[
          { id: 'sources', label: 'Knowledge sources', icon: BookOpen },
          { id: 'faqs', label: 'FAQ control center', icon: MessageSquare },
          { id: 'test', label: 'Source testing', icon: FlaskConical },
          { id: 'review', label: 'Unanswered topics', icon: MessageSquare },
          {
            id: 'boundaries',
            label: 'Retrieval boundaries',
            icon: ShieldCheck,
          },
        ].map((t) => (
          <button
            className={tab === t.id ? styles.tabActive : ''}
            onClick={() => {
              setTab(t.id);
              setError('');
            }}
            key={t.id}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {tab === 'sources' && (
        <>
          <SourceEditor
            kind="knowledge"
            documents={data.documents.filter((d) => d.kind === 'knowledge')}
            busy={busy}
            mutate={mutate}
          />
          <section className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2>Send published knowledge to n8n</h2>
                <p>
                  Push a signed snapshot to the approved ingestion workflow. Drafts and private
                  operational data are excluded.
                </p>
              </div>
              <button
                disabled={busy || !data.security.syncConfigured}
                onClick={() => {
                  if (
                    window.confirm(
                      'Send the published knowledge snapshot to the configured n8n ingestion workflow?',
                    )
                  )
                    run({ op: 'sync' });
                }}
              >
                Sync published sources
                <ArrowUpRight size={15} />
              </button>
            </div>
            {!data.security.syncConfigured && (
              <p className={styles.help}>
                The ingestion URL and signing secret have not been configured on the server.
              </p>
            )}
          </section>
        </>
      )}
      {tab === 'faqs' && <FaqEditor key={data.checkedAt} busy={busy} mutate={mutate} />}
      {tab === 'test' && (
        <section className={styles.card}>
          <div className={styles.cardTitle}>
            <h2>Test source coverage</h2>
            <p>
              Search the published source set without storing your question. This tests retrieval
              coverage; it does not simulate an unconnected chatbot.
            </p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setTesting(true);
              setError('');
              try {
                setResult(
                  await developerApi('/api/developer/control', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-developer-csrf': csrf,
                    },
                    body: JSON.stringify({ op: 'source-test', question }),
                  }),
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Test failed.');
              } finally {
                setTesting(false);
              }
            }}
          >
            <label>
              Test question
              <input
                required
                minLength={3}
                maxLength={300}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What information is available about the venue?"
              />
            </label>
            <button disabled={testing || busy} className={styles.primary}>
              <FlaskConical size={16} />
              {testing ? 'Checking sources…' : 'Check published sources'}
            </button>
          </form>
          {result && (
            <div className={styles.testResult}>
              <h3>{result.message}</h3>
              {result.matches.map((m) => (
                <article key={m.id}>
                  <strong>{m.title}</strong>
                  <p>{m.excerpt}</p>
                  <code>{m.id}</code>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {tab === 'review' && (
        <section className={styles.card}>
          <div className={styles.cardTitle}>
            <h2>Unanswered-topic review</h2>
            <p>
              Privacy-preserving reports from connected chatbot consumers. Only controlled topics
              are accepted; visitor prompts and conversations are never stored here. Reports expire
              after 30 days.
            </p>
          </div>
          {!data.review.length ? (
            <div className={styles.empty}>
              <Check size={26} />
              <h3>No unresolved reports</h3>
              <p>
                {data.security.knowledgeFeed
                  ? 'Connected consumers can report missing-information topics through the scoped knowledge feed.'
                  : 'Connect the chatbot knowledge feed to collect real reports.'}
              </p>
            </div>
          ) : (
            data.review.map((item) => (
              <div className={styles.listRow} key={item.id}>
                <MessageSquare size={20} />
                <div>
                  <strong>{item.question}</strong>
                  <small>{item.occurrences} occurrence(s)</small>
                </div>
                <button
                  disabled={busy}
                  onClick={() => {
                    setTab('faqs');
                  }}
                >
                  Create FAQ
                </button>
                <button disabled={busy} onClick={() => run({ op: 'review-resolve', id: item.id })}>
                  Resolve
                </button>
              </div>
            ))
          )}
        </section>
      )}
      {tab === 'boundaries' && (
        <>
          <section className={styles.card}>
            <div className={styles.cardTop}>
              <div>
                <h2>Approved source coverage</h2>
                <p>Current counts come from the same snapshot served to the chatbot consumer.</p>
              </div>
              <button
                onClick={() => {
                  void developerApi<typeof coverage>('/api/developer/control?section=coverage')
                    .then(setCoverage)
                    .catch((e) => setError(e.message));
                }}
              >
                <RefreshCw size={15} />
                Check coverage
              </button>
            </div>
            {coverage && (
              <div className={styles.metrics}>
                {Object.entries(coverage).map(([label, count]) => (
                  <div className={styles.metric} key={label}>
                    <div>{label.toUpperCase()}</div>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
          <div className={styles.connectionGrid}>
            {[
              {
                title: 'Published sources only',
                text: 'Unpublished revisions, archived sources, expired content, hidden FAQs, and hidden packages are excluded.',
              },
              {
                title: 'Private data stays private',
                text: 'Staff accounts, bookings, payments, internal notes, credentials, and conversation transcripts are excluded from the feed.',
              },
              {
                title: 'Explicit consumer connection',
                text: 'The knowledge feed has a separate bearer token. It grants no developer-session or control-panel permissions.',
              },
              {
                title: 'Verified evidence',
                text: 'Source tests show matching excerpts. A chatbot must refuse unsupported answers and cite the approved sources it uses.',
              },
            ].map((c) => (
              <article className={styles.card} key={c.title}>
                <Database size={21} className={styles.accent} />
                <h2>{c.title}</h2>
                <p>{c.text}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
function FaqEditor({ busy, mutate }: { busy: boolean; mutate: Mutation }) {
  const [faqs, setFaqs] = useState<Faq[]>([]),
    [categories, setCategories] = useState<FaqCategory[]>([]),
    [selected, setSelected] = useState<Faq | null>(null),
    [error, setError] = useState('');
  const [question, setQuestion] = useState(''),
    [answer, setAnswer] = useState(''),
    [categoryId, setCategoryId] = useState(''),
    [visible, setVisible] = useState(false),
    [categoryName, setCategoryName] = useState('');
  useEffect(() => {
    let cancelled = false;
    void developerApi<{ faqs: Faq[]; categories: FaqCategory[] }>(
      '/api/developer/control?section=faqs',
    )
      .then((r) => {
        if (!cancelled) {
          setFaqs(r.faqs);
          setCategories(r.categories);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const choose = (faq: Faq | null) => {
    setSelected(faq);
    setQuestion(faq?.question || '');
    setAnswer(faq?.answer || '');
    setCategoryId(faq?.category_id || '');
    setVisible(faq?.client_visible || false);
  };
  const run = (input: Record<string, unknown>) => {
    void mutate(input).catch(() => {});
  };
  return (
    <div className={styles.stack}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.editorLayout}>
        <section className={styles.card}>
          <div className={styles.cardTop}>
            <h2>FAQ knowledge base</h2>
            <button onClick={() => choose(null)} disabled={busy}>
              <Plus size={15} />
              New
            </button>
          </div>
          <div className={styles.sourceList}>
            {faqs.length === 0 && <p className={styles.muted}>No FAQ entries yet.</p>}
            {faqs.map((f) => (
              <button
                onClick={() => choose(f)}
                className={selected?.id === f.id ? styles.sourceSelected : ''}
                key={f.id}
              >
                <strong>{f.question}</strong>
                <small>
                  {f.current_draft_version_id ? 'Draft changes' : f.status} ·{' '}
                  {f.current_published_version_id ? 'Published snapshot' : 'No published version'}
                </small>
              </button>
            ))}
          </div>
        </section>
        <section className={styles.card}>
          <div className={styles.cardTitle}>
            <h2>{selected ? 'Edit FAQ draft' : 'New FAQ draft'}</h2>
            <p>
              Draft and published answers are separate. Publishing can update the public FAQ page
              and the chatbot source feed.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run({
                op: 'faq-save',
                data: {
                  ...(selected ? { id: selected.id } : {}),
                  question,
                  answer,
                  categoryId: categoryId || null,
                  clientVisible: visible,
                  lock: selected?.lock || null,
                },
              });
            }}
          >
            <fieldset className={styles.fieldset} disabled={busy}>
              <label>
                Question
                <input
                  required
                  maxLength={500}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </label>
              <label>
                Approved answer
                <textarea
                  required
                  maxLength={10000}
                  rows={8}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </label>
              <label>
                Category
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Uncategorized</option>
                  {categories
                    .filter((c) => c.status === 'active')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                />
                Client-visible when published
              </label>
              <button className={styles.primary}>Save FAQ draft</button>
            </fieldset>
          </form>
          {selected && (
            <div className={styles.sourceActions}>
              <div className={styles.actions}>
                <button
                  disabled={busy || !selected.current_draft_version_id}
                  onClick={() => {
                    if (window.confirm('Publish this FAQ draft to its configured audience?'))
                      run({
                        op: 'faq-action',
                        id: selected.id,
                        lock: selected.lock,
                        action: 'publish',
                      });
                  }}
                >
                  Publish saved draft
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run({
                      op: 'faq-action',
                      id: selected.id,
                      lock: selected.lock,
                      action: 'hide',
                    })
                  }
                >
                  Hide FAQ
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Archive this FAQ?'))
                      run({
                        op: 'faq-action',
                        id: selected.id,
                        lock: selected.lock,
                        action: 'archive',
                      });
                  }}
                >
                  Archive
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      <section className={styles.card}>
        <h2>FAQ categories</h2>
        <p className={styles.help}>
          Category visibility also controls whether its published answers are eligible for the
          public website and knowledge feed.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run({
              op: 'category-save',
              data: {
                name: categoryName,
                status: 'active',
                clientVisible: true,
              },
            });
          }}
          className={styles.inlineForm}
        >
          <label>
            New category
            <input
              required
              maxLength={100}
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
          </label>
          <button disabled={busy}>Create category</button>
        </form>
        {categories.map((c) => (
          <div className={styles.listRow} key={c.id}>
            <div>
              <strong>{c.name}</strong>
              <small>
                {c.status} · {c.client_visible ? 'client-visible' : 'private'}
              </small>
            </div>
            <button
              disabled={busy}
              onClick={() =>
                run({
                  op: 'category-save',
                  data: {
                    id: c.id,
                    name: c.name,
                    status: c.status === 'active' ? 'hidden' : 'active',
                    clientVisible: c.client_visible,
                  },
                })
              }
            >
              {c.status === 'active' ? 'Hide' : 'Activate'}
            </button>
            <button
              disabled={busy || c.status === 'archived'}
              onClick={() => {
                if (window.confirm(`Archive ${c.name} and exclude its FAQs from public retrieval?`))
                  run({
                    op: 'category-save',
                    data: {
                      id: c.id,
                      name: c.name,
                      status: 'archived',
                      clientVisible: false,
                    },
                  });
              }}
            >
              Archive
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
