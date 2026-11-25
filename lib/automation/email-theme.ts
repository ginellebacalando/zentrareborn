/**
 * The single source of email colors and fonts. Email clients ignore CSS variables and external
 * stylesheets, so templates inline these literal values. They mirror the ZENTRA palette in
 * styles/tokens.css (--palette-zentra-*) and must be updated together with it.
 */
export const EMAIL_THEME = {
  /** Header wordmark shown above the venue name. */
  wordmark: 'ZENTRA',
  brand: '#03422E',
  background: '#FFFFFF',
  surface: '#F5F8F6',
  text: '#121A17',
  muted: '#4D5A54',
  line: '#D9D9D9',
  onBrand: '#FFFFFF',
  /** --palette-zentra-green-soft: tinted panels, such as the amount on a receipt. */
  brandSoft: '#E7F1EC',
  /** --palette-danger: a voided payment on its receipt. */
  danger: '#A32F35',
  wordmarkFont: "Georgia, 'Times New Roman', serif",
  bodyFont: 'Arial, Helvetica, sans-serif',
} as const;
