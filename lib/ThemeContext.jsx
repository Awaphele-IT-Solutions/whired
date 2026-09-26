import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { fonts, getType, palettes, radius } from './theme';

const STORAGE_KEY = 'whired.themeMode'; // 'system' | 'light' | 'dark'

const ThemeContext = createContext(null);

// Wraps the app once, near the root. Resolves the person's chosen mode
// ('system' follows the OS appearance and stays live if it changes) against
// the two palettes in ./theme, and persists the choice across launches.
export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('system');
  const [systemScheme, setSystemScheme] = useState(
    Appearance.getColorScheme() || 'dark'
  );

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (mounted && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setModeState(saved);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'dark');
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback((next) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const scheme = mode === 'system' ? systemScheme : mode;
  const isDark = scheme !== 'light';
  const colors = palettes[isDark ? 'dark' : 'light'];

  const value = useMemo(
    () => ({
      mode, // person's preference: 'system' | 'light' | 'dark'
      setMode,
      scheme, // resolved 'dark' | 'light'
      isDark,
      colors,
      fonts,
      radius,
      type: getType(colors),
    }),
    [mode, setMode, scheme, isDark, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be called inside a <ThemeProvider>');
  }
  return ctx;
}
