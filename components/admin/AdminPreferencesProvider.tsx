'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import useSWR from 'swr';
import {
  ADMIN_THEME_COOKIE,
  DEFAULT_ADMIN_PREFERENCES,
  adminThemeValue,
  formatPreferenceDate,
  formatPreferenceDay,
  formatPreferenceTime,
  timeZoneNote,
  type AdminPreferences,
  type AdminTheme,
  type PreferencesResponse,
} from '@/lib/admin/preferences-types';
import { switchTheme } from '@/lib/theme-switch';

/*
 * The header's theme toggle is a per-browser convenience. It never writes the saved default
 * (Settings > Appearance, super administrators only), so other administrators are unaffected.
 * The choice is a cookie, which the panel layout reads so the first paint already has the right
 * theme, mirrored to localStorage so other open tabs follow. Without cookies (private windows,
 * blocked site data) the choice lasts for this page view only.
 */
const COOKIE_PATTERN = new RegExp(`(?:^|;\\s*)${ADMIN_THEME_COOKIE}=(light|dark)(?:;|$)`);
const themeListeners = new Set<() => void>();
let memoryTheme: AdminTheme | null = null;

function readPersonalTheme(): AdminTheme | null {
  const cookie = adminThemeValue(document.cookie.match(COOKIE_PATTERN)?.[1]);
  return cookie ?? (navigator.cookieEnabled ? null : memoryTheme);
}
function subscribePersonalTheme(onChange: () => void) {
  const fromOtherTab = (event: StorageEvent) => {
    if (event.key === ADMIN_THEME_COOKIE) onChange();
  };
  themeListeners.add(onChange);
  window.addEventListener('storage', fromOtherTab);
  return () => {
    themeListeners.delete(onChange);
    window.removeEventListener('storage', fromOtherTab);
  };
}
function writePersonalTheme(theme: AdminTheme | null) {
  memoryTheme = theme;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ADMIN_THEME_COOKIE}=${theme ?? ''}; Path=/admin; Max-Age=${theme ? 31536000 : 0}; SameSite=Lax${secure}`;
  try {
    if (theme) window.localStorage.setItem(ADMIN_THEME_COOKIE, theme);
    else window.localStorage.removeItem(ADMIN_THEME_COOKIE);
  } catch {
    // Storage only lets other tabs follow; the cookie or the in-memory value still applies here.
  }
  themeListeners.forEach((listener) => listener());
}

const PreferencesContext = createContext<{
  settings: AdminPreferences;
  /** Shows a theme while Settings > Appearance is being edited; null ends the preview. */
  previewTheme: (theme: AdminTheme | null) => void;
  clearPersonalTheme: () => void;
  refresh: () => Promise<void>;
}>({
  settings: DEFAULT_ADMIN_PREFERENCES,
  previewTheme: () => {},
  clearPersonalTheme: () => {},
  refresh: async () => {},
});

/*
 * The theme has its own context: switching it re-renders only the shell and the toggle, not
 * every screen that reads the preferences (that re-render was part of the switch's lag).
 */
const ThemeContext = createContext<{ theme: AdminTheme; toggleTheme: () => void }>({
  theme: 'light',
  toggleTheme: () => {},
});

export function AdminPreferencesProvider({
  initial,
  personalTheme: initialPersonalTheme,
  children,
}: {
  initial: AdminPreferences;
  /** The theme cookie as the server read it, so hydration matches the first paint. */
  personalTheme: AdminTheme | null;
  children: ReactNode;
}) {
  const [preview, setPreview] = useState<AdminTheme | null>(null);
  const personalTheme = useSyncExternalStore(
    subscribePersonalTheme,
    readPersonalTheme,
    () => initialPersonalTheme,
  );
  const { data, mutate } = useSWR<PreferencesResponse>(
    '/api/admin/preferences',
    async (url) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load preferences.');
      return response.json();
    },
    { shouldRetryOnError: false },
  );
  const settings = data?.settings ?? initial;
  const savedTheme = settings.appearance.defaultTheme;
  const theme = preview ?? personalTheme ?? savedTheme;

  // Choices made before the cookie existed were kept only in localStorage; carry them over once.
  useEffect(() => {
    if (readPersonalTheme()) return;
    try {
      const earlier = adminThemeValue(window.localStorage.getItem(ADMIN_THEME_COOKIE));
      if (earlier) writePersonalTheme(earlier);
    } catch {
      // Nothing to carry over.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next: AdminTheme = theme === 'dark' ? 'light' : 'dark';
    switchTheme(() => {
      setPreview(null);
      // Matching the saved default clears the override so later default changes still apply.
      writePersonalTheme(next === savedTheme ? null : next);
    });
  }, [theme, savedTheme]);
  const clearPersonalTheme = useCallback(() => writePersonalTheme(null), []);
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const preferences = useMemo(
    () => ({ settings, previewTheme: setPreview, clearPersonalTheme, refresh }),
    [settings, clearPersonalTheme, refresh],
  );
  const themeValue = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return (
    <PreferencesContext.Provider value={preferences}>
      <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
    </PreferencesContext.Provider>
  );
}
export function useAdminPreferences() {
  return useContext(PreferencesContext);
}
export function useAdminTheme() {
  return useContext(ThemeContext);
}
export function useAdminDate() {
  const { settings } = useAdminPreferences();
  return (value: string | Date) => formatPreferenceDate(value, settings.admin.localization);
}
/** The day, the time and the page's one time-zone line, in the admin's date format. */
export function useAdminDateParts() {
  const { settings } = useAdminPreferences();
  const localization = settings.admin.localization;
  return {
    day: (value: string | Date) => formatPreferenceDay(value, localization),
    time: (value: string | Date) => formatPreferenceTime(value, localization),
    zoneNote: timeZoneNote(localization),
  };
}
