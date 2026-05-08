#!/usr/bin/env node
/**
 * 產出兩張圖：
 *   public/og.png         1200×630   社群分享預覽（FB / LINE / Twitter / Discord 通用）
 *   src/app/icon.png      512×512    自動轉成 favicon（Next.js App Router 慣例）
 *
 * 中文字 100% 用 scripts/fonts/NotoSansTC-Subset.ttf 渲染，
 * 不依賴系統字型，Windows / Linux CI 結果一致。
 */
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCanvas, GlobalFonts} from '@napi-rs/canvas';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const FONT_PATH = resolve(__dirname, 'fonts', 'NotoSansTC-Subset.ttf');
const OG_OUT = resolve(ROOT, 'public', 'og.png');
const ICON_OUT = resolve(ROOT, 'src', 'app', 'icon.png');

if (!existsSync(FONT_PATH)) {
  console.error('❌ 找不到 subset 字型，請先執行：node scripts/subset-og-font.mjs');
  process.exit(1);
}
GlobalFonts.registerFromPath(FONT_PATH, 'NotoSansTC');

mkdirSync(dirname(OG_OUT), {recursive: true});
mkdirSync(dirname(ICON_OUT), {recursive: true});

const RAINBOW = [
  '#ef5350', // red
  '#f48fb1', // pink
  '#7e57c2', // purple
  '#2196f3', // blue
  '#26a69a', // teal
  '#43a047', // green
  '#f9a825', // amber
];

// ─────────────────────────────────────────────────────────────────
// 1) OG image  1200 × 630
// ─────────────────────────────────────────────────────────────────
function drawOg() {
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // 紫粉漸層背景（網站主視覺）
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#6d28d9'); // purple-700
  grad.addColorStop(0.55, '#9333ea'); // purple-600
  grad.addColorStop(1, '#db2777'); // pink-600
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 散落的「光點」裝飾
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 40; i++) {
    const r = 4 + Math.random() * 14;
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 主標題（漸層文字效果用 stroke + fill 模擬）
  const title = '點亮詩意，照亮靈感';
  ctx.font = '900 96px "NotoSansTC"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 白色描邊讓字浮出
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.strokeText(title, W / 2, H / 2 - 60);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, W / 2, H / 2 - 60);

  // 副標題
  ctx.font = '700 36px "NotoSansTC"';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('上傳照片，AI 為你寫一首繁體中文詩', W / 2, H / 2 + 50);

  // 上方裝飾線（彩虹色 — 呼應網站詩文配色）
  const barW = W - 320;
  const barH = 8;
  const barY = 110;
  const segW = barW / RAINBOW.length;
  RAINBOW.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(160 + i * segW, barY, segW + 1, barH);
  });

  // 底部資訊：網址 + 標籤
  ctx.font = '700 28px "NotoSansTC"';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'center';
  ctx.fillText('photopoet-ha364.web.app', W / 2, H - 70);

  ctx.font = '500 22px "NotoSansTC"';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('PhotoPoet · 早安長輩圖產生器', W / 2, H - 38);

  writeFileSync(OG_OUT, canvas.toBuffer('image/png'));
  console.log(`✨ OG image: ${OG_OUT} (${W}×${H})`);
}

// ─────────────────────────────────────────────────────────────────
// 2) Favicon source  512 × 512
//    Next.js 會自動產出 16/32/180 等尺寸的 .ico/.png/.apple-touch-icon
// ─────────────────────────────────────────────────────────────────
function drawIcon() {
  const S = 512;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  // 背景：圓角方形 + 紫粉漸層
  const r = S * 0.22;
  const grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, '#7e22ce');
  grad.addColorStop(1, '#db2777');
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, S, S, r);
  ctx.fill();

  // 中央「詩」字
  ctx.font = `900 ${S * 0.62}px "NotoSansTC"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 描邊提升對比
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.strokeText('詩', S / 2, S / 2 + 8);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('詩', S / 2, S / 2 + 8);

  // 右上角點綴：3 個小圓（代表光點 / ✨）
  const sparkles = [
    {x: S * 0.78, y: S * 0.18, r: 18},
    {x: S * 0.86, y: S * 0.34, r: 10},
    {x: S * 0.66, y: S * 0.30, r: 7},
  ];
  ctx.fillStyle = '#fef3c7';
  sparkles.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  writeFileSync(ICON_OUT, canvas.toBuffer('image/png'));
  console.log(`⭐ Icon: ${ICON_OUT} (${S}×${S})`);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

drawOg();
drawIcon();
console.log('Done.');
