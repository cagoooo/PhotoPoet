/**
 * 主題 token 系統
 *
 * 兩個主題：
 *   dark  — 夜空（暗藍底 + 金）  ← 預設
 *   light — 月白（米黃宣紙底 + 墨褐 + 朱印紅）
 *
 * 設計原則：
 * - 所有顏色都以 CSS var 形式 expose 在 :root[data-theme=*]，給 CSS / inline style 共用
 * - `themeTokens.dark` / `themeTokens.light` 同時也匯出原始值，給 canvas 繪圖（poem-image）
 *   等不能用 CSS var 的場景使用
 * - 切換主題只需 set `<html data-theme="light|dark">` attribute
 *
 * 月白配色源自 design handoff 「點亮詩意」的 paper.jsx 風格。
 */

export type ThemeName = 'dark' | 'light';

export interface ThemeColors {
  bg: string;
  bgSoft: string;
  panel: string;
  panelBorder: string;
  divider: string;
  ink: string;
  inkSoft: string;
  inkMute: string;
  inkFaint: string;
  /** 主強調色（夜空：金；月白：暖褐） */
  gold: string;
  /** 高亮輔助（夜空：亮金；月白：朱印紅） */
  goldBright: string;
  /** body 背景漸層 */
  bodyGradient: string;
  /** 星空粒子色（dark）／ 紙質微塵（light） */
  starColor: string;
  starOpacityScale: number;
  /** 主 panel 內推薦的卡片背景（漸層） */
  cardGradient: string;
  /** Hero 大字色 */
  heroInk: string;
  /** poem reveal 字色（result 頁照片底下的詩） */
  poemReveal: string;
  /** TopBar moon icon 渲染 */
  moonGradient: string;
}

export const THEME_TOKENS: Record<ThemeName, ThemeColors> = {
  dark: {
    bg: '#06070d',
    bgSoft: '#10131c',
    panel: 'rgba(232,228,210,0.04)',
    panelBorder: 'rgba(184,154,74,0.25)',
    divider: 'rgba(141,138,120,0.18)',
    ink: '#e7e4d8',
    inkSoft: '#a8a290',
    inkMute: '#8d8a78',
    inkFaint: '#6f6c5e',
    gold: '#b89a4a',
    goldBright: '#f0e4b8',
    bodyGradient: `
      radial-gradient(ellipse 80% 60% at 50% -20%, rgba(40, 55, 100, 0.55), transparent 70%),
      radial-gradient(ellipse 60% 40% at 50% 110%, rgba(184, 154, 74, 0.10), transparent 70%),
      #06070d
    `,
    starColor: '#f0e4b8',
    starOpacityScale: 1,
    cardGradient: 'linear-gradient(135deg, #2a3148, #1c2235)',
    heroInk: '#f0e8c8',
    poemReveal: '#f0e8c8',
    moonGradient: 'radial-gradient(circle at 30% 30%, #f0e4b8, #b89a4a)',
  },
  light: {
    bg: '#efe6d2',
    bgSoft: '#f7f1e1',
    panel: 'rgba(255,250,230,0.55)',
    panelBorder: 'rgba(176,136,88,0.55)',
    divider: 'rgba(176,136,88,0.3)',
    ink: '#3a2a1a',
    inkSoft: '#5a4426',
    inkMute: '#6f4a26',
    inkFaint: '#8a6a3a',
    /** 月白 gold = 深褐墨色（取代金，但同位置語意） */
    gold: '#6f4a26',
    /** 月白 goldBright = 朱印紅（強烈點綴） */
    goldBright: '#b8362c',
    bodyGradient: `
      radial-gradient(ellipse 80% 60% at 50% -20%, rgba(176,136,88,0.18), transparent 70%),
      radial-gradient(ellipse 60% 40% at 50% 110%, rgba(184,54,44,0.06), transparent 70%),
      #efe6d2
    `,
    starColor: '#8a6a3a',
    starOpacityScale: 0.45,
    cardGradient: 'linear-gradient(135deg, #f7f1e1, #ede2c6)',
    heroInk: '#3a2a1a',
    poemReveal: '#3a2a1a',
    moonGradient: 'radial-gradient(circle at 30% 30%, #fff5d8, #b89a4a)',
  },
};

/**
 * Inline-script-friendly snippet that runs BEFORE React hydration to set
 * `data-theme` on the <html> element, avoiding a flash on first paint.
 *
 * Reads localStorage('photopoet-theme'); fallback = matchMedia
 * `prefers-color-scheme: light` → 'light' else 'dark'.
 */
export const THEME_INLINE_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('photopoet-theme');
    var theme = stored;
    if (!theme) {
      var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      theme = prefersLight ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`.trim();

export const THEME_STORAGE_KEY = 'photopoet-theme';
