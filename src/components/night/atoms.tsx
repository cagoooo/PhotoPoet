"use client";

/**
 * 點亮詩意 — 共用元件層
 * 來源：design handoff 「點亮詩意-Prototype」atoms.jsx
 *
 * 命名沿用 nightTokens（避免 break 既有 import），但實際值已由 CSS var 接到
 * `data-theme` 切換的雙主題系統。修改主題請改 globals.css 與 src/lib/theme.ts。
 */
import {useMemo, type CSSProperties, type ReactNode} from 'react';

export const nightTokens = {
  bg: 'var(--theme-bg)',
  bgSoft: 'var(--theme-bg-soft)',
  panel: 'var(--theme-panel)',
  panelBorder: 'var(--theme-panel-border)',
  divider: 'var(--theme-divider)',
  ink: 'var(--theme-ink)',
  inkSoft: 'var(--theme-ink-soft)',
  inkMute: 'var(--theme-ink-mute)',
  inkFaint: 'var(--theme-ink-faint)',
  gold: 'var(--theme-gold)',
  goldBright: 'var(--theme-gold-bright)',
  /** Hero 大字裡被點亮的字色（夜空：金；月白：朱印紅） */
  heroAccent: 'var(--theme-hero-accent)',
  /** dark = 月亮 cream / light = 朱印紅，poem reveal / hero 大字使用 */
  heroInk: 'var(--theme-hero-ink)',
  serif: 'var(--theme-serif)',
  sans: 'var(--theme-sans)',
  italic: 'var(--theme-italic)',
} as const;

/**
 * 響應式 max-width 外殼，取代 prototype 的 420×920 phone frame。
 *
 * - 預設 (`wide=false`)：手機/平板/桌面都鎖 480px 居中（適合詩牆 / 我的詩 這種 feed 型頁面）。
 * - `wide=true`：>=1024px 改用 1180px 廣域佈局，留給首頁 / 結果頁這種需要兩欄編輯式排版的場景。
 *   className 內含 `night-shell--wide`，可在 globals.css 加 media query 細部微調。
 */
export function NightShell({
  children,
  showStars = true,
  wide = false,
  className,
}: {
  children: ReactNode;
  showStars?: boolean;
  wide?: boolean;
  className?: string;
}) {
  const composedClass = wide
    ? `night-shell night-shell--wide${className ? ` ${className}` : ''}`
    : `night-shell${className ? ` ${className}` : ''}`;
  return (
    <div
      className={composedClass}
      style={{
        position: 'relative',
        width: '100%',
        // 透過 CSS 媒體查詢覆寫；inline 提供 SSR / 未支援 var 環境的 fallback
        maxWidth: 'var(--shell-max-w, 480px)',
        margin: '0 auto',
        minHeight: '100vh',
        color: nightTokens.ink,
        overflow: 'hidden',
      }}
    >
      {showStars && <StarField />}
      {children}
    </div>
  );
}

/** 微微閃爍的星星粒子；月白主題下 opacity scale 自動降低（變紙面微塵） */
export function StarField() {
  const stars = useMemo(
    () =>
      Array.from({length: 28}, (_, i) => ({
        left: (i * 47) % 100,
        top: (i * 73) % 100,
        size: i % 3 === 0 ? 1.5 : 1,
        delay: (i * 0.21) % 3,
        opacity: 0.3 + ((i * 19) % 60) / 100,
      })),
    [],
  );
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        // 月白主題透過 CSS var 自動降低星點 opacity
        opacity: 'var(--theme-star-opacity-scale, 1)',
      }}
    >
      {stars.map((s, i) => (
        <span
          key={i}
          className="star-twinkle"
          style={{
            position: 'absolute',
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: 'var(--theme-star-color)',
            borderRadius: '50%',
            animationDelay: `${s.delay}s`,
            opacity: s.opacity,
          }}
        />
      ))}
    </div>
  );
}

/** 頂部 bar：左邊月亮 + 標題 / 或返回鍵；右邊：rightSlot（詩牆 / 我的詩 / 主題切換 等） */
export function TopBar({
  onBack,
  backLabel,
  rightSlot,
}: {
  onBack?: () => void;
  backLabel?: string;
  rightSlot?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '18px 22px 0',
        position: 'relative',
        zIndex: 5,
        fontSize: 11,
        color: nightTokens.inkMute,
        letterSpacing: 3,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: onBack ? 'pointer' : 'default',
        }}
        onClick={onBack}
      >
        {onBack ? (
          <span
            style={{
              color: nightTokens.gold,
              fontFamily: nightTokens.italic,
              fontStyle: 'italic',
              fontSize: 14,
              letterSpacing: 1,
              whiteSpace: 'nowrap',
            }}
          >
            ← {backLabel || 'back'}
          </span>
        ) : (
          <>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: 'var(--theme-moon-gradient)',
                animation: 'moonPulse 4s ease-in-out infinite',
              }}
            />
            <span
              style={{
                fontFamily: nightTokens.serif,
                fontSize: 12,
                color: nightTokens.ink,
                letterSpacing: 2,
              }}
            >
              點亮詩意
            </span>
          </>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 18,
          fontSize: 10.5,
          letterSpacing: 2,
          alignItems: 'center',
        }}
      >
        {rightSlot}
      </div>
    </div>
  );
}

/** 主 CTA — 金色漸層按鈕 */
export function GoldButton({
  children,
  onClick,
  disabled,
  style,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        background: disabled
          ? 'color-mix(in srgb, var(--theme-gold) 18%, transparent)'
          : 'linear-gradient(180deg, var(--theme-gold) 0%, color-mix(in srgb, var(--theme-gold) 70%, #000) 100%)',
        color: disabled ? 'var(--theme-ink-mute)' : 'var(--theme-bg-soft)',
        border: 0,
        padding: '15px 18px',
        fontFamily: nightTokens.serif,
        fontSize: 16,
        letterSpacing: 8,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled
          ? 'none'
          : '0 0 40px var(--theme-glow), inset 0 1px 0 rgba(255,240,200,0.5)',
        transition: 'all .2s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Outline 次要按鈕 */
export function OutlineButton({
  children,
  onClick,
  disabled,
  style,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: `1px solid ${nightTokens.panelBorder}`,
        color: disabled ? nightTokens.inkMute : nightTokens.ink,
        padding: '11px 14px',
        fontFamily: nightTokens.serif,
        fontSize: 12,
        letterSpacing: 3,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'all .2s',
        ...style,
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.borderColor = 'var(--theme-gold)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--theme-panel-border)';
      }}
    >
      {children}
    </button>
  );
}

/** 帶 corner label 的 panel */
export function Panel({
  label,
  children,
  style,
}: {
  label?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: nightTokens.panel,
        border: `1px solid ${nightTokens.panelBorder}`,
        padding: 14,
        position: 'relative',
        ...style,
      }}
    >
      {label ? (
        <div
          style={{
            position: 'absolute',
            top: -7,
            left: 14,
            background: nightTokens.bgSoft,
            padding: '0 8px',
            fontFamily: nightTokens.italic,
            fontStyle: 'italic',
            fontSize: 11,
            color: nightTokens.gold,
            letterSpacing: 2,
          }}
        >
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** 金色漸層分隔線 */
export function GlowRule({style}: {style?: CSSProperties}) {
  return (
    <div
      style={{
        height: 1,
        background:
          'linear-gradient(90deg, transparent, var(--theme-gold) 30%, var(--theme-gold) 70%, transparent)',
        opacity: 0.4,
        ...style,
      }}
    />
  );
}
