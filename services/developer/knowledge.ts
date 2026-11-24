import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { audit, developerDb, transaction } from '@/lib/developer/db';
import { DeveloperError, hash } from '@/lib/developer/security';
import type { DeveloperActor } from '@/lib/developer/auth';
import type { DeveloperDocument } from '@/lib/developer/types';

const taskSchema = z
  .object({
    steps: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(160),
            description: z.string().max(1000),
            assignedRole: z.enum(['DEVELOPER', 'ADMIN']),
            priority: z.enum(['low', 'medium', 'high']),
            required: z.boolean(),
            dueOffsetDays: z.number().int().min(-365).max(365),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
const documentSchema = z
  .object({
    id: z.uuid().optional(),
    kind: z.enum(['knowledge', 'template']),
    title: z.string().trim().min(3).max(160),
    content: z.string().trim().min(10).max(30000),
    source: z.string().trim().max(500),
    revision: z.number().int().min(0),
  })
  .strict();

export async function listDocuments() {
  return (
    await developerDb.query<DeveloperDocument>(
      'SELECT * FROM zion_developer_documents ORDER BY updated_at DESC LIMIT 200',
    )
  ).rows;
}
export async function documentHistory(id: string) {
  if (!z.uuid().safeParse(id).success) throw new DeveloperError('Invalid document.');
  return (
    await developerDb.query(
      'SELECT revision,title,content,source,actor,created_at FROM zion_developer_document_revisions WHERE document_id=$1 ORDER BY revision DESC LIMIT 50',
      [id],
    )
  ).rows;
}
export async function saveDocument(input: unknown, actor: DeveloperActor) {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success)
    throw new DeveloperError(
      'Check the title, source, and content. Content is limited to 30,000 characters.',
      422,
    );
  const data = parsed.data;
  if (data.kind === 'template') {
    try {
      data.content = JSON.stringify(taskSchema.parse(JSON.parse(data.content)));
    } catch {
      throw new DeveloperError('Task templates need 1–100 valid checklist steps.', 422);
    }
  }
  return transaction(async (client) => {
    // Serialize creation to enforce a bounded feed and avoid silently truncating knowledge.
    await client.query('SELECT pg_advisory_xact_lock(9283101)');
    const id = data.id || randomUUID();
    if (!data.id) {
      const count = await client.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM zion_developer_documents',
      );
      if (count.rows[0].count >= 200)
        throw new DeveloperError('The 200-source workspace limit has been reached.', 409);
      if (data.revision !== 0) throw new DeveloperError('Invalid initial revision.', 409);
      await client.query(
        'INSERT INTO zion_developer_documents (id,kind,title,content,source,updated_by) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, data.kind, data.title, data.content, data.source, actor.id],
      );
    } else {
      const updated = await client.query(
        'UPDATE zion_developer_documents SET title=$2,content=$3,source=$4,revision=revision+1,updated_by=$5,updated_at=now() WHERE id=$1 AND revision=$6 AND kind=$7 AND archived=false RETURNING id',
        [id, data.title, data.content, data.source, actor.id, data.revision, data.kind],
      );
      if (!updated.rowCount)
        throw new DeveloperError(
          'This source changed or was archived. Reload before editing.',
          409,
        );
    }
    await client.query(
      'INSERT INTO zion_developer_document_revisions (document_id,revision,title,content,source,actor) SELECT id,revision,title,content,source,$2 FROM zion_developer_documents WHERE id=$1',
      [id, actor.id],
    );
    await audit(actor.id, 'DRAFT_SAVE', id, 'success', client);
    return { id, message: 'Draft saved. The published version is unchanged.' };
  });
}
export async function changeDocument(
  id: string,
  revision: number,
  action: 'publish' | 'archive' | 'restore',
  actor: DeveloperActor,
  restoreRevision?: number,
) {
  return transaction(async (client) => {
    const { rows } = await client.query<DeveloperDocument>(
      'SELECT * FROM zion_developer_documents WHERE id=$1 FOR UPDATE',
      [id],
    );
    const doc = rows[0];
    if (!doc || doc.revision !== revision)
      throw new DeveloperError('This source changed. Reload before continuing.', 409);
    if (action === 'restore') {
      const previous = await client.query(
        'SELECT title,content,source FROM zion_developer_document_revisions WHERE document_id=$1 AND revision=$2',
        [id, restoreRevision],
      );
      if (!previous.rows[0]) throw new DeveloperError('Revision not found.', 404);
      const p = previous.rows[0];
      await client.query(
        'UPDATE zion_developer_documents SET title=$2,content=$3,source=$4,revision=revision+1,archived=false,updated_by=$5,updated_at=now() WHERE id=$1',
        [id, p.title, p.content, p.source, actor.id],
      );
      await client.query(
        'INSERT INTO zion_developer_document_revisions (document_id,revision,title,content,source,actor) SELECT id,revision,title,content,source,$2 FROM zion_developer_documents WHERE id=$1',
        [id, actor.id],
      );
    } else {
      if (action === 'publish' && doc.archived)
        throw new DeveloperError('Restore this archived source as a draft first.', 409);
      await client.query(
        action === 'publish'
          ? 'UPDATE zion_developer_documents SET published_revision=revision,updated_by=$2,updated_at=now() WHERE id=$1'
          : 'UPDATE zion_developer_documents SET archived=true,published_revision=NULL,updated_by=$2,updated_at=now() WHERE id=$1',
        [id, actor.id],
      );
    }
    await audit(actor.id, `SOURCE_${action.toUpperCase()}`, id, 'success', client);
    return {
      message:
        action === 'publish'
          ? 'Published. Consumers can now retrieve this revision.'
          : action === 'archive'
            ? 'Archived and removed from the published feed.'
            : 'Revision restored as a new draft. Review it before publishing.',
    };
  });
}

export async function publishedKnowledge() {
  // Repeatable-read gives the receiver a consistent snapshot across all source families.
  return transaction(async (client) => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const documents = await client.query(
      `SELECT d.id,d.kind,r.title,r.content,r.source,r.revision FROM zion_developer_documents d JOIN zion_developer_document_revisions r ON r.document_id=d.id AND r.revision=d.published_revision WHERE d.archived=false ORDER BY d.id`,
    );
    const faqs = await client.query(
      `SELECT e.id,v.question,v.answer,v.tags,v.version_number AS revision FROM support_faq_entries e JOIN support_faq_versions v ON v.id=e.current_published_version_id LEFT JOIN support_categories c ON c.id=e.category_id WHERE e.status NOT IN ('hidden','archived') AND v.publication_status='PUBLISHED' AND v.client_visible=true AND v.published_at<=now() AND v.question IS NOT NULL AND v.answer IS NOT NULL AND (v.expires_at IS NULL OR v.expires_at>now()) AND (e.category_id IS NULL OR (c.status='active' AND c.client_visible=true)) ORDER BY e.id LIMIT 501`,
    );
    const content = await client.query(
      `SELECT DISTINCT ON (i.id) i.id,i.type,v.payload,v.version_number AS revision FROM content_items i JOIN content_versions v ON v.content_item_id=i.id WHERE v.status='PUBLISHED' AND v.published_at<=now() AND (v.expires_at IS NULL OR v.expires_at>now()) AND (i.type<>'FACILITY' OR v.payload->'visible' IS DISTINCT FROM 'false'::jsonb) ORDER BY i.id,v.version_number DESC LIMIT 501`,
    );
    const packages = await client.query(
      `SELECT p.id,p.package_name AS title,p.description,p.price,p.currency,p.pax_included,p.current_version AS revision FROM packages p JOIN event_categories c ON c.id=p.event_category_id WHERE p.status='active' AND p.client_visible=true AND c.status='active' AND c.client_visible=true ORDER BY p.id LIMIT 501`,
    );
    if ([faqs, content, packages].some((r) => r.rows.length > 500))
      throw new DeveloperError(
        'Source family exceeds the 500-item feed limit. Configure pagination before adding more sources.',
        503,
      );
    const snapshot = {
      documents: documents.rows,
      faqs: faqs.rows,
      content: content.rows,
      packages: packages.rows,
    };
    return {
      version: hash(JSON.stringify(snapshot)),
      generatedAt: new Date().toISOString(),
      ...snapshot,
    };
  });
}

export async function previewKnowledge(question: string) {
  const snapshot = await publishedKnowledge();
  const sources = [
    ...snapshot.documents
      .filter((d) => d.kind === 'knowledge')
      .map((d) => ({ id: d.id, title: d.title, text: d.content })),
    ...snapshot.faqs.map((f) => ({
      id: f.id,
      title: f.question,
      text: f.answer,
    })),
    ...snapshot.content.map((c) => ({
      id: c.id,
      title: c.type,
      text: JSON.stringify(c.payload),
    })),
    ...snapshot.packages.map((p) => ({
      id: p.id,
      title: p.title,
      text: p.description || '',
    })),
  ];
  const terms = question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
  const matches = sources
    .map((s) => ({
      ...s,
      score: terms.filter((t) => `${s.title} ${s.text}`.toLowerCase().includes(t)).length,
    }))
    .filter((s) => s.score >= Math.max(1, Math.ceil(terms.length * 0.4)))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => ({ id: s.id, title: s.title, excerpt: s.text.slice(0, 1500) }));
  return {
    mode: 'source-preview',
    message: matches.length
      ? 'Published source matches. This preview does not call a language model.'
      : 'No verified source matched. No answer should be generated from this evidence.',
    matches,
  };
}

export const reviewTopics = [
  'packages',
  'pricing',
  'venue',
  'availability',
  'policies',
  'contact',
  'other',
] as const;
export async function reportKnowledgeGap(topic: (typeof reviewTopics)[number]) {
  // Accept a controlled topic, never a raw visitor prompt or conversation transcript.
  const fingerprint = hash(`missing:${topic}`);
  await developerDb.query(
    "INSERT INTO zion_developer_review (id,fingerprint,question) VALUES ($1,$2,$3) ON CONFLICT (fingerprint) DO UPDATE SET occurrences=CASE WHEN zion_developer_review.expires_at<now() THEN 1 ELSE zion_developer_review.occurrences+1 END,resolved=false,expires_at=now()+interval '30 days'",
    [randomUUID(), fingerprint, `No verified information: ${topic}`],
  );
}
