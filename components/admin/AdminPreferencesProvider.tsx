'use client';
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import useSWR from 'swr';
import {
  DEFAULT_ADMIN_PREFERENCES,
  formatPreferenceDate,
  type AdminPreferences,
  type PreferencesResponse,
} from '@/lib/admin/preferences-types';

type AdminTheme = 'light' | 'dark';

/*
 * The header's theme toggle is a per-browser convenience. It never writes the saved default
 * (Settings > Appearance, super administrators only), so other administrators are unaffected.
 * When storage is unavailable (private windows, blocked site data) the choice lasts for this
 * page view only.
 */
const THEME_KEY = 'zentra-admin-theme';
const themeListeners = new Set<() => void>();
let memoryTheme: AdminTheme | null = null;
function readPersonalTheme(): AdminTheme | null {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return memoryTheme;
  }
}
function subscribePersonalTheme(onChange: () => void) {
  themeListeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    themeListeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}
function writePersonalTheme(theme: AdminTheme | null) {
  memoryTheme = theme;
  try {
    if (theme) window.localStorage.setItem(THEME_KEY, theme);
    else window.localStorage.removeItem(THEME_KEY);
  } catch {
    // Storage is optional; the in-memory value above still applies to this page view.
  }
  themeListeners.forEach((listener) => listener());
}

const PreferencesContext = createContext<{
  settings: AdminPreferences;
  theme: AdminTheme;
  previewTheme: (theme: AdminTheme | null) => void;
  toggleTheme: () => void;
  clearPersonalTheme: () => void;
  refresh: () => Promise<void>;
}>({
  settings: DEFAULT_ADMIN_PREFERENCES,
  theme: 'light',
  previewTheme: () => {},
  toggleTheme: () => {},
  clearPersonalTheme: () => {},
  refresh: async () => {},
});
export function AdminPreferencesProvider({
  initial,
  children,
}: {
  initial: AdminPreferences;
  children: ReactNode;
}) {
  const [preview, setPreview] = useState<AdminTheme | null>(null);
  const personalTheme = useSyncExternalStore(subscribePersonalTheme, readPersonalTheme, () => null);
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
  const toggleTheme = useCallback(() => {
    const next: AdminTheme = theme === 'dark' ? 'light' : 'dark';
    setPreview(null);
    // Matching the saved default clears the override so later default changes still apply.
    writePersonalTheme(next === savedTheme ? null : next);
  }, [theme, savedTheme]);
  const clearPersonalTheme = useCallback(() => writePersonalTheme(null), []);
  return (
    <PreferencesContext.Provider
      value={{
        settings,
        theme,
        previewTheme: setPreview,
        toggleTheme,
        clearPersonalTheme,
        refresh: async () => {
          await mutate();
        },
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
export function useAdminPreferences() {
  return useContext(PreferencesContext);
}
export function useAdminDate() {
  const { settings } = useAdminPreferences();
  return (value: string | Date) => formatPreferenceDate(value, settings.admin.localization);
}
