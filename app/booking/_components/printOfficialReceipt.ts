import type { DownpaymentDetails } from './BookingPostReviewFlow';
import { formatPhp, type RecommendedPackage } from './packageRecommendations';

import { BRAND } from '@/config/brand';

export interface PrintableReceiptData {
  bookingRef: string;
  issuedAtLabel: string;
  eventType: string;
  packageTier: string;
  guestCount: number;
  eventDateLabel: string;
  budgetRange: string;
  addOns: readonly string[];
  fullName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  facebookAccount: string;
  notes: string;
  selectedRecommendation: RecommendedPackage | null;
  downpayment: DownpaymentDetails;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readToken(name: string): string {
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || 'currentColor';
}

export function printOfficialReceipt(data: PrintableReceiptData): void {
  const tokenNames = [
    '--palette-ink',
    '--palette-white',
    '--palette-paper',
    '--palette-cream',
    '--palette-gold',
    '--palette-gold-ink',
    '--palette-booklet-cover',
  ] as const;

  const rootVars = tokenNames.map((name) => `${name}: ${readToken(name)};`).join('\n      ');
  const logoUrl = new URL(BRAND.logo.src, window.location.origin).href;
  const isCash = data.downpayment.method === 'On-Hand Cash';
  const rec = data.selectedRecommendation;
  const excessTotal = rec ? rec.excessGuests * rec.pkg.excessPaxFee : 0;

  const rowsHtml = [
    `<tr>
      <td class="item-name">${escapeHtml(rec?.pkg.name ?? data.packageTier)}</td>
      <td class="item-detail">${escapeHtml(
        rec ? `${rec.pkg.style} · Base ${rec.pkg.paxIncluded} pax` : 'Selected package style',
      )}</td>
      <td class="item-amount">${rec ? escapeHtml(formatPhp(rec.pkg.price)) : '—'}</td>
    </tr>`,
    rec && rec.excessGuests > 0
      ? `<tr>
          <td class="item-name">Additional Guests</td>
          <td class="item-detail">${rec.excessGuests} pax × ${escapeHtml(formatPhp(rec.pkg.excessPaxFee))}</td>
          <td class="item-amount">${escapeHtml(formatPhp(excessTotal))}</td>
        </tr>`
      : '',
    data.addOns.length > 0
      ? `<tr>
          <td class="item-name">Curated Add-Ons</td>
          <td class="item-detail">${escapeHtml(data.addOns.join(', '))}</td>
          <td class="item-amount muted">Included / Quoted</td>
        </tr>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  const totalsHtml = rec
    ? `<div class="totals-box">
        <div class="total-row">
          <span>Estimated Package Total</span>
          <strong>${escapeHtml(formatPhp(rec.estimatedTotal))}</strong>
        </div>
        <div class="total-row highlight">
          <span>Downpayment Paid (${rec.pkg.downpaymentPercent}%)</span>
          <strong>- ${escapeHtml(formatPhp(rec.downpaymentAmount))}</strong>
        </div>
        <div class="total-row balance">
          <span>Remaining Balance</span>
          <strong>${escapeHtml(formatPhp(rec.remainingBalance))}</strong>
        </div>
      </div>`
    : '';

  const notesHtml = data.notes.trim()
    ? `<section class="notes-card">
        <div class="section-label">Special Requests &amp; Styling Notes</div>
        <p>${escapeHtml(data.notes.trim())}</p>
      </section>`
    : '';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Zion-Events-Receipt-${escapeHtml(data.bookingRef || 'Summary')}</title>
    <style>
      :root {
        ${rootVars}
      }
      @page {
        size: A4 portrait;
        margin: 0;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: var(--palette-ink);
        background: var(--palette-white);
        line-height: 1.45;
        font-size: 12px;
        padding: 12mm;
      }
      .sheet {
        width: 100%;
        border: 1px solid color-mix(in srgb, var(--palette-gold) 45%, transparent);
        border-radius: 14px;
        overflow: hidden;
        background: var(--palette-white);
      }
      .accent-bar {
        height: 8px;
        background: linear-gradient(90deg, var(--palette-gold), var(--palette-booklet-cover), var(--palette-gold));
      }
      .masthead {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        padding: 20px 24px;
        background: var(--palette-paper);
        border-bottom: 1px solid color-mix(in srgb, var(--palette-gold) 30%, transparent);
      }
      .brand-block {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .logo-frame {
        width: 76px;
        height: 54px;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .logo-frame img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        mix-blend-mode: multiply;
      }
      .kicker {
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--palette-gold-ink);
      }
      .brand-title {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 22px;
        font-weight: 600;
        color: var(--palette-ink);
        margin-top: 2px;
        line-height: 1.15;
      }
      .brand-meta {
        font-size: 10.5px;
        color: color-mix(in srgb, var(--palette-ink) 68%, transparent);
        margin-top: 3px;
      }
      .receipt-meta {
        text-align: right;
        background: var(--palette-white);
        border: 1px solid color-mix(in srgb, var(--palette-gold) 30%, transparent);
        border-radius: 10px;
        padding: 10px 14px;
        min-width: 195px;
      }
      .status-pill {
        display: inline-block;
        background: color-mix(in srgb, var(--palette-booklet-cover) 55%, var(--palette-white));
        color: var(--palette-ink);
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        padding: 4px 10px;
        border-radius: 999px;
      }
      .ref-code {
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.06em;
        margin-top: 6px;
      }
      .issued-at {
        font-size: 10px;
        color: color-mix(in srgb, var(--palette-ink) 62%, transparent);
        margin-top: 2px;
      }
      .body {
        padding: 20px 24px 22px;
      }
      .two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        margin-bottom: 18px;
      }
      .info-card {
        background: var(--palette-paper);
        border: 1px solid color-mix(in srgb, var(--palette-gold) 25%, transparent);
        border-radius: 10px;
        padding: 12px 14px;
      }
      .section-label {
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--palette-gold-ink);
        margin-bottom: 8px;
      }
      .kv-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 3px 0;
        font-size: 11.5px;
      }
      .kv-row span {
        color: color-mix(in srgb, var(--palette-ink) 62%, transparent);
        flex-shrink: 0;
      }
      .kv-row strong {
        text-align: right;
        font-weight: 600;
        word-break: break-word;
      }
      .ledger-wrap {
        border: 1px solid color-mix(in srgb, var(--palette-gold) 30%, transparent);
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 16px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      thead th {
        background: var(--palette-cream);
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: color-mix(in srgb, var(--palette-ink) 78%, transparent);
        padding: 9px 14px;
        text-align: left;
        border-bottom: 1px solid color-mix(in srgb, var(--palette-gold) 25%, transparent);
      }
      thead th.right,
      td.item-amount {
        text-align: right;
      }
      tbody td {
        padding: 10px 14px;
        font-size: 11.5px;
        border-bottom: 1px solid color-mix(in srgb, var(--palette-gold) 18%, transparent);
      }
      td.item-name {
        font-weight: 600;
      }
      td.item-detail {
        color: color-mix(in srgb, var(--palette-ink) 70%, transparent);
      }
      td.item-amount {
        font-weight: 600;
        white-space: nowrap;
      }
      td.muted {
        color: color-mix(in srgb, var(--palette-ink) 62%, transparent);
        font-weight: 500;
      }
      .totals-box {
        background: var(--palette-paper);
        padding: 12px 14px;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        max-width: 300px;
        margin-left: auto;
        padding: 4px 8px;
        font-size: 11.5px;
      }
      .total-row.highlight {
        background: color-mix(in srgb, var(--palette-booklet-cover) 45%, var(--palette-white));
        border-radius: 8px;
        padding: 7px 10px;
        margin-top: 4px;
        margin-bottom: 4px;
        font-weight: 700;
      }
      .total-row.balance {
        border-top: 1px solid color-mix(in srgb, var(--palette-gold) 35%, transparent);
        padding-top: 7px;
        font-size: 13px;
        font-weight: 700;
      }
      .payment-strip {
        background: var(--palette-cream);
        border: 1px solid color-mix(in srgb, var(--palette-gold) 30%, transparent);
        border-radius: 10px;
        padding: 12px 14px;
        margin-bottom: 14px;
      }
      .payment-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }
      .payment-cell span {
        display: block;
        font-size: 9.5px;
        color: color-mix(in srgb, var(--palette-ink) 62%, transparent);
      }
      .payment-cell strong {
        display: block;
        font-size: 11.5px;
        margin-top: 2px;
        word-break: break-word;
      }
      .notes-card {
        background: var(--palette-paper);
        border: 1px solid color-mix(in srgb, var(--palette-gold) 25%, transparent);
        border-radius: 10px;
        padding: 10px 14px;
        margin-bottom: 14px;
        font-size: 11px;
      }
      .footer {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 16px;
        border-top: 1px dashed color-mix(in srgb, var(--palette-gold) 45%, transparent);
        padding-top: 12px;
        font-size: 10px;
        color: color-mix(in srgb, var(--palette-ink) 65%, transparent);
      }
      .footer-sign {
        text-align: right;
        flex-shrink: 0;
      }
      .footer-sign strong {
        display: block;
        color: var(--palette-ink);
        font-size: 11px;
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <div class="accent-bar"></div>
      <header class="masthead">
        <div class="brand-block">
          <div class="logo-frame">
            <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(BRAND.logo.alt)}" />
          </div>
          <div>
            <div class="kicker">Official Booking &amp; Downpayment Receipt</div>
            <h1 class="brand-title">${escapeHtml(BRAND.legalName)}</h1>
            <p class="brand-meta">${escapeHtml(BRAND.address.lines.join(', '))}</p>
            <p class="brand-meta">${escapeHtml(BRAND.contact.email)} · ${escapeHtml(BRAND.contact.phone)}</p>
          </div>
        </div>
        <div class="receipt-meta">
          <span class="status-pill">Downpayment Submitted</span>
          <div class="ref-code">${escapeHtml(data.bookingRef)}</div>
          <div class="issued-at">Issued: ${escapeHtml(data.issuedAtLabel)}</div>
        </div>
      </header>

      <div class="body">
        <section class="two-col">
          <div class="info-card">
            <div class="section-label">Client Details</div>
            <div class="kv-row"><span>Client Name</span><strong>${escapeHtml(data.fullName)}</strong></div>
            <div class="kv-row"><span>Email</span><strong>${escapeHtml(data.email)}</strong></div>
            <div class="kv-row"><span>Mobile</span><strong>${escapeHtml(`${data.countryCode} ${data.phoneNumber}`)}</strong></div>
            <div class="kv-row"><span>Facebook</span><strong>${escapeHtml(data.facebookAccount)}</strong></div>
          </div>

          <div class="info-card">
            <div class="section-label">Event Reservation</div>
            <div class="kv-row"><span>Celebration</span><strong>${escapeHtml(data.eventType)}</strong></div>
            <div class="kv-row"><span>Secured Date</span><strong>${escapeHtml(data.eventDateLabel)}</strong></div>
            <div class="kv-row"><span>Guests</span><strong>${data.guestCount} pax (Full Day)</strong></div>
            <div class="kv-row"><span>Budget Range</span><strong>${escapeHtml(data.budgetRange)}</strong></div>
          </div>
        </section>

        <div class="section-label">Itemized Package &amp; Payment Summary</div>
        <section class="ledger-wrap">
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Details</th>
                <th class="right">Amount</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          ${totalsHtml}
        </section>

        <section class="payment-strip">
          <div class="section-label">Downpayment &amp; Payment Verification · Pending Admin Verification</div>
          <div class="payment-grid">
            <div class="payment-cell"><span>Payment Channel</span><strong>${escapeHtml(data.downpayment.method)}</strong></div>
            <div class="payment-cell"><span>${isCash ? 'Payer Name' : 'Sender Name'}</span><strong>${escapeHtml(data.downpayment.senderName)}</strong></div>
            <div class="payment-cell"><span>${isCash ? 'Official Receipt No.' : 'Reference No.'}</span><strong>${escapeHtml(data.downpayment.referenceNumber)}</strong></div>
            <div class="payment-cell"><span>Attached Proof</span><strong>${escapeHtml(data.downpayment.receiptFileName || 'None attached')}</strong></div>
          </div>
        </section>

        ${notesHtml}

        <footer class="footer">
          <p>
            This official receipt records your submitted event reservation and downpayment for
            ${escapeHtml(BRAND.legalName)}. Your exclusive date lock is finalized upon payment
            verification by our administration team.
          </p>
          <div class="footer-sign">
            <strong>${escapeHtml(BRAND.legalName)} · Booking Desk</strong>
            <span>${escapeHtml(data.bookingRef)}</span>
          </div>
        </footer>
      </div>
    </main>
  </body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1000);
  };

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      cleanup();
      return;
    }
    const previousTitle = document.title;
    document.title = `Zion-Events-Receipt-${data.bookingRef || 'Summary'}`;
    frameWindow.focus();
    frameWindow.print();
    window.setTimeout(() => {
      document.title = previousTitle;
      cleanup();
    }, 400);
  };

  document.body.appendChild(iframe);
  const frameDoc = iframe.contentDocument;
  if (frameDoc) {
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
  } else {
    cleanup();
  }
}
