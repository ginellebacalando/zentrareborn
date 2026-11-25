/**
 * The single source of email colors and fonts. Email clients ignore CSS variables and external
 * stylesheets, so templates inline these literal values. They mirror the ZENTRA palette in
 * styles/tokens.css (--palette-zentra-*, --palette-status-*) and must be updated together with it.
 */
export const EMAIL_THEME = {
  /** The logo's alternative text, and the header itself when the site's address is unknown. */
  wordmark: 'ZENTRA',
  /**
   * The ZENTRA wordmark exactly as the website shows it (770 × 179 pixels), loaded from the
   * site's own address and drawn at half resolution or less so it stays sharp on dense screens.
   */
  logo: { path: '/images/brand/zentra-wordmark.png', width: 156, height: 36 },
  brand: '#03422E',
  background: '#FFFFFF',
  /** --palette-zentra-pearl: the page behind the message card. */
  canvas: '#EEF4F1',
  surface: '#F5F8F6',
  text: '#121A17',
  muted: '#4D5A54',
  line: '#D9D9D9',
  onBrand: '#FFFFFF',
  /** --palette-zentra-green-soft: tinted panels, such as the amount on a receipt. */
  brandSoft: '#E7F1EC',
  /** --palette-danger: a voided payment on its receipt. */
  danger: '#A32F35',
  /** --palette-danger-soft: the panel behind a voided payment's note. */
  dangerSoft: '#FFF0F0',
  /** Status badges in a booking summary: --palette-status-* soft backgrounds with their inks. */
  tones: {
    positive: { background: '#E2F5E7', text: '#135F2A' },
    waiting: { background: '#FFF6CC', text: '#5C4A00' },
    attention: { background: '#FFECD5', text: '#7A4100' },
    negative: { background: '#FDE4E5', text: '#8E1218' },
    neutral: { background: '#EEF4F1', text: '#4D5A54' },
  },
  wordmarkFont: "Georgia, 'Times New Roman', serif",
  /** The reader's own system font, as most modern transactional email uses. */
  bodyFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;

export type EmailTone = keyof typeof EMAIL_THEME.tones;
