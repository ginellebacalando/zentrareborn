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
  wordmarkFont: "Georgia, 'Times New Roman', serif",
  bodyFont: 'Arial, Helvetica, sans-serif',
} as const;
