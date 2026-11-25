import type { ReactNode } from 'react';

/**
 * Zeni's reply text laid out for reading, without changing a word (docs/design-change-log.md,
 * 26 November 2026). Each line becomes its own paragraph; lines that start with "•", "-" or "1."
 * form a real list; and key facts stand out in bold: a list item's short lead-in label
 * ("Reservation fee:"), peso amounts, and anything a reply wraps in **double asterisks** (the
 * asterisks themselves are never shown).
 */
type Block = { kind: 'p'; text: string } | { kind: 'ul' | 'ol'; items: string[] };

const BULLET = /^[•\-*–]\s+/;
const NUMBERED = /^\d{1,2}[.)]\s+/;
/** Peso amounts: "₱5,000", "₱1,250.50", "PHP 12,000". */
const AMOUNT = /(?:₱\s?|PHP\s)\d[\d,]*(?:\.\d{1,2})?/g;
/** A list item's lead-in label: a few words before the first colon ("60 days before the event:"). */
const LEAD_IN = /^([^:.!?]{2,48}:)(\s)/;

export function readBlocks(message: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of message.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const kind = BULLET.test(line) ? 'ul' : NUMBERED.test(line) ? 'ol' : 'p';
    if (kind === 'p') {
      blocks.push({ kind, text: line });
      continue;
    }
    const text = line.replace(kind === 'ul' ? BULLET : NUMBERED, '');
    const last = blocks.at(-1);
    if (last && last.kind === kind) last.items.push(text);
    else blocks.push({ kind, items: [text] });
  }
  return blocks;
}

/** Bold peso amounts inside plain text. */
function amounts(text: string, key: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let from = 0;
  for (const match of text.matchAll(AMOUNT)) {
    const at = match.index ?? 0;
    if (at > from) parts.push(text.slice(from, at));
    parts.push(<strong key={`${key}-${at}`}>{match[0]}</strong>);
    from = at + match[0].length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
}

/** Text with **marked** phrases and peso amounts in bold. */
function inline(text: string, key: string): ReactNode[] {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .flatMap<ReactNode>((part, index) =>
      index % 2
        ? [<strong key={`${key}-b${index}`}>{part}</strong>]
        : amounts(part, `${key}-${index}`),
    );
}

/** A list item, its lead-in label in bold when it has one. */
function item(text: string, key: string): ReactNode[] {
  const lead = LEAD_IN.exec(text);
  if (!lead || text.startsWith('**')) return inline(text, key);
  const [whole, label, space] = lead;
  return [
    <strong key={`${key}-lead`}>{label}</strong>,
    space,
    ...inline(text.slice(whole.length), key),
  ];
}

export function ZeniText({
  message,
  className,
  prefix,
}: {
  message: string;
  className?: string;
  /** Read before the text by screen readers only, such as "Zeni: ". */
  prefix?: ReactNode;
}) {
  return (
    <div className={className}>
      {prefix}
      {readBlocks(message).map((block, index) => {
        const key = `b${index}`;
        if (block.kind === 'p') return <p key={key}>{inline(block.text, key)}</p>;
        const List = block.kind;
        return (
          <List key={key}>
            {block.items.map((text, itemIndex) => (
              <li key={`${key}-${itemIndex}`}>{item(text, `${key}-${itemIndex}`)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
