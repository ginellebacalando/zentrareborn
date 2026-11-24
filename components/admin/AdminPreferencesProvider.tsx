'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import {
  DEFAULT_ADMIN_PREFERENCES,
  formatPreferenceDate,
  type AdminPreferences,
  type PreferencesResponse,
} from '@/lib/admin/preferences-types';

const PreferencesContext = createContext<{
  settings: AdminPreferences;
  theme: 'light' | 'dark';
  previewTheme: (theme: 'light' | 'dark' | null) => void;
  refresh: () => Promise<void>;
}>({
  settings: DEFAULT_ADMIN_PREFERENCES,
  theme: 'light' as 'light' | 'dark',
  previewTheme: () => {},
  refresh: async () => {},
});
export function AdminPreferencesProvider({
  initial,
  children,
}: {
  initial: AdminPreferences;
  children: ReactNode;
}) {
  const [preview, setPreview] = useState<'light' | 'dark' | null>(null);
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
  return (
    <PreferencesContext.Provider
      value={{
        settings,
        theme: preview ?? settings.appearance.defaultTheme,
        previewTheme: setPreview,
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
