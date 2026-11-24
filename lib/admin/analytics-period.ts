import type { AnalyticsBucket, AnalyticsRange, ReportKind } from './analytics-types';

const day = 86400000;
const offset = 8 * 3600000;
const localDay = (timestamp: number) => new Date(timestamp + offset).toISOString().slice(0, 10);
const iso = (timestamp: number) => new Date(timestamp).toISOString();

function periodStart(kind: ReportKind, anchor: number) {
  const date = new Date(anchor + offset);
  const year = date.getUTCFullYear(),
    month = date.getUTCMonth();
  if (kind === 'year') return Date.UTC(year, 0, 1) - offset;
  if (kind === 'quarter') return Date.UTC(year, Math.floor(month / 3) * 3, 1) - offset;
  if (kind === 'month') return Date.UTC(year, month, 1) - offset;
  return Date.UTC(year, month, date.getUTCDate() - ((date.getUTCDay() + 6) % 7)) - offset;
}

function stepPeriod(kind: ReportKind, start: number, direction: number) {
  if (kind === 'week') return start + direction * 7 * day;
  const date = new Date(start + offset);
  const months = kind === 'year' ? 12 : kind === 'quarter' ? 3 : 1;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction * months, 1) - offset;
}

function periodLabel(kind: ReportKind, start: number, end: number) {
  const date = new Date(start);
  if (kind === 'year') return String(new Date(start + offset).getUTCFullYear());
  if (kind === 'quarter') {
    const local = new Date(start + offset);
    return `Q${Math.floor(local.getUTCMonth() / 3) + 1} ${local.getUTCFullYear()}`;
  }
  if (kind === 'month')
    return date.toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'long',
      year: 'numeric',
    });
  const format = (value: number) =>
    new Date(value).toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  return `${format(start)} – ${format(end - 1)}`;
}

export function analyticsPeriod(
  kind: ReportKind,
  anchor: string | undefined,
  now = new Date(),
): {
  range: AnalyticsRange;
  buckets: AnalyticsBucket[];
} {
  const today = localDay(now.getTime());
  const selected = anchor || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selected) || selected < '1900-01-01' || selected > today)
    throw new RangeError('Choose a valid report date from 1900 through today.');
  const parsed = Date.parse(`${selected}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || iso(parsed).slice(0, 10) !== selected)
    throw new RangeError('Choose a valid calendar date.');
  const start = periodStart(kind, parsed - offset);
  const end = stepPeriod(kind, start, 1);
  const through = Math.min(end, now.getTime() + 1);
  const previous = stepPeriod(kind, start, -1);
  const partial = through < end;
  const previousThrough = partial ? Math.min(start, previous + through - start) : start;
  const nextAnchor = localDay(end);
  const range: AnalyticsRange = {
    kind,
    anchor: selected,
    today,
    current: {
      start: iso(start),
      end: iso(end),
      through: iso(through),
      label: periodLabel(kind, start, end),
    },
    comparison: {
      start: iso(previous),
      end: iso(start),
      through: iso(previousThrough),
      label: periodLabel(kind, previous, start),
    },
    partial,
    previousAnchor: localDay(previous),
    nextAnchor,
    canNext: nextAnchor <= today,
    bucketUnit: kind === 'week' ? 'day' : kind === 'month' ? 'seven-day group' : 'month',
  };
  const buckets: AnalyticsBucket[] = [];
  for (let cursor = start; cursor < through;) {
    const date = new Date(cursor + offset);
    const next =
      kind === 'week'
        ? cursor + day
        : kind === 'month'
          ? cursor + 7 * day
          : Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) - offset;
    const bucketEnd = Math.min(next, through);
    const label =
      kind === 'week'
        ? new Date(cursor).toLocaleDateString('en-PH', {
            timeZone: 'Asia/Manila',
            weekday: 'short',
          })
        : kind === 'month'
          ? `${date.getUTCDate()}–${new Date(bucketEnd - 1 + offset).getUTCDate()}`
          : new Date(cursor).toLocaleDateString('en-PH', {
              timeZone: 'Asia/Manila',
              month: 'short',
            });
    buckets.push({
      key: localDay(cursor),
      label,
      start: iso(cursor),
      end: iso(bucketEnd),
      cashCents: 0,
      securedEvents: 0,
      completedEvents: 0,
      requests: 0,
      inquiries: 0,
    });
    cursor = bucketEnd;
  }
  return { range, buckets };
}
