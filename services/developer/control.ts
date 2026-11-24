import 'server-only';
import { z } from 'zod';
import { audit, developerDb, transaction } from '@/lib/developer/db';
import { DeveloperError, developerConfig } from '@/lib/developer/security';
import type { DeveloperActor } from '@/lib/developer/auth';
import type { AutomationStatusSummary, Overview } from '@/lib/developer/types';
import { isCronConfigured, isMailConfigured } from '@/lib/automation/config';
import { listDocuments, saveDocument, changeDocument, previewKnowledge } from './knowledge';
import { readConnections } from './integrations';
import { saveContent, contentAction, saveFaq, faqAction, saveFaqCategory } from './content';

/** Counts and booleans only; outbox content and recipients stay in the admin panel. */
async function readAutomationStatus(): Promise<AutomationStatusSummary> {
  const status = {
    emailConfigured: isMailConfigured(),
    cronConfigured: isCronConfigured(),
  };
  try {
    const counts = await developerDb.query<{ status: string; count: number }>(
      'SELECT status,count(*)::int AS count FROM zion_admin_outbox GROUP BY status ORDER BY status',
    );
    let lastRunAt: string | null = null;
    try {
      // Prisma stores UTC wall time in TIMESTAMP(3); format it in SQL so pg does not shift it.
      const lastRun = await developerDb.query<{ at: string }>(
        `SELECT to_char(at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at FROM zion_automation_state WHERE key='last-run'`,
      );
      lastRunAt = lastRun.rows[0]?.at ?? null;
    } catch {
      // The automation state table is created by prisma/automation.sql; absent until installed.
    }
    return { ...status, counts: counts.rows, lastRunAt, available: true };
  } catch {
    return { ...status, counts: [], lastRunAt: null, available: false };
  }
}

export async function readOverview(actor: DeveloperActor): Promise<Overview> {
  const [checks, documents, automation, sessions, logs, review, faqCount] = await Promise.all([
    readConnections(),
    listDocuments(),
    readAutomationStatus(),
    developerDb.query(
      "SELECT a.id,a.name,a.email,s.id AS session_id,s.created_at,s.expires_at FROM zion_developer_sessions s JOIN zion_developer_accounts a ON a.id=s.developer_id WHERE s.revoked_at IS NULL AND s.expires_at>now() AND s.last_seen_at>now()-interval '10 minutes' AND a.enabled=true ORDER BY s.created_at DESC",
    ),
    developerDb.query('SELECT * FROM zion_developer_audit ORDER BY created_at DESC LIMIT 50'),
    developerDb.query(
      'SELECT id,question,occurrences,created_at FROM zion_developer_review WHERE resolved=false AND expires_at>now() ORDER BY occurrences DESC LIMIT 50',
    ),
    developerDb.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM support_faq_entries WHERE current_published_version_id IS NOT NULL AND status='published'",
    ),
  ]);
  const config = developerConfig()!;
  return {
    checks,
    checkedAt: new Date().toISOString(),
    documents,
    publishedCount: documents.filter(
      (d) => d.kind === 'knowledge' && d.published_revision !== null && !d.archived,
    ).length,
    templateCount: documents.filter(
      (d) => d.kind === 'template' && d.published_revision !== null && !d.archived,
    ).length,
    faqCount: faqCount.rows[0].count,
    automation,
    security: {
      gateway: config.production,
      allowlistedDevelopers: config.emails.length,
      knowledgeFeed: (process.env.DEVELOPER_KNOWLEDGE_TOKEN || '').length >= 43,
    },
    sessions: sessions.rows.map((s) => ({
      ...s,
      current: s.session_id === actor.sessionId,
    })),
    audit: logs.rows,
    review: review.rows,
  };
}

const id = z.string().min(1).max(120),
  revision = z.number().int().min(0);
export const mutationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('document-save'),
    data: z.unknown(),
    code: z.string(),
  }),
  z.object({
    op: z.literal('document-action'),
    id: z.uuid(),
    revision,
    action: z.enum(['publish', 'archive', 'restore']),
    restoreRevision: revision.optional(),
    code: z.string(),
  }),
  z.object({ op: z.literal('session-revoke'), id, code: z.string() }),
  z.object({ op: z.literal('account-disable'), id, code: z.string() }),
  z.object({ op: z.literal('review-resolve'), id, code: z.string() }),
  z.object({
    op: z.literal('content-save'),
    data: z.unknown(),
    code: z.string(),
  }),
  z.object({
    op: z.literal('content-action'),
    id,
    versionId: id,
    action: z.enum(['review', 'approve', 'publish', 'archive', 'rollback']),
    code: z.string(),
  }),
  z.object({ op: z.literal('faq-save'), data: z.unknown(), code: z.string() }),
  z.object({
    op: z.literal('faq-action'),
    id,
    lock: z.string().max(100),
    action: z.enum(['publish', 'hide', 'archive']),
    code: z.string(),
  }),
  z.object({
    op: z.literal('category-save'),
    data: z.unknown(),
    code: z.string(),
  }),
]);
export async function mutateDeveloper(
  input: z.infer<typeof mutationSchema>,
  actor: DeveloperActor,
) {
  switch (input.op) {
    case 'document-save':
      return saveDocument(input.data, actor);
    case 'document-action':
      return changeDocument(input.id, input.revision, input.action, actor, input.restoreRevision);
    case 'content-save':
      return saveContent(input.data, actor);
    case 'content-action':
      return contentAction(input.id, input.versionId, input.action, actor);
    case 'faq-save':
      return saveFaq(input.data, actor);
    case 'faq-action':
      return faqAction(input.id, input.lock, input.action, actor);
    case 'category-save':
      return saveFaqCategory(input.data, actor);
    case 'review-resolve':
      return transaction(async (client) => {
        const r = await client.query(
          'UPDATE zion_developer_review SET resolved=true WHERE id=$1 RETURNING id',
          [input.id],
        );
        if (!r.rowCount) throw new DeveloperError('Review item not found.', 404);
        await audit(actor.id, 'REVIEW_RESOLVE', input.id, 'success', client);
        return { message: 'Review item resolved.' };
      });
    case 'account-disable':
      if (input.id === actor.id)
        throw new DeveloperError('Use the operator CLI to disable your own account.', 409);
      return transaction(async (client) => {
        const r = await client.query(
          'UPDATE zion_developer_accounts SET enabled=false WHERE id=$1 RETURNING id',
          [input.id],
        );
        if (!r.rowCount) throw new DeveloperError('Developer not found.', 404);
        await client.query(
          'UPDATE zion_developer_sessions SET revoked_at=now() WHERE developer_id=$1',
          [input.id],
        );
        await audit(actor.id, 'ACCOUNT_DISABLE', input.id, 'success', client);
        return { message: 'Developer disabled and sessions revoked.' };
      });
    case 'session-revoke':
      return transaction(async (client) => {
        const r = await client.query(
          'UPDATE zion_developer_sessions SET revoked_at=now() WHERE id=$1 RETURNING id',
          [input.id],
        );
        if (!r.rowCount) throw new DeveloperError('Session not found.', 404);
        await audit(actor.id, 'SESSION_REVOKE', input.id, 'success', client);
        return { message: 'Session revoked.' };
      });
  }
}

export const testQuestionSchema = z
  .object({
    op: z.literal('source-test'),
    question: z.string().trim().min(3).max(300),
  })
  .strict();
export async function sourceTest(question: string) {
  return previewKnowledge(question);
}
