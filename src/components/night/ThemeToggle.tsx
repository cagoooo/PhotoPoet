"use client";

/**
 * ☾ / ☀ 主題切換鍵 — 放在 TopBar rightSlot
 */
import {useTheme} from './ThemeProvider';
import {nightTokens as t} from './atoms';

export function ThemeToggle() {
  const {theme, toggleTheme} = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? '切換月白主題' : '切換暗夜主題'}
      aria-label={isDark ? '切換月白主題' : '切換暗夜主題'}
      style={{
        background: 'transparent',
        border: 0,
        color: t.gold,
        fontSize: 14,
        cursor: 'pointer',
        padding: '2px 4px',
        lineHeight: 1,
        opacity: 0.85,
        transition: 'opacity .2s, transform .3s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.opacity = '1';
        e.currentTarget.style.transform = 'rotate(15deg)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.opacity = '0.85';
        e.currentTarget.style.transform = 'rotate(0)';
      }}
    >
      {isDark ? '☾' : '☀'}
    </button>
  );
}
