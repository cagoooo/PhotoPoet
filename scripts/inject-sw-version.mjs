#!/usr/bin/env node
/**
 * Build-time SW 版本號注入。
 *
 * 流程：
 *   1. `next build` 產出 out/sw.js（裡面是 dev fallback 的 CACHE_VERSION）
 *   2. 這個腳本跑 → 把 CACHE_VERSION 換成 `<git-sha>-<yyyy-mm-dd>`
 *   3. firebase deploy / GitHub Pages 把 out/sw.js 上線
 *
 * 結果：每個 commit 都有唯一 CACHE_VERSION，瀏覽器看到 SW 內容變了就觸發
 *       updatefound → 顯示 toast「✨ 有新版可用」。
 *
 * 來源優先序：
 *   GITHUB_SHA (CI) > git rev-parse HEAD > "dev-<timestamp>" 兜底
 */
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execSync} from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SW_PATH = resolve(__dirname, '..', 'out', 'sw.js');

if (!existsSync(SW_PATH)) {
  console.error(`❌ ${SW_PATH} not found — did you run \`next build\` first?`);
  process.exit(1);
}

function shortSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', {stdio: ['ignore', 'pipe', 'ignore']})
      .toString()
      .trim();
  } catch {
    return null;
  }
}

const sha = shortSha() || `dev-${Date.now().toString(36)}`;
const date = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const newVersion = `${sha}-${date}`;

const sw = readFileSync(SW_PATH, 'utf8');
const updated = sw.replace(
  /const\s+CACHE_VERSION\s*=\s*'[^']*';/,
  `const CACHE_VERSION = '${newVersion}';`
);

if (updated === sw) {
  console.warn('⚠ CACHE_VERSION 替換失敗（regex 沒 match），sw.js 內容未變');
  process.exit(1);
}

writeFileSync(SW_PATH, updated);
console.log(`✅ SW CACHE_VERSION → ${newVersion}`);
