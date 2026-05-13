"use client";

/**
 * ThemeProvider — 雙主題（dark / light）context、persist、system 偵測。
 *
 * 設計重點：
 * - 真正的 SSR-safe theme 在 layout.tsx 的 head inline script（避免閃爍），
 *   這個 Provider 只負責「執行期切換 + 對外 API」。
 * - hydration 後 sync state 從 <html data-theme> 讀回（SSR 預設是 dark）。
 * - toggle 立即更新 attr + state + localStorage，不等下次 render。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {THEME_STORAGE_KEY, type ThemeName} from '@/lib/theme';

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readDomTheme(): ThemeName {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light'
    ? 'light'
    : 'dark';
}

export function ThemeProvider({children}: {children: ReactNode}) {
  // SSR 時 typeof document === 'undefined' → 'dark'；client 第一次 render 時
  // lazy initializer 會立刻讀真實 DOM attr（已被 head inline script 設好），
  // 確保 ThemeToggle 第一次 paint 顯示正確的 ☾/☀ icon，避免閃爍與點兩次才動的 race。
  const [theme, setThemeState] = useState<ThemeName>(() => readDomTheme());

  // 防呆：mount 後再 sync 一次，處理 SSR 'dark' vs DOM 'light' 的 hydration mismatch
  useEffect(() => {
    const dom = readDomTheme();
    setThemeState(prev => (prev === dom ? prev : dom));
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* 隱私模式忽略 */
      }
    }
  }, []);

  // toggle 永遠以 DOM attr 為真理來源，不依賴 React state — 即使 state 還沒
  // 來得及 sync，按一下也保證會切到「視覺上看起來相反」的主題。
  const toggleTheme = useCallback(() => {
    const next: ThemeName = readDomTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({theme, setTheme, toggleTheme}),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Provider 未掛載 → 給 noop，避免 crash（例如 storybook、測試環境）
    return {
      theme: 'dark',
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}
