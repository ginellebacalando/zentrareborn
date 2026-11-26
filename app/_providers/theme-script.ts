/** The visitor's own website theme, and the default from Settings > Appearance cached for it. */
export const THEME_STORAGE_KEY = 'zion-theme';
export const DEFAULT_THEME_STORAGE_KEY = 'zion-default-theme';

/**
 * Runs in <head> before the first paint (app/layout.tsx), so a website set to dark never flashes
 * light while React loads. It mirrors getStoredTheme in ThemeProvider.tsx: the visitor's own
 * choice, else the cached default. A first visit still waits for the default from the server.
 */
export const THEME_SCRIPT = `(function(){try{var s=window.localStorage,t=s.getItem('${THEME_STORAGE_KEY}');if(t!=='dark'&&t!=='light')t=s.getItem('${DEFAULT_THEME_STORAGE_KEY}');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})();`;
