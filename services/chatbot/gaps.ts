import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { redactPersonalData } from '@/lib/chatbot/redaction';
import { zeniLanguages, type ZeniLanguage } from '@/lib/chatbot/language';
import type { ZeniGap } from '@/lib/chatbot/receptionist';
import type { ZeniGapGroup, ZeniGapReasonLabel } from '@/lib/chatbot/admin-types';
import { receptionistPool } from './state-store';

/** Unanswered questions are kept for staff review, redacted, for at most this long. */
export const GAP_RETENTION_DAYS = 180;
const REASONS: readonly ZeniGapReasonLabel[] = [
  'no_source',
  'low_confidence',
  'handoff',
  'conflict',
];

type Queryable = Pick<pg.Pool, 'query'>;

export function normalizeGapQuestion(question: string) {
  return question
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}[\]\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/** Similar wording ("Is parking free?" / "is parking free") groups under one hash. */
export function gapQuestionHash(question: string) {
  return createHash('sha256').update(normalizeGapQuestion(question)).digest('hex');
}

function missingTable(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42P01');
}

/** Best-effort log; a failure never interrupts the guest's conversation. */
export async function recordZeniGap(
  gap: ZeniGap & { language: ZeniLanguage },
  db: Queryable = receptionistPool,
) {
  const question = redactPersonalData(gap.question, { maxLength: 300 }).trim();
  if (!question || !REASONS.includes(gap.reason)) return;
  await db.query(
    `DELETE FROM zion_zeni_gaps WHERE created_at < now() - interval '${GAP_RETENTION_DAYS} days'`,
  );
  await db.query(
    'INSERT INTO zion_zeni_gaps (id,question,question_hash,topic,language,reason) VALUES ($1,$2,$3,$4,$5,$6)',
    [
      randomUUID(),
      question,
      gapQuestionHash(question),
      gap.topic.slice(0, 40),
      zeniLanguages.includes(gap.language) ? gap.language : 'en',
      gap.reason,
    ],
  );
}

type GroupRow = {
  question_hash: string;
  question: string;
  topic: string;
  language: string;
  reasons: string[];
  count: number;
  first_asked: Date;
  last_asked: Date;
};

export async function listOpenZeniGaps(
  limit = 50,
  db: Queryable = receptionistPool,
): Promise<{ available: boolean; open: ZeniGapGroup[]; resolvedLast30Days: number }> {
  try {
    const [groups, resolved] = await Promise.all([
      db.query<GroupRow>(
        `SELECT question_hash,
          (array_agg(question ORDER BY created_at DESC))[1] AS question,
          (array_agg(topic ORDER BY created_at DESC))[1] AS topic,
          (array_agg(language ORDER BY created_at DESC))[1] AS language,
          array_agg(DISTINCT reason) AS reasons,
          count(*)::int AS count,
          min(created_at) AS first_asked,
          max(created_at) AS last_asked
        FROM zion_zeni_gaps WHERE resolved_at IS NULL
        GROUP BY question_hash ORDER BY count(*) DESC, max(created_at) DESC LIMIT $1`,
        [Math.min(Math.max(1, Math.trunc(limit)), 200)],
      ),
      db.query<{ count: number }>(
        "SELECT count(DISTINCT question_hash)::int AS count FROM zion_zeni_gaps WHERE resolved_at > now() - interval '30 days'",
      ),
    ]);
    return {
      available: true,
      open: groups.rows.map((row) => ({
        hash: row.question_hash,
        question: row.question,
        topic: row.topic,
        language: zeniLanguages.includes(row.language as ZeniLanguage)
          ? (row.language as ZeniLanguage)
          : 'en',
        reasons: row.reasons.filter((reason): reason is ZeniGapReasonLabel =>
          REASONS.includes(reason as ZeniGapReasonLabel),
        ),
        count: Number(row.count),
        firstAsked: new Date(row.first_asked).toISOString(),
        lastAsked: new Date(row.last_asked).toISOString(),
      })),
      resolvedLast30Days: Number(resolved.rows[0]?.count ?? 0),
    };
  } catch (error) {
    if (missingTable(error)) return { available: false, open: [], resolvedLast30Days: 0 };
    throw error;
  }
}

/** Marks every open occurrence of one grouped question as resolved. */
export async function resolveZeniGapGroup(
  hash: string,
  resolvedBy: string,
  db: Queryable = receptionistPool,
) {
  const result = await db.query(
    'UPDATE zion_zeni_gaps SET resolved_at=now(), resolved_by=$2 WHERE question_hash=$1 AND resolved_at IS NULL',
    [hash, resolvedBy.slice(0, 180)],
  );
  return result.rowCount ?? 0;
}
