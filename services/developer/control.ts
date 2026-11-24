import 'server-only';
import { z } from 'zod';
import { audit, developerDb, transaction } from '@/lib/developer/db';
import { DeveloperError, developerConfig } from '@/lib/developer/security';
import type { DeveloperActor } from '@/lib/developer/auth';
import type { Overview } from '@/lib/developer/types';
import {
  readOrchestrationSettings,
  orchestrationSchema,
} from '@/services/orchestration/developer-settings';
import {
  listDocuments,
  saveDocument,
  changeDocument,
  publishedKnowledge,
  previewKnowledge,
} from './knowledge';
import { readConnections, readWorkflows, changeWorkflow, syncKnowledge } from './integrations';
import { saveContent, contentAction, saveFaq, faqAction, saveFaqCategory } from './content';
import { deliverOperationalWebhook } from '@/services/orchestration/operational-webhook.service';

export async function readOverview(actor: DeveloperActor): Promise<Overview> {
  const [
    checks,
    settings,
    documents,
    workflows,
    delivery,
    recent,
    sessions,
    logs,
    review,
    faqCount,
  ] = await Promise.all([
    readConnections(),
    readOrchestrationSettings(),
    listDocuments(),
    readWorkflows()
      .then((data) => ({ data, error: null as string | null }))
      .catch(() => ({
        data: [],
        error: 'Approved workflows could not be loaded. Check n8n connection details.',
      })),
    developerDb.query(
      "SELECT status,count(*)::int AS count FROM n8n_workflow_logs WHERE created_at>now()-interval '7 days' GROUP BY status",
    ),
    developerDb.query(
      'SELECT id,workflow_name,status,created_at FROM n8n_workflow_logs ORDER BY created_at DESC LIMIT 12',
    ),
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
    settings: settings.value,
    settingsRevision: settings.revision,
    documents,
    publishedCount: documents.filter(
      (d) => d.kind === 'knowledge' && d.published_revision !== null && !d.archived,
    ).length,
    templateCount: documents.filter(
      (d) => d.kind === 'template' && d.published_revision !== null && !d.archived,
    ).length,
    faqCount: faqCount.rows[0].count,
    workflows: workflows.data,
    workflowError: workflows.error,
    delivery: delivery.rows,
    recentDeliveries: recent.rows,
    security: {
      gateway: config.production,
      allowlistedDevelopers: config.emails.length,
      knowledgeFeed: (process.env.DEVELOPER_KNOWLEDGE_TOKEN || '').length >= 43,
      syncConfigured: Boolean(
        process.env.N8N_KNOWLEDGE_SYNC_URL &&
        (process.env.N8N_KNOWLEDGE_SYNC_SECRET || '').length >= 43,
      ),
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
  z.object({
    op: z.literal('settings'),
    value: orchestrationSchema,
    revision,
    code: z.string(),
  }),
  z.object({
    op: z.literal('workflow'),
    id,
    active: z.boolean(),
    code: z.string(),
  }),
  z.object({ op: z.literal('sync'), code: z.string() }),
  z.object({ op: z.literal('delivery-retry'), id, code: z.string() }),
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
    case 'workflow':
      await changeWorkflow(actor, input.id, input.active);
      return { message: 'Workflow state updated in n8n.' };
    case 'sync':
      return syncKnowledge(actor, await publishedKnowledge());
    case 'delivery-retry': {
      await audit(actor.id, 'DELIVERY_RETRY', input.id, 'pending');
      const result = await deliverOperationalWebhook(input.id);
      await audit(actor.id, 'DELIVERY_RETRY', input.id, result.delivered ? 'success' : 'failed');
      if (!result.delivered)
        throw new DeveloperError(
          `Delivery was not completed (${result.status}). Check n8n before retrying.`,
          409,
        );
      return { message: 'Inquiry webhook delivery confirmed.' };
    }
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
    case 'settings':
      return transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(9283102)');
        const current = await client.query(
          "SELECT revision FROM zion_developer_configuration WHERE id='orchestration' FOR UPDATE",
        );
        if ((current.rows[0]?.revision || 0) !== input.revision)
          throw new DeveloperError('Orchestration settings changed. Reload before saving.', 409);
        if (
          input.value.inquiryEnabled &&
          (!process.env.N8N_INQUIRY_WEBHOOK_URL || !process.env.N8N_WEBHOOK_SECRET)
        )
          throw new DeveloperError(
            'Configure the server-side inquiry webhook and secret first.',
            422,
          );
        await client.query(
          "INSERT INTO zion_developer_configuration (id,value,updated_by) VALUES ('orchestration',$1::jsonb,$2) ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value,revision=zion_developer_configuration.revision+1,updated_by=EXCLUDED.updated_by,updated_at=now()",
          [JSON.stringify(input.value), actor.id],
        );
        await audit(actor.id, 'ORCHESTRATION_SETTINGS', 'inquiry', 'success', client);
        return {
          message: 'Orchestration settings saved. New delivery attempts use these limits.',
        };
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
