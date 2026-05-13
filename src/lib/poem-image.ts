/**
 * 把照片 + 詩合成不同尺寸版型的 PNG/JPEG dataURL，主題感應（夜空 / 月白）。
 *
 * 7 種版型：
 *   embed       — 詩烙印在原圖右下（沿用照片 ratio，朝向「LINE 妙用長輩圖」場景）
 *   sidebar     — 1200×600 圖左詩右
 *   story       — 1080×1920 直立 IG Story（上圖下詩）
 *   wallpaper   — 1920×1080 桌布（全圖背景 + 半透明面板）
 *   square      — 1080×1080 IG Post
 *   line-square — 1040×1040 LINE 群組 / 對話分享主力
 *   postcard    — 1500×2100 (5×7) 紙本明信片風（直式）
 *
 * 兩個主題：
 *   dark  — 夜空風（暗藍底 + 金色 serif + 月亮印章）
 *   light — 月白風（米黃宣紙底 + 墨褐 serif + 朱印紅印章）
 *
 * 設計原則：
 * - 一律 monochrome poem text（不再用彩虹色），藍金 / 墨褐由主題決定
 * - serif 字 (Noto Serif TC fallback Songti TC fallback Microsoft JhengHei)
 * - 每張卡都有右下「點亮詩意」金/朱印章 + 簽名
 *
 * 輸入照片是 base64 dataURL；輸出統一 dataURL（embed = JPEG，其餘 PNG）。
 */

import type {ThemeName} from './theme';

export type PoemFormat =
  | 'embed'
  | 'sidebar'
  | 'story'
  | 'wallpaper'
  | 'square'
  | 'line-square'
  | 'postcard';

interface CardPalette {
  /** 整張卡的主底色 */
  bg: string;
  /** 漸層另一端 */
  bgGradientStop: string;
  /** 文字主色（poem reveal） */
  ink: string;
  /** 文字次要色（footer / metadata） */
  inkSoft: string;
  /** 強調色（金 / 墨褐） */
  gold: string;
  /** 高亮色（亮金 / 朱印紅） */
  goldBright: string;
  /** 半透明面板背景（疊在照片上） */
  panel: string;
  /** 面板邊框 */
  panelBorder: string;
  /** 詩文 stroke / shadow color */
  poemShadow: string;
  /** 是否在 dark 主題（用來決定要不要畫星空背景） */
  isDark: boolean;
}

const PALETTES: Record<ThemeName, CardPalette> = {
  dark: {
    bg: '#06070d',
    bgGradientStop: '#1c2235',
    ink: '#f0e8c8',
    inkSoft: '#a8a290',
    gold: '#b89a4a',
    goldBright: '#f0e4b8',
    panel: 'rgba(10, 12, 20, 0.65)',
    panelBorder: 'rgba(184, 154, 74, 0.45)',
    poemShadow: 'rgba(0, 0, 0, 0.7)',
    isDark: true,
  },
  light: {
    bg: '#efe6d2',
    bgGradientStop: '#f7f1e1',
    ink: '#3a2a1a',
    inkSoft: '#5a4426',
    gold: '#6f4a26',
    goldBright: '#b8362c',
    panel: 'rgba(247, 241, 225, 0.92)',
    panelBorder: '#b08858',
    poemShadow: 'rgba(255, 250, 230, 0.85)',
    isDark: false,
  },
};

// 中文字優先序：next/font 預載的 Noto Serif TC → 系統 Songti TC → 微軟正黑 → fallback
const SERIF_STACK = `'Noto Serif TC', 'Songti TC', 'PingFang TC', 'Microsoft JhengHei', serif`;
const SANS_STACK = `'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif`;
const ITALIC_STACK = `'Cormorant Garamond', 'EB Garamond', Georgia, serif`;

interface RenderOptions {
  isMobile?: boolean;
  /** 主題；預設 dark */
  theme?: ThemeName;
}

export async function renderPoemImage(
  photoDataUrl: string,
  poem: string,
  format: PoemFormat,
  opts: RenderOptions = {},
): Promise<string> {
  const img = await loadImage(photoDataUrl);
  const palette = PALETTES[opts.theme || 'dark'];
  switch (format) {
    case 'embed':
      return renderEmbed(img, poem, palette, opts);
    case 'sidebar':
      return renderSidebar(img, poem, palette);
    case 'story':
      return renderStory(img, poem, palette);
    case 'wallpaper':
      return renderWallpaper(img, poem, palette);
    case 'square':
      return renderSquare(img, poem, palette, 1080);
    case 'line-square':
      return renderSquare(img, poem, palette, 1040);
    case 'postcard':
      return renderPostcard(img, poem, palette);
    default:
      throw new Error(`未知版型 ${format}`);
  }
}

// ────────────────────────────────────────────────────────────────────
// 共用工具
// ────────────────────────────────────────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法建立畫布');
  return {canvas, ctx};
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height;
  if (ir > dr) {
    sw = img.height * dr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / dr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 散落星空背景（dark only），給卡片底層加氣氛 */
function drawStarField(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: CardPalette,
  count = 36,
) {
  if (!palette.isDark) return;
  ctx.save();
  ctx.fillStyle = palette.goldBright;
  for (let i = 0; i < count; i++) {
    const x = (i * 137) % w;
    const y = (i * 83) % h;
    const size = i % 5 === 0 ? 2 : 1;
    const op = 0.2 + ((i * 11) % 50) / 100;
    ctx.globalAlpha = op;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 月亮 logo（小尺寸） + 「點亮詩意」字 — 卡片頂部 */
function drawHeader(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: CardPalette,
  scale = 1,
) {
  const moonR = 8 * scale;
  // 月亮（圓 + radial）
  const grad = ctx.createRadialGradient(
    x - moonR * 0.3,
    y - moonR * 0.3,
    moonR * 0.2,
    x,
    y,
    moonR,
  );
  grad.addColorStop(0, palette.goldBright);
  grad.addColorStop(1, palette.gold);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, moonR, 0, Math.PI * 2);
  ctx.fill();
  // 文字
  ctx.fillStyle = palette.ink;
  ctx.font = `${14 * scale}px ${SERIF_STACK}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('點亮詩意', x + moonR + 8 * scale, y);
}

/** 朱印 / 月印章 — 卡片右下角的詩意標記 */
function drawSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  palette: CardPalette,
  size = 64,
) {
  ctx.save();
  // 印章背景
  if (palette.isDark) {
    // dark：金色月圓
    const g = ctx.createRadialGradient(
      cx - size * 0.2,
      cy - size * 0.2,
      size * 0.1,
      cx,
      cy,
      size / 2,
    );
    g.addColorStop(0, palette.goldBright);
    g.addColorStop(1, palette.gold);
    ctx.fillStyle = g;
  } else {
    // light：朱印紅方塊
    ctx.fillStyle = palette.goldBright;
  }
  if (palette.isDark) {
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 月白用方印
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
  }
  // 印章內字「詩」
  ctx.fillStyle = palette.isDark ? '#10131c' : '#fff5e8';
  ctx.font = `bold ${size * 0.55}px ${SERIF_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('詩', cx, cy + size * 0.02);
  ctx.restore();
}

/** 雙線分隔線 + 中央 ✦ */
function drawDivider(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  palette: CardPalette,
) {
  ctx.save();
  ctx.strokeStyle = palette.gold;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo((x1 + x2) / 2 - 18, y);
  ctx.moveTo((x1 + x2) / 2 + 18, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.gold;
  ctx.font = `14px ${SERIF_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', (x1 + x2) / 2, y);
  ctx.restore();
}

/** 詩文繪製 — monochrome + 微 stroke shadow，可選直書 */
function drawPoemLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  cx: number,
  topY: number,
  fontSize: number,
  lineHeight: number,
  palette: CardPalette,
  opts: {strokeWidth?: number; align?: CanvasTextAlign} = {},
) {
  const {strokeWidth = 0, align = 'center'} = opts;
  ctx.font = `${fontSize}px ${SERIF_STACK}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (strokeWidth > 0) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = palette.poemShadow;
    ctx.lineJoin = 'round';
  }
  for (let i = 0; i < lines.length; i++) {
    const y = topY + i * lineHeight + lineHeight / 2;
    if (strokeWidth > 0) ctx.strokeText(lines[i], cx, y);
    ctx.fillStyle = palette.ink;
    ctx.fillText(lines[i], cx, y);
  }
}

// ────────────────────────────────────────────────────────────────────
// 1) embed — 沿用照片 ratio，詩烙印右下，加微暗漸層讓字浮起來
// ────────────────────────────────────────────────────────────────────
function renderEmbed(
  img: HTMLImageElement,
  poem: string,
  palette: CardPalette,
  opts: RenderOptions,
): string {
  const {canvas, ctx} = makeCanvas(img.width, img.height);
  ctx.drawImage(img, 0, 0, img.width, img.height);

  // 底部漸層 — 讓詩文浮起
  const grad = ctx.createLinearGradient(0, img.height * 0.55, 0, img.height);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, palette.isDark ? 'rgba(6,7,13,0.85)' : 'rgba(0,0,0,0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, img.height * 0.55, img.width, img.height * 0.45);

  // 詩文：靠右下
  const lines = poem.split('\n');
  const fontSize = Math.max(22, Math.min(img.width / 16, img.height / 16));
  const lineHeight = fontSize * 1.4;
  const padding = Math.max(20, img.width * 0.025);

  ctx.font = `${fontSize}px ${SERIF_STACK}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = opts.isMobile ? 8 : 6;
  ctx.strokeStyle = palette.poemShadow;
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#f0e8c8'; // embed 永遠用 cream 字色 — 印在照片上不論主題

  let y = img.height - padding;
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.strokeText(lines[i], img.width - padding, y);
    ctx.fillText(lines[i], img.width - padding, y);
    y -= lineHeight;
  }

  // 右下小印章
  drawSeal(
    ctx,
    img.width - padding - 30,
    padding + 30,
    palette,
    Math.max(48, img.width / 28),
  );

  return canvas.toDataURL('image/jpeg', opts.isMobile ? 0.78 : 0.92);
}

// ────────────────────────────────────────────────────────────────────
// 2) sidebar — 1200×600，圖左詩右
// ────────────────────────────────────────────────────────────────────
function renderSidebar(img: HTMLImageElement, poem: string, palette: CardPalette): string {
  const W = 1200;
  const H = 600;
  const {canvas, ctx} = makeCanvas(W, H);

  // 背景漸層
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, palette.bgGradientStop);
  bg.addColorStop(1, palette.bg);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawStarField(ctx, W, H, palette, 32);

  // 左側照片區（cover 滿版到 50% 寬）
  const photoW = Math.round(W * 0.5);
  drawCover(ctx, img, 0, 0, photoW, H);

  // 照片邊：金邊
  ctx.strokeStyle = palette.gold;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, photoW - 2, H - 2);
  ctx.globalAlpha = 1;

  // 右側詩文區
  const rightX = photoW;
  const rightW = W - photoW;
  const rightCx = rightX + rightW / 2;

  // header
  drawHeader(ctx, rightX + 40, 50, palette, 1.2);

  // 詩文居中
  const lines = poem.split('\n');
  const fontSize = lines.length > 6 ? 36 : 44;
  const lineHeight = fontSize * 1.6;
  const totalH = lines.length * lineHeight;
  const startY = (H - totalH) / 2 - 20;
  drawPoemLines(ctx, lines, rightCx, startY, fontSize, lineHeight, palette, {strokeWidth: 0});

  // 分隔線 + footer
  drawDivider(ctx, rightX + 60, W - 60, H - 60, palette);
  ctx.fillStyle = palette.inkSoft;
  ctx.font = `italic 14px ${ITALIC_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('a verse from a photograph', rightCx, H - 30);

  // 印章右下
  drawSeal(ctx, W - 60, H - 100, palette, 56);

  return canvas.toDataURL('image/png');
}

// ────────────────────────────────────────────────────────────────────
// 3) story — 1080×1920 IG Story（上圖下詩）
// ────────────────────────────────────────────────────────────────────
function renderStory(img: HTMLImageElement, poem: string, palette: CardPalette): string {
  const W = 1080;
  const H = 1920;
  const {canvas, ctx} = makeCanvas(W, H);

  // 全螢幕底色
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);
  drawStarField(ctx, W, H, palette, 60);

  // 上半 55% 圖（cover）
  const photoH = Math.round(H * 0.55);
  drawCover(ctx, img, 0, 0, W, photoH);

  // 圖底漸層淡入背景
  const fade = ctx.createLinearGradient(0, photoH - 200, 0, photoH + 100);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, palette.bg);
  ctx.fillStyle = fade;
  ctx.fillRect(0, photoH - 200, W, 300);

  // header in top-left over photo
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  drawHeader(ctx, 50, 60, palette, 1.5);
  ctx.restore();

  // 詩文
  const lines = poem.split('\n');
  const fontSize = lines.length > 6 ? 56 : 70;
  const lineHeight = fontSize * 1.6;
  const totalH = lines.length * lineHeight;
  const poemArea = H - photoH - 200;
  const startY = photoH + (poemArea - totalH) / 2;
  drawPoemLines(ctx, lines, W / 2, startY, fontSize, lineHeight, palette);

  // 分隔線
  drawDivider(ctx, 240, W - 240, H - 160, palette);

  // footer
  ctx.fillStyle = palette.inkSoft;
  ctx.font = `italic 28px ${ITALIC_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('by night, a verse', W / 2, H - 110);
  ctx.fillStyle = palette.gold;
  ctx.font = `22px ${SERIF_STACK}`;
  ctx.fillText('點亮詩意 · cagoooo.github.io/PhotoPoet', W / 2, H - 70);

  // 右下印章
  drawSeal(ctx, W - 100, H - 280, palette, 96);

  return canvas.toDataURL('image/png');
}

// ────────────────────────────────────────────────────────────────────
// 4) wallpaper — 1920×1080 桌布（全圖背景 + 半透明面板）
// ────────────────────────────────────────────────────────────────────
function renderWallpaper(img: HTMLImageElement, poem: string, palette: CardPalette): string {
  const W = 1920;
  const H = 1080;
  const {canvas, ctx} = makeCanvas(W, H);

  drawCover(ctx, img, 0, 0, W, H);

  // 全圖暗化（dark）/ 提亮（light）
  ctx.fillStyle = palette.isDark ? 'rgba(6,7,13,0.35)' : 'rgba(255,250,230,0.15)';
  ctx.fillRect(0, 0, W, H);

  // 詩文面板（右側 1/2）
  const lines = poem.split('\n');
  const fontSize = lines.length > 6 ? 38 : 46;
  const lineHeight = fontSize * 1.55;

  ctx.font = `${fontSize}px ${SERIF_STACK}`;
  let maxLineW = 0;
  for (const line of lines) {
    const m = ctx.measureText(line);
    if (m.width > maxLineW) maxLineW = m.width;
  }

  const padX = 60;
  const padY = 50;
  const panelW = Math.min(W * 0.55, maxLineW + padX * 2 + 20);
  const panelH = lines.length * lineHeight + padY * 2 + 60;
  const panelX = W - panelW - 80;
  const panelY = (H - panelH) / 2;

  // 半透明面板 + 圓角 + 金邊
  ctx.fillStyle = palette.panel;
  roundRectPath(ctx, panelX, panelY, panelW, panelH, 16);
  ctx.fill();
  ctx.strokeStyle = palette.panelBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // header inside panel top
  drawHeader(ctx, panelX + padX, panelY + 40, palette, 1.1);

  // 詩文
  const startY = panelY + padY + 40;
  drawPoemLines(
    ctx,
    lines,
    panelX + panelW / 2,
    startY,
    fontSize,
    lineHeight,
    palette,
    {strokeWidth: 0},
  );

  // 印章右下角面板內
  drawSeal(ctx, panelX + panelW - 40, panelY + panelH - 40, palette, 50);

  return canvas.toDataURL('image/png');
}

// ────────────────────────────────────────────────────────────────────
// 5/6) square / line-square — 上圖下詩
// ────────────────────────────────────────────────────────────────────
function renderSquare(
  img: HTMLImageElement,
  poem: string,
  palette: CardPalette,
  size: number,
): string {
  const W = size;
  const H = size;
  const {canvas, ctx} = makeCanvas(W, H);

  // 背景
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);
  drawStarField(ctx, W, H, palette, 32);

  // 上 60% 圖
  const photoH = Math.round(H * 0.6);
  drawCover(ctx, img, 0, 0, W, photoH);

  // 圖底淡入
  const fade = ctx.createLinearGradient(0, photoH - 100, 0, photoH);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, palette.bg);
  ctx.fillStyle = fade;
  ctx.fillRect(0, photoH - 100, W, 100);

  // header in top-left over photo
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  drawHeader(ctx, 36, 44, palette, 1.2);
  ctx.restore();

  // 詩文
  const lines = poem.split('\n');
  const fontSize = lines.length > 6 ? 32 : 42;
  const lineHeight = fontSize * 1.6;
  const totalH = lines.length * lineHeight;
  const poemArea = H - photoH - 80;
  const startY = photoH + (poemArea - totalH) / 2;
  drawPoemLines(ctx, lines, W / 2, startY, fontSize, lineHeight, palette);

  // footer
  ctx.fillStyle = palette.gold;
  ctx.font = `italic 16px ${ITALIC_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('by night, a verse', W / 2, H - 38);

  // 印章右下
  drawSeal(ctx, W - 56, H - 120, palette, 48);

  return canvas.toDataURL('image/png');
}

// ────────────────────────────────────────────────────────────────────
// 7) postcard — 1500×2100 (5×7) 紙本明信片風（直立）
// ────────────────────────────────────────────────────────────────────
function renderPostcard(img: HTMLImageElement, poem: string, palette: CardPalette): string {
  const W = 1500;
  const H = 2100;
  const {canvas, ctx} = makeCanvas(W, H);

  // 紙紋背景
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, palette.bgGradientStop);
  grad.addColorStop(1, palette.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawStarField(ctx, W, H, palette, 50);

  // 雙邊框（內外）
  const margin = 60;
  ctx.strokeStyle = palette.gold;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 3;
  ctx.strokeRect(margin, margin, W - margin * 2, H - margin * 2);
  ctx.lineWidth = 1;
  ctx.strokeRect(margin + 12, margin + 12, W - (margin + 12) * 2, H - (margin + 12) * 2);
  ctx.globalAlpha = 1;

  // 角飾
  const corner = 26;
  const cornersAt = [
    [margin + 12, margin + 12, 1, 1],
    [W - margin - 12, margin + 12, -1, 1],
    [margin + 12, H - margin - 12, 1, -1],
    [W - margin - 12, H - margin - 12, -1, -1],
  ] as const;
  ctx.strokeStyle = palette.gold;
  ctx.lineWidth = 3;
  for (const [x, y, sx, sy] of cornersAt) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * corner);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * corner, y);
    ctx.stroke();
  }

  // 上方標題
  const innerLeft = margin + 70;
  const innerRight = W - margin - 70;
  const innerW = innerRight - innerLeft;
  const innerCx = innerLeft + innerW / 2;

  drawHeader(ctx, innerCx - 60, margin + 80, palette, 2);

  // 副標 italic
  ctx.fillStyle = palette.gold;
  ctx.font = `italic 28px ${ITALIC_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('a verse for you ⸺', innerCx, margin + 130);

  // 照片
  const photoY = margin + 180;
  const photoH = 880;
  const photoW = innerW;
  // 照片框
  ctx.fillStyle = palette.bgGradientStop;
  ctx.fillRect(innerLeft, photoY, photoW, photoH);
  drawCover(ctx, img, innerLeft, photoY, photoW, photoH);
  ctx.strokeStyle = palette.gold;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.strokeRect(innerLeft, photoY, photoW, photoH);
  ctx.globalAlpha = 1;

  // 分隔線
  drawDivider(ctx, innerLeft + 80, innerRight - 80, photoY + photoH + 70, palette);

  // 詩文
  const lines = poem.split('\n');
  const fontSize = lines.length > 6 ? 50 : 60;
  const lineHeight = fontSize * 1.7;
  const poemTopY = photoY + photoH + 130;
  drawPoemLines(ctx, lines, innerCx, poemTopY, fontSize, lineHeight, palette);

  // 朱印 / 月印 — 詩文右下角
  drawSeal(ctx, innerRight - 80, H - margin - 220, palette, 110);

  // 簽名
  ctx.fillStyle = palette.inkSoft;
  ctx.font = `italic 24px ${ITALIC_STACK}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('— PhotoPoet · 點亮詩意 —', innerLeft + 30, H - margin - 90);
  ctx.font = `18px ${SERIF_STACK}`;
  ctx.fillText('cagoooo.github.io/PhotoPoet', innerLeft + 30, H - margin - 60);

  return canvas.toDataURL('image/png');
}

// ────────────────────────────────────────────────────────────────────
// 圖檔下載輔助
// ────────────────────────────────────────────────────────────────────
export const FORMAT_LABELS: Record<PoemFormat, string> = {
  embed: '📷 原圖烙印（妙用長輩圖）',
  sidebar: '🖼 圖左詩右（1200×600）',
  story: '📱 IG Story 直立 9:16',
  wallpaper: '🖥 桌布橫向 16:9',
  square: '🟦 IG Post 方形 1080',
  'line-square': '💬 LINE 分享方塊 1040',
  postcard: '✉ 明信片 5×7（紙本印刷）',
};

export const FORMAT_FILENAMES: Record<PoemFormat, string> = {
  embed: 'photopoet-embed.jpg',
  sidebar: 'photopoet-sidebar.png',
  story: 'photopoet-story.png',
  wallpaper: 'photopoet-wallpaper.png',
  square: 'photopoet-square.png',
  'line-square': 'photopoet-line.png',
  postcard: 'photopoet-postcard.png',
};

export function triggerDownload(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
