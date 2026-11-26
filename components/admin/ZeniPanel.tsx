'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, CheckCircle2, MessageSquareText, RefreshCw, Send } from 'lucide-react';
import type {
  ZeniAdminOverview,
  ZeniGapGroup,
  ZeniGapReasonLabel,
  ZeniPreviewResult,
} from '@/lib/chatbot/admin-types';
import type { ZeniLanguage } from '@/lib/chatbot/language';
import { ZeniText } from '@/components/chatbot/ZeniText';
import AdminPageHeader from './AdminPageHeader';
import styles from './ZeniPanel.module.css';
import { Button } from '@/components/shared/Button';

const REASON_LABELS: Record<ZeniGapReasonLabel, string> = {
  no_source: 'No published source',
  low_confidence: 'AI was unsure',
  handoff: 'Guest asked for staff',
  conflict: 'Published sources disagree',
};
const LANGUAGE_LABELS: Record<ZeniLanguage, string> = {
  en: 'English',
  fil: 'Filipino',
  taglish: 'Taglish',
};
const LLM_LABELS: Record<string, string> = {
  used: 'Written by the AI from published sources',
  not_needed: 'Rules answer (no AI needed)',
  disabled: 'Backup mode: the AI is off, so keyword matching answered',
  rate_limited: 'Backup mode: the AI limit was reached, so keyword matching answered',
  failed: 'Backup mode: the AI failed, so keyword matching answered',
  timeout: 'Backup mode: the AI timed out, so keyword matching answered',
  rejected: 'Backup mode: the AI answer failed the checks, so keyword matching answered',
  blocked: 'Backup mode: AI safety settings blocked it, so keyword matching answered',
};

function DateText({ value, empty = 'Not tracked' }: { value: string | null; empty?: string }) {
  if (!value) return <>{empty}</>;
  return (
    <time dateTime={value} suppressHydrationWarning>
      {new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Manila',
      }).format(new Date(value))}
    </time>
  );
}

function StatusChip({ tone, children }: { tone: 'ok' | 'off' | 'warn'; children: string }) {
  return (
    <span className={styles.chip} data-tone={tone}>
      {children}
    </span>
  );
}

async function readJson(response: Response) {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'The request could not be completed. Please try again.';
    throw new Error(message);
  }
  return payload;
}

export default function ZeniPanel({ initial }: { initial: ZeniAdminOverview | null }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(initial ? '' : 'Zeni data could not be loaded.');
  const [notice, setNotice] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [result, setResult] = useState<ZeniPreviewResult | null>(null);
  const gapsHeading = useRef<HTMLHeadingElement>(null);

  async function refresh() {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/admin/zeni', { cache: 'no-store' });
      setData((await readJson(response)) as ZeniAdminOverview);
      setNotice('Zeni information refreshed.');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Zeni data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function resolve(group: ZeniGapGroup) {
    setResolving(group.hash);
    setNotice('');
    try {
      const response = await fetch('/api/admin/zeni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'resolve', hash: group.hash }),
      });
      await readJson(response);
      setData((current) =>
        current
          ? {
              ...current,
              gaps: {
                ...current.gaps,
                open: current.gaps.open.filter((item) => item.hash !== group.hash),
                resolvedLast30Days: current.gaps.resolvedLast30Days + 1,
              },
            }
          : current,
      );
      setNotice(`Marked resolved: “${group.question}”.`);
      gapsHeading.current?.focus();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The question could not be resolved.');
    } finally {
      setResolving(null);
    }
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text) {
      setPreviewError('Type a question to test.');
      return;
    }
    setPreviewing(true);
    setPreviewError('');
    try {
      const response = await fetch('/api/admin/zeni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'preview', question: text }),
      });
      setResult((await readJson(response)) as ZeniPreviewResult);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Zeni could not answer.');
    } finally {
      setPreviewing(false);
    }
  }

  const ai = data?.ai;
  return (
    <div className={styles.page}>
      <AdminPageHeader
        title="Zeni"
        actions={
          <Button
            type="button"
            variant="secondary"
            icon={<RefreshCw aria-hidden="true" />}
            loading={loading}
            loadingLabel="Refreshing…"
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        }
      />

      <p className={styles.notice} role="status" aria-live="polite">
        {notice}
      </p>

      {loadError && (
        <div className={styles.alert} role="alert">
          <p>{loadError}</p>
          <Button
            type="button"
            variant="secondary"
            className={styles.fit}
            onClick={() => void refresh()}
          >
            Try again
          </Button>
        </div>
      )}

      {data && ai && (
        <>
          <div className={styles.grid}>
            <section className={styles.card} aria-labelledby="zeni-ai-title">
              <h2 id="zeni-ai-title">AI answers</h2>
              <dl className={styles.facts}>
                <div>
                  <dt>API key</dt>
                  <dd>
                    <StatusChip tone={ai.keyConfigured ? 'ok' : 'off'}>
                      {ai.keyConfigured ? 'Configured' : 'Not configured'}
                    </StatusChip>
                  </dd>
                </div>
                <div>
                  <dt>Answers</dt>
                  <dd>
                    <StatusChip tone={ai.enabled ? 'ok' : 'off'}>
                      {ai.enabled ? 'Written by the AI' : 'Backup mode'}
                    </StatusChip>
                    {ai.reason === 'switched_off' && (
                      <span className={styles.muted}> Turned off by the server setting.</span>
                    )}
                    {ai.reason === 'no_key' && (
                      <span className={styles.muted}> Waiting for an API key.</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>
                    <code>{ai.model}</code>
                  </dd>
                </div>
                <div>
                  <dt>Use on this server</dt>
                  <dd>
                    {ai.usage.lastMinute} of {ai.usage.perMinute} in the last minute ·{' '}
                    {ai.usage.today} of {ai.usage.perDay} in the current day
                    {ai.usage.coolingDownUntil ? (
                      <>
                        {' '}
                        · paused until <DateText value={ai.usage.coolingDownUntil} />
                      </>
                    ) : null}
                  </dd>
                </div>
              </dl>
              <p className={styles.help}>
                With the AI on, it writes each answer from the published facts that match the
                question and may add general planning advice that starts with “In general”. When the
                AI is off, over its limit, slow, or its answer fails the checks, Zeni is in backup
                mode: keyword matching replies with the published text itself. Names, email
                addresses, phone numbers, street addresses and booking references are removed before
                any AI request. The API key is configured in the server environment (see
                docs/chatbot.md) and is never shown here.
              </p>
              {!ai.keyConfigured && (
                <p className={styles.help}>
                  To turn on AI answers: create a key in Google AI Studio, then in Vercel open this
                  project, go to Settings, Environment Variables, add <code>GEMINI_API_KEY</code>{' '}
                  with the key as its value, save, and redeploy. This page then shows Configured.
                </p>
              )}
            </section>

            <section className={styles.card} aria-labelledby="zeni-handoffs-title">
              <h2 id="zeni-handoffs-title">Hand-offs to staff</h2>
              {data.handoffs.available ? (
                <dl className={styles.stats}>
                  <div>
                    <dt>Waiting (new)</dt>
                    <dd>{data.handoffs.open}</dd>
                  </div>
                  <div>
                    <dt>Last 30 days</dt>
                    <dd>{data.handoffs.last30Days}</dd>
                  </div>
                  <div>
                    <dt>All time</dt>
                    <dd>{data.handoffs.total}</dd>
                  </div>
                </dl>
              ) : (
                <p className={styles.help}>Hand-off counts are unavailable right now.</p>
              )}
              <p className={styles.help}>
                Inquiries Zeni sent with the visitor’s consent. Reschedule and cancellation requests
                arrive here too.
              </p>
              <Link href="/admin/inquiries" className={styles.link}>
                Open inquiries <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </section>
          </div>

          <section className={styles.card} aria-labelledby="zeni-knowledge-title">
            <h2 id="zeni-knowledge-title">Knowledge Zeni uses</h2>
            <p className={styles.help}>
              Zeni answers only from these published sources. Drafts, hidden items and internal
              notes are never used.
            </p>
            <ul className={styles.knowledge}>
              {data.knowledge.map((item) => (
                <li key={item.id} className={styles.knowledgeItem}>
                  <h3>{item.label}</h3>
                  <p className={styles.count}>
                    {item.count} <span>in use</span>
                  </p>
                  <p className={styles.muted}>
                    Last updated: <DateText value={item.updatedAt} />
                  </p>
                  <p className={styles.help}>{item.note}</p>
                  {item.edit.href ? (
                    <Link href={item.edit.href} className={styles.link}>
                      {item.edit.label} <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                  ) : (
                    <p className={styles.muted}>{item.edit.label}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.card} aria-labelledby="zeni-gaps-title">
            <h2 id="zeni-gaps-title" ref={gapsHeading} tabIndex={-1}>
              Unanswered questions
            </h2>
            <p className={styles.help}>
              Questions Zeni could not answer from published information, stored without personal
              details. Questions with the same key words count as one, in English or Filipino.
              Publish an FAQ or update the package or policy, then mark the question resolved.
            </p>
            {!data.gaps.available ? (
              <p className={styles.alert} role="note">
                The unanswered-questions log is not installed yet. Run prisma/receptionist.sql on
                the database to start it.
              </p>
            ) : data.gaps.open.length === 0 ? (
              <p className={styles.empty}>
                <CheckCircle2 size={20} aria-hidden="true" />
                No open questions. {data.gaps.resolvedLast30Days} resolved in the last 30 days.
              </p>
            ) : (
              <ul className={styles.gaps}>
                {data.gaps.open.map((group) => (
                  <li key={group.hash} className={styles.gap}>
                    <p className={styles.gapQuestion}>
                      <MessageSquareText size={20} aria-hidden="true" />
                      <span>“{group.question}”</span>
                    </p>
                    {group.otherWordings.length > 0 && (
                      <p className={styles.muted}>
                        Also asked as: {group.otherWordings.map((text) => `“${text}”`).join(', ')}
                      </p>
                    )}
                    <ul className={styles.tags} aria-label="Details">
                      <li>
                        Asked {group.count} {group.count === 1 ? 'time' : 'times'}
                      </li>
                      <li>Topic: {group.topicLabel}</li>
                      <li>{LANGUAGE_LABELS[group.language]}</li>
                      {group.reasons.map((reason) => (
                        <li key={reason} data-reason={reason}>
                          {REASON_LABELS[reason]}
                        </li>
                      ))}
                      <li>
                        Last asked: <DateText value={group.lastAsked} />
                      </li>
                    </ul>
                    <Button
                      type="button"
                      variant="secondary"
                      className={styles.fit}
                      icon={<CheckCircle2 aria-hidden="true" />}
                      loading={resolving === group.hash}
                      loadingLabel="Saving…"
                      aria-label={`Mark resolved: ${group.question}`}
                      onClick={() => void resolve(group)}
                    >
                      Mark resolved
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className={styles.card} aria-labelledby="zeni-test-title">
        <h2 id="zeni-test-title">Ask Zeni (test)</h2>
        <p className={styles.help}>
          Runs one question through the visitor pipeline in preview mode: nothing is saved, no
          inquiry is sent and nothing is logged as unanswered. When the AI is on, the test counts
          toward its free quota.
        </p>
        <form className={styles.testForm} onSubmit={(event) => void ask(event)}>
          <label htmlFor="zeni-test-question">Question</label>
          <textarea
            id="zeni-test-question"
            rows={2}
            maxLength={600}
            value={question}
            aria-invalid={Boolean(previewError) || undefined}
            aria-describedby={previewError ? 'zeni-test-error' : undefined}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <Button
            type="submit"
            variant="primary"
            className={styles.fit}
            icon={<Send aria-hidden="true" />}
            loading={previewing}
            loadingLabel="Asking…"
          >
            Ask Zeni
          </Button>
        </form>
        {previewError && (
          <p id="zeni-test-error" className={styles.alert} role="alert">
            {previewError}
          </p>
        )}
        <div aria-live="polite">
          {result && (
            <div className={styles.result}>
              <h3>Zeni’s reply</h3>
              <ZeniText message={result.reply.message} className={styles.replyText} />
              {(result.reply.cards?.length ?? 0) > 0 && (
                <p className={styles.muted}>
                  Cards:{' '}
                  {result.reply.cards
                    ?.map((card) =>
                      card.type === 'calendar'
                        ? `availability calendar (${card.unavailable.length} booked dates)`
                        : `${card.title}${card.startsAt ? ` (${card.startsAt})` : ''}`,
                    )
                    .join('; ')}
                </p>
              )}
              {[...(result.reply.links ?? []), ...(result.reply.actions ?? [])].length > 0 && (
                <p className={styles.muted}>
                  Buttons:{' '}
                  {[...(result.reply.links ?? []), ...(result.reply.actions ?? [])]
                    .map((item) => item.label)
                    .join(' · ')}
                </p>
              )}
              <dl className={styles.facts}>
                <div>
                  <dt>Answer source</dt>
                  <dd>
                    {LLM_LABELS[result.diagnostics.llm.status] ?? result.diagnostics.llm.status}
                    {result.diagnostics.llm.reason ? ` (${result.diagnostics.llm.reason})` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Detected</dt>
                  <dd>
                    {result.diagnostics.intent} · {result.diagnostics.topic} ·{' '}
                    {LANGUAGE_LABELS[result.diagnostics.language]}
                  </dd>
                </div>
                <div>
                  <dt>Sources</dt>
                  <dd>
                    {result.diagnostics.sources.length
                      ? result.diagnostics.sources.map((source) => source.title).join('; ')
                      : 'None'}
                  </dd>
                </div>
                {result.diagnostics.gap && (
                  <div>
                    <dt>Would be logged</dt>
                    <dd>{REASON_LABELS[result.diagnostics.gap.reason]}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
