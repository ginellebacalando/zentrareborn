import localFont from 'next/font/local';

/*
 * Bundled SIL Open Font License fonts (licenses beside the files). The plan's fonts are
 * SFT Schrifted Sans for all text and Zenitha Classic for the ZENTRA wordmark, but those files are a
 * trial and a personal-use version, so they never enter Git. `npm run fonts:licensed` copies them
 * into the ignored public/fonts/licensed/ folder on a team machine and the root layout links them
 * when present. The faces below are the fallbacks every other build renders (see styles/tokens.css).
 *
 * next/font reads these options at build time, so every value must be an inline literal.
 */

/** Archivo, latin subset: everyday text whenever SFT Schrifted Sans is unavailable. */
export const archivo = localFont({
  src: './archivo-latin-wght-normal.woff2',
  variable: '--font-archivo',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  adjustFontFallback: 'Arial',
});

/**
 * Archivo, latin-ext subset (Fontsource's range): extra characters, including the peso sign
 * (U+20B1) that neither licensed font contains. Browsers download it only when a page uses one
 * of these characters.
 */
export const archivoExtended = localFont({
  src: './archivo-latin-ext-wght-normal.woff2',
  variable: '--font-archivo-ext',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
    },
  ],
});

/**
 * Cinzel Decorative Bold: the ZENTRA wordmark and "Z" monogram when Zenitha Classic is absent. Of
 * the free fonts compared on 25 November 2026 it was the closest to Zenitha (swash Z and R, similar
 * stroke weight). The bold cut is registered as weight 400 because the brand text uses Zenitha's
 * single regular weight. Cinzel has no true lowercase, which suits the uppercase-only brand text.
 */
export const cinzelDecorative = localFont({
  src: './cinzel-decorative-bold.woff2',
  variable: '--font-cinzel-decorative',
  weight: '400',
  style: 'normal',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});
