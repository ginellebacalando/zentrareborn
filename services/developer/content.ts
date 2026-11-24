import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { audit, developerDb, transaction } from '@/lib/developer/db';
import { DeveloperError } from '@/lib/developer/security';
import type { DeveloperActor } from '@/lib/developer/auth';

const contentTypes = [
  'GALLERY_ITEM',
  'FACILITY',
  'RULES',
  'PRIVACY',
  'TERMS',
  'ABOUT',
  'CONTACT',
] as const;
const text = z.string().trim().min(1);
const url = z
  .string()
  .max(2000)
  .refine((v) => {
    if (v.includes('\\') || /[\u0000-\u0020]/.test(v)) return false;
    if (v.startsWith('/') && !v.startsWith('//')) return true;
    try {
      const u = new URL(v);
      return u.protocol === 'https:' && !u.username && !u.password;
    } catch {
      return false;
    }
  }, 'Use a site-relative path or an HTTPS URL.');
const block = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('heading'),
    text: text.max(300),
    level: z.number().int().min(2).max(4),
    anchor: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
  }),
  z.object({ type: z.literal('paragraph'), text: text.max(8000) }),
  z.object({ type: z.literal('callout'), text: text.max(8000) }),
  z.object({
    type: z.literal('list'),
    ordered: z.boolean().default(false),
    items: z.array(text.max(500)).min(1).max(50),
  }),
  z.object({ type: z.literal('link'), label: text.max(200), href: url }),
]);
function validatePayload(type: string, payload: unknown) {
  const schema =
    type === 'GALLERY_ITEM'
      ? z.object({
          title: text.max(180),
          caption: z.string().max(2000).nullable().optional(),
          altText: text.max(300),
          imageUrl: url,
          featured: z.boolean().default(false),
          displayOrder: z.number().int().default(0),
        })
      : type === 'FACILITY'
        ? z.object({
            name: text.max(180),
            slug: text.max(120),
            summary: text.max(600),
            description: text.max(12000),
            amenities: z.array(text.max(500)).max(50),
            accessibilityGuidance: z.string().max(4000).nullable().optional(),
            imageUrls: z.array(url).max(20),
            cta: z
              .object({ label: text.max(80), href: url })
              .nullable()
              .optional(),
            displayOrder: z.number().int().default(0),
            visible: z.boolean().default(true),
          })
        : z.object({
            title: text.max(240),
            summary: z.string().max(1000).nullable().optional(),
            effectiveDate: z.string().max(40).nullable().optional(),
            blocks: z.array(block).min(1).max(100),
          });
  const parsed = schema.safeParse(payload);
  if (!parsed.success)
    throw new DeveloperError(
      `Content validation: ${parsed.error.issues[0]?.message || 'invalid payload'}`,
      422,
    );
  return parsed.data;
}
const contentSchema = z
  .object({
    id: z.string().min(1).max(120).optional(),
    type: z.enum(contentTypes),
    title: text.max(180),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120),
    payload: z.unknown(),
    latestVersionId: z.string().max(120).nullable(),
  })
  .strict();

export async function listContent() {
  return (
    await developerDb.query(
      `SELECT i.id,i.type,i.title,i.slug,COALESCE((SELECT json_agg(v ORDER BY v.version_number DESC) FROM (SELECT id,version_number,status,payload,updated_at,updated_at::text AS lock FROM content_versions WHERE content_item_id=i.id ORDER BY version_number DESC LIMIT 20) v),'[]'::json) AS versions FROM content_items i ORDER BY i.updated_at DESC LIMIT 100`,
    )
  ).rows;
}
export async function saveContent(input: unknown, actor: DeveloperActor) {
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success)
    throw new DeveloperError('Check the content title, slug, type, and payload.', 422);
  const data = parsed.data,
    payload = validatePayload(data.type, data.payload);
  return transaction(async (client) => {
    const id = data.id || randomUUID();
    if (data.id) {
      const item = await client.query('SELECT id,type FROM content_items WHERE id=$1 FOR UPDATE', [
        id,
      ]);
      if (!item.rows[0] || item.rows[0].type !== data.type)
        throw new DeveloperError('Content item not found.', 404);
      const latest = await client.query(
        'SELECT id FROM content_versions WHERE content_item_id=$1 ORDER BY version_number DESC LIMIT 1',
        [id],
      );
      if ((latest.rows[0]?.id || null) !== data.latestVersionId)
        throw new DeveloperError('Content changed. Reload before saving.', 409);
      // Public metadata changes only on publication; creating a draft cannot rename a live item.
    } else {
      await client.query(
        'INSERT INTO content_items (id,type,title,slug,created_by,updated_by,updated_at) VALUES ($1,$2::"ContentType",$3,$4,$5,$5,now())',
        [id, data.type, data.title, data.slug, actor.id],
      );
    }
    await client.query(
      "UPDATE content_versions SET status='ARCHIVED',archived_at=now() WHERE content_item_id=$1 AND status IN ('DRAFT','IN_REVIEW','APPROVED','REJECTED')",
      [id],
    );
    const versionId = randomUUID();
    await client.query(
      "INSERT INTO content_versions (id,content_item_id,version_number,status,payload,change_summary,created_by,updated_at) SELECT $1,$2,COALESCE(max(version_number),0)+1,'DRAFT',$3::jsonb,$4,$5,now() FROM content_versions WHERE content_item_id=$2",
      [versionId, id, JSON.stringify(payload), `Developer draft: ${data.title}`, actor.id],
    );
    await audit(actor.id, 'CONTENT_DRAFT', id, 'success', client);
    return {
      message: 'Content draft saved. Review and approve it before publication.',
    };
  });
}
export async function contentAction(
  id: string,
  versionId: string,
  action: 'review' | 'approve' | 'publish' | 'archive' | 'rollback',
  actor: DeveloperActor,
) {
  return transaction(async (client) => {
    const item = await client.query('SELECT * FROM content_items WHERE id=$1 FOR UPDATE', [id]);
    if (!item.rows[0]) throw new DeveloperError('Content not found.', 404);
    const versions = await client.query(
      'SELECT * FROM content_versions WHERE content_item_id=$1 ORDER BY version_number DESC',
      [id],
    );
    const v = versions.rows.find((v) => v.id === versionId);
    if (!v) throw new DeveloperError('Version not found.', 404);
    if (action !== 'rollback' && action !== 'archive' && versions.rows[0].id !== v.id)
      throw new DeveloperError('A newer draft exists. Reload before continuing.', 409);
    if (action === 'review') {
      if (v.status !== 'DRAFT') throw new DeveloperError('Only drafts can enter review.', 409);
      await client.query(
        "UPDATE content_versions SET status='IN_REVIEW',updated_at=now() WHERE id=$1",
        [v.id],
      );
    } else if (action === 'approve') {
      if (v.status !== 'IN_REVIEW')
        throw new DeveloperError('Submit this draft for review first.', 409);
      await client.query(
        "UPDATE content_versions SET status='APPROVED',approved_by=$2,approved_at=now(),updated_at=now() WHERE id=$1",
        [v.id, actor.id],
      );
    } else if (action === 'publish') {
      if (v.status !== 'APPROVED')
        throw new DeveloperError('Approval is required before publication.', 409);
      validatePayload(item.rows[0].type, v.payload);
      await client.query(
        "UPDATE content_versions SET status='ARCHIVED',archived_at=now() WHERE content_item_id=$1 AND status='PUBLISHED'",
        [id],
      );
      await client.query(
        "UPDATE content_versions SET status='PUBLISHED',published_at=now(),published_by=$2,updated_at=now() WHERE id=$1",
        [v.id, actor.id],
      );
      await client.query('UPDATE content_items SET updated_by=$2,updated_at=now() WHERE id=$1', [
        id,
        actor.id,
      ]);
    } else if (action === 'archive') {
      await client.query(
        "UPDATE content_versions SET status='ARCHIVED',archived_at=now(),updated_at=now() WHERE id=$1",
        [v.id],
      );
    } else {
      validatePayload(item.rows[0].type, v.payload);
      await client.query(
        "UPDATE content_versions SET status='ARCHIVED',archived_at=now() WHERE content_item_id=$1 AND status IN ('DRAFT','IN_REVIEW','APPROVED')",
        [id],
      );
      await client.query(
        "INSERT INTO content_versions (id,content_item_id,version_number,status,payload,change_summary,created_by,updated_at) VALUES ($1,$2,$3,'DRAFT',$4::jsonb,$5,$6,now())",
        [
          randomUUID(),
          id,
          versions.rows[0].version_number + 1,
          JSON.stringify(v.payload),
          `Restored from version ${v.version_number}`,
          actor.id,
        ],
      );
    }
    await audit(actor.id, `CONTENT_${action.toUpperCase()}`, id, 'success', client);
    return {
      message:
        action === 'rollback'
          ? 'Version restored as a draft for review.'
          : `Content ${action} completed.`,
    };
  });
}

const faqSchema = z
  .object({
    id: z.string().max(120).optional(),
    question: text.max(500),
    answer: text.max(10000),
    categoryId: z.string().max(120).nullable(),
    clientVisible: z.boolean(),
    lock: z.string().max(100).nullable(),
  })
  .strict();
export async function readFaqs() {
  const [faqs, categories] = await Promise.all([
    developerDb.query(
      'SELECT e.id,COALESCE(v.question,e.question) AS question,COALESCE(v.answer,e.answer) AS answer,CASE WHEN v.id IS NOT NULL THEN v.category_id ELSE e.category_id END AS category_id,e.status,e.current_draft_version_id,e.current_published_version_id,CASE WHEN v.id IS NOT NULL THEN v.client_visible ELSE e.client_visible END AS client_visible,e.updated_at::text AS lock FROM support_faq_entries e LEFT JOIN support_faq_versions v ON v.id=e.current_draft_version_id ORDER BY e.updated_at DESC LIMIT 200',
    ),
    developerDb.query(
      'SELECT id,name,status,client_visible FROM support_categories ORDER BY display_order,name',
    ),
  ]);
  return { faqs: faqs.rows, categories: categories.rows };
}
export async function saveFaq(input: unknown, actor: DeveloperActor) {
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success)
    throw new DeveloperError('Check the FAQ question, answer, and category.', 422);
  const d = parsed.data;
  return transaction(async (client) => {
    const id = d.id || randomUUID();
    if (d.categoryId) {
      const category = await client.query(
        "SELECT id FROM support_categories WHERE id=$1 AND status='active'",
        [d.categoryId],
      );
      if (!category.rows[0]) throw new DeveloperError('Choose an active FAQ category.', 422);
    }
    if (d.id) {
      const current = await client.query(
        'SELECT id,updated_at::text AS lock FROM support_faq_entries WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (current.rows[0]?.lock !== d.lock)
        throw new DeveloperError('FAQ changed. Reload before saving.', 409);
      await client.query(
        'UPDATE support_faq_entries SET question=$2,answer=$3,updated_by=$4,updated_at=now() WHERE id=$1',
        [id, d.question, d.answer, actor.id],
      );
    } else
      await client.query(
        'INSERT INTO support_faq_entries (id,question,answer,category_id,client_visible,created_by,updated_by,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6,now())',
        [id, d.question, d.answer, d.categoryId, d.clientVisible, actor.id],
      );
    const version = randomUUID();
    await client.query(
      "UPDATE support_faq_versions SET publication_status='ARCHIVED' WHERE faq_entry_id=$1 AND publication_status='DRAFT'",
      [id],
    );
    await client.query(
      "INSERT INTO support_faq_versions (id,faq_entry_id,question,answer,category_id,client_visible,publication_status,version_number,changed_by) SELECT $1,$2,$3,$4,$5,$6,'DRAFT',COALESCE(max(version_number),0)+1,$7 FROM support_faq_versions WHERE faq_entry_id=$2",
      [version, id, d.question, d.answer, d.categoryId, d.clientVisible, actor.id],
    );
    await client.query('UPDATE support_faq_entries SET current_draft_version_id=$2 WHERE id=$1', [
      id,
      version,
    ]);
    await audit(actor.id, 'FAQ_DRAFT', id, 'success', client);
    return {
      message: 'FAQ draft saved. Existing published answers stay in use.',
    };
  });
}
export async function faqAction(
  id: string,
  lock: string,
  action: 'publish' | 'hide' | 'archive',
  actor: DeveloperActor,
) {
  return transaction(async (client) => {
    const result = await client.query(
      'SELECT *,updated_at::text AS lock FROM support_faq_entries WHERE id=$1 FOR UPDATE',
      [id],
    );
    const faq = result.rows[0];
    if (!faq || faq.lock !== lock)
      throw new DeveloperError('FAQ changed. Reload before continuing.', 409);
    if (action === 'publish') {
      if (!faq.current_draft_version_id)
        throw new DeveloperError('Save a draft before publishing.', 409);
      await client.query(
        "UPDATE support_faq_versions SET publication_status='ARCHIVED' WHERE faq_entry_id=$1 AND publication_status='PUBLISHED'",
        [id],
      );
      await client.query(
        "UPDATE support_faq_versions SET publication_status='PUBLISHED',published_at=now(),approved_at=now(),approved_by=$2,published_by=$2 WHERE id=$1 AND publication_status='DRAFT'",
        [faq.current_draft_version_id, actor.id],
      );
      await client.query(
        "UPDATE support_faq_entries e SET status='published',current_published_version_id=e.current_draft_version_id,current_draft_version_id=NULL,category_id=v.category_id,client_visible=v.client_visible,updated_by=$2,updated_at=now() FROM support_faq_versions v WHERE e.id=$1 AND v.id=e.current_draft_version_id",
        [id, actor.id],
      );
    } else
      await client.query(
        'UPDATE support_faq_entries SET status=$2::"SupportFaqStatus",updated_by=$3,updated_at=now() WHERE id=$1',
        [id, action === 'hide' ? 'hidden' : 'archived', actor.id],
      );
    await audit(actor.id, `FAQ_${action.toUpperCase()}`, id, 'success', client);
    return { message: `FAQ ${action} completed.` };
  });
}
export async function saveFaqCategory(input: unknown, actor: DeveloperActor) {
  const parsed = z
    .object({
      id: z.string().max(120).optional(),
      name: text.max(100),
      status: z.enum(['active', 'hidden', 'archived']),
      clientVisible: z.boolean(),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success) throw new DeveloperError('Invalid category.', 422);
  const d = parsed.data,
    id = d.id || randomUUID(),
    slug = d.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  if (!slug) throw new DeveloperError('Category needs letters or numbers.', 422);
  return transaction(async (client) => {
    if (d.id) {
      const changed = await client.query(
        'UPDATE support_categories SET name=$2,status=$3::"SupportCategoryStatus",client_visible=$4,updated_by=$5,updated_at=now() WHERE id=$1 RETURNING id',
        [id, d.name, d.status, d.clientVisible, actor.id],
      );
      if (!changed.rowCount) throw new DeveloperError('Category not found.', 404);
    } else
      await client.query(
        'INSERT INTO support_categories (id,name,slug,status,client_visible,created_by,updated_by,updated_at) VALUES ($1,$2,$3,$4::"SupportCategoryStatus",$5,$6,$6,now())',
        [id, d.name, slug, d.status, d.clientVisible, actor.id],
      );
    await audit(actor.id, 'FAQ_CATEGORY', id, 'success', client);
    return { message: 'FAQ category saved.' };
  });
}
