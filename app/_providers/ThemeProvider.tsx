'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
} from 'react';
import { MotionConfig } from 'framer-motion';
import { switchTheme } from '@/lib/theme-switch';
import { DEFAULT_THEME_STORAGE_KEY, THEME_STORAGE_KEY } from './theme-script';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const themeSubscribers = new Set<() => void>();

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  const defaultTheme = window.localStorage.getItem(DEFAULT_THEME_STORAGE_KEY);

  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme;
  }

  return defaultTheme === 'dark' ? 'dark' : 'light';
}

function getServerTheme(): Theme {
  return 'light';
}

function subscribeToTheme(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  themeSubscribers.add(callback);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    themeSubscribers.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}

function notifyThemeSubscribers() {
  themeSubscribers.forEach((callback) => callback());
}

function applyDocumentTheme(theme: Theme) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, getStoredTheme, getServerTheme);

  // The <head> script (theme-script.ts) set the class before the first paint. This keeps it in
  // step afterwards, before paint, and reads storage rather than `theme`, which is still the
  // server's 'light' while hydrating; that avoids a brief light frame on dark pages.
  useLayoutEffect(() => {
    applyDocumentTheme(getStoredTheme());
  }, [theme]);

  useEffect(() => {
    let active = true;

    async function loadDefaultTheme() {
      try {
        const response = await fetch('/api/client/settings', { cache: 'no-store' });
        const payload = (await response.json()) as {
          settings?: {
            appearance?: {
              defaultTheme?: Theme;
            };
          };
        };
        const defaultTheme = payload.settings?.appearance?.defaultTheme;

        if (!active || (defaultTheme !== 'dark' && defaultTheme !== 'light')) {
          return;
        }

        window.localStorage.setItem(DEFAULT_THEME_STORAGE_KEY, defaultTheme);

        if (!window.localStorage.getItem(THEME_STORAGE_KEY)) {
          applyDocumentTheme(defaultTheme);
          notifyThemeSubscribers();
        }
      } catch {
        // Keep the local theme fallback if public settings are unavailable.
      }
    }

    void loadDefaultTheme();

    return () => {
      active = false;
    };
  }, []);

  const toggleTheme = useCallback((newTheme: Theme) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    switchTheme(() => {
      applyDocumentTheme(newTheme);
      notifyThemeSubscribers();
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
