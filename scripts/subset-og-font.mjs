#!/usr/bin/env node
/**
 * 把完整 Noto Sans TC (~12 MB) 精簡成只含 OG 圖 / favicon 用得到的字元 (~150 KB)。
 * 一次性執行，產物 commit 進 repo；之後修改文案要新加字元，重跑此腳本再 commit。
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import subsetFont from 'subset-font';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_IN = resolve(__dirname, 'fonts', 'NotoSansTC-Bold.ttf');
const FONT_OUT = resolve(__dirname, 'fonts', 'NotoSansTC-Subset.ttf');

// 列出所有 OG 圖 / favicon 會用到的中文字（寧多勿少）
const USED_TEXT = `
點亮詩意照亮靈感
上傳照片人工智慧為你寫一首繁體中文詩
早安長輩圖產生器
照片變詩
分享你的詩意
詩
`;

const chars = Array.from(
  new Set([
    ...USED_TEXT,
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?-_/·+-()[]{}|@#$%&*"\'',
    '·', '．', '、', '。', '：', '，', '！', '？', '—', '…', '✦', '★', '●', '▸', '·',
  ])
).join('');

const buffer = readFileSync(FONT_IN);
const subset = await subsetFont(buffer, chars, {targetFormat: 'truetype'});
writeFileSync(FONT_OUT, subset);

const inMB = (buffer.length / 1024 / 1024).toFixed(2);
const outKB = (subset.length / 1024).toFixed(1);
console.log(`✅ Subset complete: ${inMB} MB → ${outKB} KB (${chars.length} unique chars)`);
console.log(`   ${FONT_OUT}`);
