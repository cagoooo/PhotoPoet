/**
 * 把照片 + 詩合成不同尺寸版型的 PNG/JPEG dataURL。
 *
 * 5 種版型：
 *   embed     — 詩烙印在原圖右下（沿用早期妙用長輩圖）
 *   sidebar   — 1200×600 左圖右詩（沿用早期下載圖文組合）
 *   story     — 1080×1920 直立 IG Story（上圖下詩）
 *   wallpaper — 1920×1080 桌布（全圖背景 + 右下半透明面板）
 *   square    — 1080×1080 IG Post（上圖下詩，65/35 分版）
 *
 * 輸入照片是 base64 dataURL；輸出統一 dataURL（embed = JPEG，其餘 PNG）。
 * 中文字用 system Arial fallback（瀏覽器自動接 PingFang / Noto / 微軟正黑），
 * 不嵌字型 — canvas 朝向終端使用者列印 / 分享，依使用者 OS 字型即可。
 */

export type PoemFormat = 'embed' | 'sidebar' | 'story' | 'wallpaper' | 'square';

const POEM_COLORS = [
  '#ef5350', // red
  '#f48fb1', // pink
  '#7e57c2', // purple
  '#2196f3', // blue
  '#26a69a', // teal
  '#43a047', // green
  '#eeff41', // yellow
  '#f9a825', // amber
];

interface RenderOptions {
  isMobile?: boolean;
}

export async function renderPoemImage(
  photoDataUrl: string,
  poem: string,
  format: PoemFormat,
  opts: RenderOptions = {}
): Promise<string> {
  const img = await loadImage(photoDataUrl);
  switch (format) {
    case 'embed':
      return renderEmbed(img, poem, opts);
    case 'sidebar':
      return renderSidebar(img, poem);
    case 'story':
      return renderStory(img, poem);
    case 'wallpaper':
      return renderWallpaper(img, poem);
    case 'square':
      return renderSquare(img, poem);
    default:
      throw new Error(`未知版型 ${format}`);
  }
}

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

/** 把圖片以 cover 模式畫進 dx,dy,dw,dh */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height;
  if (ir > dr) {
    // image wider — crop horizontally
    sw = img.height * dr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / dr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** 把圖片以 contain 模式畫進 dx,dy,dw,dh，留白白色填滿 */
function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let w = dw,
    h = dh;
  if (ir > dr) h = dw / ir;
  else w = dh * ir;
  const ox = dx + (dw - w) / 2;
  const oy = dy + (dh - h) / 2;
  ctx.drawImage(img, ox, oy, w, h);
}

// ─────────────────────────────────────────────────────────────────
// 1) embed (沿用早期妙用長輩圖) — 沿用照片 ratio，詩烙印右下
// ─────────────────────────────────────────────────────────────────
function renderEmbed(img: HTMLImageElement, poem: string, opts: RenderOptions): string {
  const {canvas, ctx} = makeCanvas(img.width, img.height);
  ctx.drawImage(img, 0, 0, img.width, img.height);

  const fontSize = Math.max(20, Math.min(img.width / 18, img.height / 18));
  ctx.font = `bold ${fontSize}px Arial, "Noto Sans CJK TC", "Microsoft JhengHei"`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';

  const lines = poem.split('\n');
  const lineHeight = fontSize * 1.2;
  let y = img.height - 10;

  ctx.lineWidth = opts.isMobile ? 12 : 8;
  ctx.strokeStyle = 'white';

  for (let i = lines.length - 1; i >= 0; i--) {
    const color = POEM_COLORS[i % POEM_COLORS.length];
    ctx.fillStyle = color;
    ctx.strokeText(lines[i], img.width - 10, y);
    ctx.fillText(lines[i], img.width - 10, y);
    y -= lineHeight;
  }

  return canvas.toDataURL('image/jpeg', opts.isMobile ? 0.7 : 0.9);
}

// ─────────────────────────────────────────────────────────────────
// 2) sidebar (沿用早期圖文組合) — 1200×600 圖左詩右
// ─────────────────────────────────────────────────────────────────
function renderSidebar(img: HTMLImageElement, poem: string): string {
  const W = 1200;
  const H = 600;
  const {canvas, ctx} = makeCanvas(W, H);

  const ir = img.width / img.height;
  let imgW = 600;
  let imgH = H;
  if (ir > 1) imgH = imgW / ir;
  else imgW = imgH * ir;
  const imgX = 0;
  const imgY = (H - imgH) / 2;

  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, imgX, imgY, imgW, imgH);

  // 黑底面板蓋掉 imgW 之後
  ctx.fillStyle = '#222';
  ctx.fillRect(imgW, 0, W - imgW, H);

  ctx.font = 'bold 48px Arial, "Noto Sans CJK TC", "Microsoft JhengHei"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = poem.split('\n');
  const lineHeight = 56;
  const startY = (H - lines.length * lineHeight) / 2 + lineHeight / 2;

  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillStyle = POEM_COLORS[i % POEM_COLORS.length];
    ctx.strokeText(lines[i], imgW + (W - imgW) / 2, startY + i * lineHeight);
    ctx.fillText(lines[i], imgW + (W - imgW) / 2, startY + i * lineHeight);
  }

  return canvas.toDataURL('image/png');
}

// ─────────────────────────────────────────────────────────────────
// 3) story 1080×1920 (9:16) — 上圖下詩，IG Story
// ─────────────────────────────────────────────────────────────────
function renderStory(img: HTMLImageElement, poem: string): string {
  const W = 1080;
  const H = 1920;
  const {canvas, ctx} = makeCanvas(W, H);

  // 紫粉漸層底
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#6d28d9');
  grad.addColorStop(1, '#db2777');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 上半圖 (60%)
  const photoH = Math.round(H * 0.55);
  drawCover(ctx, img, 0, 0, W, photoH);

  // 中間漸層分隔
  ctx.fillStyle = '#000';
  ctx.fillRect(0, photoH, W, H - photoH);

  // 詩文中央排列
  const lines = poem.split('\n');
  const fontSize = lines.length > 6 ? 56 : 64;
  const lineHeight = fontSize * 1.4;
  ctx.font = `bold ${fontSize}px Arial, "Noto Sans CJK TC", "Microsoft JhengHei"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';

  const poemArea = H - photoH - 140; // bottom 留 footer
  const startY = photoH + (poemArea - lines.length * lineHeight) / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillStyle = POEM_COLORS[i % POEM_COLORS.length];
    ctx.strokeText(lines[i], W / 2, startY + i * lineHeight);
    ctx.fillText(lines[i], W / 2, startY + i * lineHeight);
  }

  // Footer 標籤
  ctx.font = '500 28px Arial, "Noto Sans CJK TC", "Microsoft JhengHei"';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('PhotoPoet Pro · 點亮詩意', W / 2, H - 60);

  return canvas.toDataURL('image/png');
}

// ─────────────────────────────────────────────────────────────────
// 4) wallpaper 1920×1080 (16:9) — 全圖背景 + 右下面板
// ─────────────────────────────────────────────────────────────────
function renderWallpaper(img: HTMLImageElement, poem: string): string {
  const W = 1920;
  const H = 1080;
  const {canvas, ctx} = makeCanvas(W, H);

  drawCover(ctx, img, 0, 0, W, H);

  // 右下半透明面板
  const lines = poem.split('\n');
  const fontSize = lines.length > 6 ? 38 : 46;
  const lineHeight = fontSize * 1.45;

  // measure widest line
  ctx.font = `bold ${fontSize}px Arial, "Noto Sans CJK TC", "Microsoft JhengHei"`;
  let maxLineW = 0;
  for (const line of lines) {
    const m = ctx.measureText(line);
    if (m.width > maxLineW) maxLineW = m.width;
  }

  const padX = 50;
  const padY = 40;
  const panelW = Math.min(W * 0.55, maxLineW + padX * 2);
  const panelH = lines.length * lineHeight + padY * 2;
  const panelX = W - panelW - 60;
  const panelY = H - panelH - 60;

  // 半透明黑面板 + 圓角
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRectPath(ctx, panelX, panelY, panelW, panelH, 18);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillStyle = POEM_COLORS[i % POEM_COLORS.length];
    ctx.fillText(
      lines[i],
      panelX + panelW / 2,
      panelY + padY + i * lineHeight + lineHeight / 2
    );
  }

  return canvas.toDataURL('image/png');
}

// ─────────────────────────────────────────────────────────────────
// 5) square 1080×1080 (1:1) — IG post，上圖下詩
// ─────────────────────────────────────────────────────────────────
function renderSquare(img: HTMLImageElement, poem: string): string {
  const W = 1080;
  const H = 1080;
  const {canvas, ctx} = makeCanvas(W, H);

  // 上 65% 圖
  const photoH = Math.round(H * 0.65);
  drawCover(ctx, img, 0, 0, W, photoH);

  // 下 35% 黑底
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, photoH, W, H - photoH);

  // 詩文
  const lines = poem.split('\n');
  const fontSize = lines.length > 6 ? 30 : 38;
  const lineHeight = fontSize * 1.4;
  ctx.font = `bold ${fontSize}px Arial, "Noto Sans CJK TC", "Microsoft JhengHei"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const startY =
    photoH + ((H - photoH) - lines.length * lineHeight) / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillStyle = POEM_COLORS[i % POEM_COLORS.length];
    ctx.fillText(lines[i], W / 2, startY + i * lineHeight);
  }

  return canvas.toDataURL('image/png');
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ─────────────────────────────────────────────────────────────────
// 圖檔下載輔助
// ─────────────────────────────────────────────────────────────────
export const FORMAT_LABELS: Record<PoemFormat, string> = {
  embed: '📷 原圖 + 詩烙印（妙用長輩圖）',
  sidebar: '🖼 圖左詩右（1200×600）',
  story: '📱 IG Story 直立 9:16',
  wallpaper: '🖥 桌布橫向 16:9',
  square: '🟦 IG Post 方形 1:1',
};

export const FORMAT_FILENAMES: Record<PoemFormat, string> = {
  embed: 'photopoet-embed.jpg',
  sidebar: 'photopoet-sidebar.png',
  story: 'photopoet-story.png',
  wallpaper: 'photopoet-wallpaper.png',
  square: 'photopoet-square.png',
};

export function triggerDownload(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
