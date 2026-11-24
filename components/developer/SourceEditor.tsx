'use client';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Archive, BookOpen, History, Plus, Save, Upload } from 'lucide-react';
import type { DeveloperDocument, DocumentRevision, TaskStep } from '@/lib/developer/types';
import { developerApi, type Mutation } from './api';
import styles from './developer.module.css';

const newStep = (): TaskStep => ({
  title: '',
  description: '',
  assignedRole: 'DEVELOPER',
  priority: 'medium',
  required: true,
  dueOffsetDays: 0,
});
export default function SourceEditor({
  kind,
  documents,
  busy,
  mutate,
}: {
  kind: 'knowledge' | 'template';
  documents: DeveloperDocument[];
  busy: boolean;
  mutate: Mutation;
}) {
  const [selected, setSelected] = useState(''),
    [generation, setGeneration] = useState(0);
  const selectedDoc = documents.find((d) => d.id === selected);
  return (
    <div className={styles.editorLayout}>
      <section className={styles.card}>
        <div className={styles.cardTop}>
          <h2>{kind === 'template' ? 'Task templates' : 'Knowledge sources'}</h2>
          <button
            aria-label="Create new source"
            title="New draft"
            onClick={() => {
              setSelected('');
              setGeneration((g) => g + 1);
            }}
            disabled={busy}
          >
            <Plus size={16} />
            New
          </button>
        </div>
        <p className={styles.help}>
          {kind === 'template'
            ? 'General fallback and category-specific checklists. Published versions are available to approved consumers through the private feed.'
            : 'Approved information for the chatbot. Drafts never enter the published feed.'}
        </p>
        <div className={styles.sourceList}>
          {documents.length === 0 && (
            <div className={styles.empty}>
              <BookOpen size={24} />
              <p>
                No sources yet.
                <br />
                Create your first draft.
              </p>
            </div>
          )}
          {documents.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setSelected(d.id);
                setGeneration((g) => g + 1);
              }}
              className={selected === d.id ? styles.sourceSelected : ''}
            >
              <strong>{d.title}</strong>
              <small>
                {d.archived
                  ? 'Archived'
                  : d.published_revision === d.revision
                    ? 'Published'
                    : d.published_revision
                      ? 'Unpublished changes'
                      : 'Draft'}{' '}
                · v{d.revision}
              </small>
              <span>{d.source || 'No source reference'}</span>
            </button>
          ))}
        </div>
      </section>
      <SourceForm
        key={`${selectedDoc?.id || 'new'}-${selectedDoc?.revision || 0}-${generation}`}
        kind={kind}
        doc={selectedDoc}
        busy={busy}
        mutate={mutate}
        onCreated={() => {
          setSelected('');
          setGeneration((g) => g + 1);
        }}
      />
    </div>
  );
}
function SourceForm({
  kind,
  doc,
  busy,
  mutate,
  onCreated,
}: {
  kind: 'knowledge' | 'template';
  doc?: DeveloperDocument;
  busy: boolean;
  mutate: Mutation;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState(doc?.title || ''),
    [content, setContent] = useState(doc?.content || ''),
    [source, setSource] = useState(doc?.source || '');
  const [dirty, setDirty] = useState(false),
    [history, setHistory] = useState<DocumentRevision[] | null>(null),
    [error, setError] = useState('');
  const [steps, setSteps] = useState<TaskStep[]>(() => {
    try {
      return doc ? JSON.parse(doc.content).steps : [newStep()];
    } catch {
      return [newStep()];
    }
  });
  const editStep = (i: number, values: Partial<TaskStep>) => {
    setDirty(true);
    setSteps((current) => current.map((s, index) => (i === index ? { ...s, ...values } : s)));
  };
  const execute = (input: Record<string, unknown>) => {
    setError('');
    void mutate(input).catch((e) => setError(e instanceof Error ? e.message : 'Action failed.'));
  };
  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>
        <p className={styles.eyebrow}>
          {doc ? `SOURCE / VERSION ${doc.revision}` : 'NEW SOURCE / DRAFT'}
        </p>
        <h2>{doc ? 'Edit source' : 'Create a new draft'}</h2>
        <p>
          {kind === 'template'
            ? 'Publishing makes this checklist available to approved feed consumers. Existing staff tasks are unaffected.'
            : 'Record reviewed facts and their source. Publish after verifying the information.'}
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
            await mutate({
              op: 'document-save',
              data: {
                ...(doc ? { id: doc.id } : {}),
                kind,
                title,
                content: kind === 'template' ? JSON.stringify({ steps }) : content,
                source,
                revision: doc?.revision || 0,
              },
            });
            setDirty(false);
            if (!doc) onCreated();
          } catch {}
        }}
      >
        <fieldset disabled={busy || doc?.archived} className={styles.fieldset}>
          <label>
            Title
            <input
              required
              minLength={3}
              maxLength={160}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              placeholder={kind === 'template' ? 'General event workflow' : 'Venue information'}
            />
          </label>
          <label>
            {kind === 'template'
              ? 'Category key (use general for the fallback)'
              : 'Source reference'}
            <input
              maxLength={500}
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setDirty(true);
              }}
              placeholder={
                kind === 'template'
                  ? 'general, wedding, birthday…'
                  : 'Policy document, reviewed URL, or source owner'
              }
            />
          </label>
          {kind === 'knowledge' ? (
            <label>
              Verified information
              <textarea
                required
                minLength={10}
                maxLength={30000}
                rows={13}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setDirty(true);
                }}
                placeholder="Add the approved information the chatbot may use…"
              />
              <small>{content.length.toLocaleString()} / 30,000 characters</small>
            </label>
          ) : (
            <div className={styles.steps}>
              {steps.map((step, i) => (
                <div className={styles.step} key={i}>
                  <div className={styles.cardTop}>
                    <strong>STEP {String(i + 1).padStart(2, '0')}</strong>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        disabled={i === 0}
                        aria-label={`Move step ${i + 1} up`}
                        onClick={() => {
                          setDirty(true);
                          setSteps((s) => {
                            const n = [...s];
                            [n[i - 1], n[i]] = [n[i], n[i - 1]];
                            return n;
                          });
                        }}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={i === steps.length - 1}
                        aria-label={`Move step ${i + 1} down`}
                        onClick={() => {
                          setDirty(true);
                          setSteps((s) => {
                            const n = [...s];
                            [n[i + 1], n[i]] = [n[i], n[i + 1]];
                            return n;
                          });
                        }}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={steps.length === 1}
                        onClick={() => {
                          setSteps((s) => s.filter((_, index) => index !== i));
                          setDirty(true);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <label>
                    Task title
                    <input
                      required
                      maxLength={160}
                      value={step.title}
                      onChange={(e) => editStep(i, { title: e.target.value })}
                    />
                  </label>
                  <label>
                    Instructions
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={step.description}
                      onChange={(e) => editStep(i, { description: e.target.value })}
                    />
                  </label>
                  <div className={styles.formGrid}>
                    <label>
                      Assigned role
                      <select
                        value={step.assignedRole}
                        onChange={(e) =>
                          editStep(i, {
                            assignedRole: e.target.value as TaskStep['assignedRole'],
                          })
                        }
                      >
                        <option>DEVELOPER</option>
                        <option>ADMIN</option>
                      </select>
                    </label>
                    <label>
                      Priority
                      <select
                        value={step.priority}
                        onChange={(e) =>
                          editStep(i, {
                            priority: e.target.value as TaskStep['priority'],
                          })
                        }
                      >
                        <option>low</option>
                        <option>medium</option>
                        <option>high</option>
                      </select>
                    </label>
                    <label>
                      Due offset (days)
                      <input
                        type="number"
                        min={-365}
                        max={365}
                        value={step.dueOffsetDays}
                        onChange={(e) => editStep(i, { dueOffsetDays: Number(e.target.value) })}
                      />
                    </label>
                    <label className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={step.required}
                        onChange={(e) => editStep(i, { required: e.target.checked })}
                      />
                      Required step
                    </label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                disabled={steps.length >= 100}
                onClick={() => {
                  setSteps((s) => [...s, newStep()]);
                  setDirty(true);
                }}
              >
                <Plus size={15} />
                Add checklist step
              </button>
            </div>
          )}
          <div className={styles.actions}>
            <button className={styles.primary} disabled={busy}>
              <Save size={15} />
              Save draft
            </button>
            {dirty && <small className={styles.muted}>Unsaved changes</small>}
          </div>
        </fieldset>
      </form>
      {doc && (
        <div className={styles.sourceActions}>
          <div className={styles.actions}>
            <button
              disabled={busy || dirty || doc.archived || doc.published_revision === doc.revision}
              onClick={() => {
                if (window.confirm(`Publish version ${doc.revision} of ${doc.title}?`))
                  execute({
                    op: 'document-action',
                    id: doc.id,
                    revision: doc.revision,
                    action: 'publish',
                  });
              }}
            >
              <Upload size={15} />
              Publish v{doc.revision}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                void developerApi<DocumentRevision[]>(
                  `/api/developer/control?section=history&id=${encodeURIComponent(doc.id)}`,
                )
                  .then(setHistory)
                  .catch((e) => setError(e.message));
              }}
            >
              <History size={15} />
              Revision history
            </button>
            <button
              className={styles.danger}
              disabled={busy || doc.archived}
              onClick={() => {
                if (window.confirm('Archive this source and remove it from the published feed?'))
                  execute({
                    op: 'document-action',
                    id: doc.id,
                    revision: doc.revision,
                    action: 'archive',
                  });
              }}
            >
              <Archive size={15} />
              Archive
            </button>
          </div>
          <p className={styles.help}>
            {doc.published_revision
              ? `Published revision: v${doc.published_revision}. Saving a new draft preserves the published snapshot.`
              : 'This source has no published revision.'}
          </p>
          {history && (
            <div className={styles.history}>
              {history.map((r) => (
                <details key={r.revision}>
                  <summary>
                    Version {r.revision} · {r.title}
                  </summary>
                  <pre>{r.content}</pre>
                  <button
                    disabled={busy}
                    onClick={() =>
                      execute({
                        op: 'document-action',
                        id: doc.id,
                        revision: doc.revision,
                        action: 'restore',
                        restoreRevision: r.revision,
                      })
                    }
                  >
                    Restore as new draft
                  </button>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
