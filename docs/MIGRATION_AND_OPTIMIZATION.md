# PhotoPoet 移植 GitHub + Firebase Serverless 部署 & 後續優化計畫

> 目標：把目前跑在 Firebase Studio (IDX) 上的 Next.js App，搬成「**GitHub 管原始碼 + Firebase Hosting (靜態) + Cloud Functions (後端) + Firestore (歷史紀錄)** 」的 serverless 架構。
> 所有後端一律用 Firebase（依使用者偏好）。
> 操作專案的帳號：**`ipad@mail2.smes.tyc.edu.tw`**（學校 Gmail，所有教學 Firebase 專案 owner）。

---

## 0. 移植可行性結論（先看這段）

### ✅ 完全可移植，但要做一些改寫

這個 App 雖然是 Next.js 寫的，但：
- **前端 UI 100% 是 client-side**（`'use client'` 全靠 React state，沒用 Server Component / Server Action 的執行階段功能）
- **後端 API 只有 2 個端點**（`/api/generate`、`/api/proxy`），都是純 HTTP，可以無痛搬到 Cloud Functions
- **沒有用 Firebase 以外的雲端依賴**

### 三種方案比較

| 方案 | 工作量 | 成本 | 適合誰 |
|---|---|---|---|
| **A. 保留 Next.js，部署到 Vercel** | ⭐ 最低 | Vercel free tier 夠用 | 想最快上線、不在乎 vendor lock-in |
| **B. Next.js static export + Firebase Hosting + Cloud Functions** ✅ **推薦** | ⭐⭐ 中等 | 全部免費層內 | 想用 Firebase 全家桶、未來要加 Auth/Firestore |
| **C. 純靜態 HTML + Firebase Functions（依 skill `firebase-studio-static-migration`）** | ⭐⭐⭐ 最高 | 最便宜 | 想丟到 GitHub Pages、極致省成本 |

**推薦方案 B**，理由：
1. 符合使用者「後端我都用 Firebase」的習慣
2. 可保留 Next.js 開發體驗（HMR、TypeScript、shadcn/ui）
3. 之後要加 Firebase Auth / Firestore 寫詩歷史，已經是同一個專案，零摩擦
4. Firebase Hosting CDN 比 GitHub Pages 快、且支援自訂網域 + HTTPS + rewrites
5. Cloud Functions 拿來跑 Genkit 完全合身（Genkit 本來就是 Firebase 系產品）

---

## 1. 立即要做的事（不論選哪個方案）

### 1.1 🚨 撤銷外洩的 Gemini API Key
```bash
# 1. 先去 https://aistudio.google.com/app/apikey 撤銷舊 key
#    AIzaSyD6fOTXk_u8RS3MM1Ki_VQcoUO4oKZc8aI

# 2. 用 skill gcp-api-key-secure-create 建一把「已限制」的新 key
#    限制：只能呼叫 Generative Language API
```

### 1.2 把 `.env` 排除 + 從 git 歷史清除
```bash
# .gitignore 加：
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore

# 從 git 歷史移除（如果這個 repo 之後要 public）
# 推薦 git-filter-repo（比 filter-branch 快很多）
pip install git-filter-repo
git filter-repo --path .env --invert-paths
git push --force  # 注意：會重寫歷史，協作者要重 clone
```
> 如果 repo 還沒 push 過、只是本地：直接 `rm -rf .git && git init` 重來最快。

### 1.3 加 `.env.example`
```dotenv
# .env.example（commit 進去，作為範本）
GOOGLE_GENAI_API_KEY=your_gemini_api_key_here
```

---

## 2. 方案 B 詳細步驟（推薦）

### 整體架構圖

```
┌────────────────────────────┐         ┌──────────────────────────┐
│ GitHub repo (cagoooo/...)  │  push   │ GitHub Actions           │
│  Next.js source            │────────▶│  build + deploy CI/CD    │
└────────────────────────────┘         └────────────┬─────────────┘
                                                    │
                          ┌─────────────────────────┴────────────────────────┐
                          ▼                                                  ▼
            ┌────────────────────────────┐                    ┌────────────────────────────┐
            │ Firebase Hosting           │   /api/* rewrite   │ Cloud Functions (gen2)     │
            │  (out/ 靜態檔)             │───────────────────▶│  generatePoem (callable)   │
            │  CDN 全球邊緣              │                    │  proxyImage (onRequest)    │
            └────────────────────────────┘                    └─────────────┬──────────────┘
                                                                            │
                                                                            ▼
                                                              ┌──────────────────────────┐
                                                              │ Gemini API (Genkit)      │
                                                              │  + Firebase Secret Mgr   │
                                                              └──────────────────────────┘
```

### Step 1：建立 Firebase 專案（用學校 Gmail）

```bash
# Claude Code 執行 firebase 指令時要用對帳號
firebase login --reauth   # 或用 Start-Process cmd.exe 開新視窗（非互動式會卡）
firebase projects:create photopoet-akai \
  --display-name "PhotoPoet 詩意產生器" \
  --account=ipad@mail2.smes.tyc.edu.tw

# 把目前 worktree 連上去
firebase use --add photopoet-akai --account=ipad@mail2.smes.tyc.edu.tw
```

如果遇到 OAuth 卡關（Claude Code Bash 是非互動式），參考 skill `firebase-stack-automation`：
```powershell
Start-Process cmd.exe -ArgumentList '/k','firebase login --reauth'
```

### Step 2：在 repo 加上 Firebase 設定檔

**`firebase.json`**（新建）：
```json
{
  "hosting": {
    "public": "out",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/api/generate", "function": "generatePoem" },
      { "source": "/api/proxy",    "function": "proxyImage"   }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|woff2)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      }
    ]
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "nodejs20",
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ]
}
```

> ⚠️ 看 skill `firebase-multi-app-safety`：如果這個 Firebase 專案之後要放多個 app，請改用 `codebase: photopoet` 並且 deploy 時加 `--only functions:photopoet`，避免互相覆蓋。

### Step 3：把 Next.js 改成 static export 模式

**`next.config.ts`**（修改）：
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',           // ⭐ 關鍵
  trailingSlash: true,        // Firebase Hosting 路由相容
  images: {
    unoptimized: true,        // ⭐ static export 不能用 next/image optimization
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
  typescript: { ignoreBuildErrors: false },  // ⚠️ 修完型別錯後改回 false
  eslint:    { ignoreDuringBuilds: false },
};
export default nextConfig;
```

**注意要做的程式調整**：
- [`src/app/page.tsx:36-50`](src/app/page.tsx:36) 的 LINE viewport hack 要保留（純 client）
- 把 `next/image` 全部換成 `<img>` 或繼續用 `next/image` + `unoptimized: true`
- `next/font/google`（Geist、Noto Sans TC）在 static export 下還可以用，會 build-time fetch 字體
- **`'use server'` 必須完全消失**：[`src/ai/flows/generate-poem.ts:1`](src/ai/flows/generate-poem.ts:1) 要把 `'use server'` 移除，因為改放在 Cloud Functions 不再是 Server Action
- 前端打 API 的路徑保持 `/api/generate`、`/api/proxy`（會被 hosting rewrite 到 Functions）

### Step 4：把 API routes 搬成 Cloud Functions

```bash
# 在 repo 根目錄
mkdir functions && cd functions
npm init -y
npm install firebase-functions firebase-admin genkit @genkit-ai/googleai zod
npm install -D typescript @types/node
npx tsc --init
```

**`functions/src/index.ts`**（新建）：
```ts
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const GEMINI_KEY = defineSecret('GOOGLE_GENAI_API_KEY');

// Lazy init，避免 cold start 把 key 讀出來但 secret 未注入
function getAI() {
  return genkit({
    plugins: [googleAI({ apiKey: GEMINI_KEY.value() })],
    model: 'googleai/gemini-2.0-flash',
  });
}

const InputSchema  = z.object({ photoDataUri: z.string() });
const OutputSchema = z.object({ poem: z.string() });

// === generatePoem (POST /api/generate) ===
export const generatePoem = onRequest(
  {
    region: 'asia-east1',
    secrets: [GEMINI_KEY],
    cors: true,
    memory: '512MiB',
    timeoutSeconds: 60,
    maxInstances: 10,                  // 控制成本天花板
  },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }
    const { photo } = req.body || {};
    if (!photo) { res.status(400).json({ error: '照片為必填欄位' }); return; }

    try {
      const ai = getAI();
      const flow = ai.defineFlow(
        { name: 'generatePoemFlow', inputSchema: InputSchema, outputSchema: OutputSchema },
        async ({ photoDataUri }) => {
          const { output } = await ai.definePrompt({
            name: 'generatePoemPrompt',
            input:  { schema: InputSchema },
            output: { schema: OutputSchema },
            prompt: `你是一位詩人。 根據照片，創作一首反映其內容、氣氛和關鍵元素的詩。 這首詩必須是繁體中文。

Photo: {{media url=photoDataUri}}`,
          })({ photoDataUri });
          if (!output) throw new Error('AI 模型未能產生有效的輸出。');
          return output;
        }
      );
      const result = await flow({ photoDataUri: photo });
      res.status(200).json({ poem: result.poem });
    } catch (err: any) {
      console.error('generatePoem error', err);
      res.status(500).json({ error: err.message || '生成詩詞失敗' });
    }
  }
);

// === proxyImage (GET /api/proxy?url=...) ===
const PRIVATE_RANGES = [
  /^10\./, /^192\.168\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^127\./,
  /^169\.254\./, /^localhost$/, /^0\./,
];

export const proxyImage = onRequest(
  { region: 'asia-east1', cors: true, maxInstances: 5 },
  async (req, res) => {
    const url = String(req.query.url || '');
    let parsed: URL;
    try { parsed = new URL(url); }
    catch { res.status(400).json({ error: '無效的 URL' }); return; }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      res.status(400).json({ error: '只接受 http/https' }); return;
    }
    if (PRIVATE_RANGES.some(re => re.test(parsed.hostname))) {
      res.status(403).json({ error: '不允許的目標位址' }); return;
    }
    try {
      const r = await fetch(parsed.toString(), { redirect: 'follow' });
      if (!r.ok) { res.status(r.status).json({ error: 'Failed to fetch image' }); return; }
      const ct = r.headers.get('content-type') || '';
      if (!ct.startsWith('image/')) { res.status(415).json({ error: '不是圖片' }); return; }

      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 10 * 1024 * 1024) { res.status(413).json({ error: '圖片過大' }); return; }

      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(buf);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'proxy 失敗' });
    }
  }
);
```

### Step 5：把 Gemini Key 灌進 Firebase Secret Manager

```bash
# 別把 key 貼在 chat！用 stdin 灌
firebase functions:secrets:set GOOGLE_GENAI_API_KEY \
  --account=ipad@mail2.smes.tyc.edu.tw
# 提示輸入時貼 key，或先寫到變數再 echo | pipe
```

skill 參考：`gcp-api-key-secure-create` 自動化整個流程。

### Step 6：把舊的 `src/pages/api/*` 刪掉

```bash
# static export 模式下 Next.js 不會處理 API routes
git rm -r src/pages
```
（前端 fetch 路徑不變，由 Firebase Hosting rewrites 接到 Functions）

### Step 7：建 GitHub Actions 自動部署

**`.github/workflows/deploy.yml`**：
```yaml
name: Deploy to Firebase
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }

      # 前端 build
      - run: npm ci
      - run: npm run build
      # next.config 設了 output: export，會產出 ./out

      # functions build
      - run: npm ci
        working-directory: functions
      - run: npm run build
        working-directory: functions

      # 部署
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: photopoet-akai
```

**GitHub Secret 設定**（用 gh CLI）：
```bash
# 在 Firebase Console 下載 service account JSON
gh secret set FIREBASE_SERVICE_ACCOUNT < firebase-sa.json
# 不要 commit JSON，設完即刪
rm firebase-sa.json
```

### Step 8：本地驗證

```bash
# 啟動 emulator 模擬整套（Hosting + Functions + Secret）
firebase emulators:start --only hosting,functions \
  --account=ipad@mail2.smes.tyc.edu.tw

# 開瀏覽器：http://127.0.0.1:5000
# 上傳照片 → 應走 /api/generate → 模擬器顯示 functions log
```

### Step 9：首次部署

```bash
firebase deploy --only hosting,functions \
  --account=ipad@mail2.smes.tyc.edu.tw
```

完成後拿到 `https://photopoet-akai.web.app`。

---

## 3. 後續優化建議（依價值×工作量排序）

| # | 項目 | 價值 | 工作量 | 對應 skill |
|---|---|---|---|---|
| 3.1 | Cloudflare Turnstile 防 bot 刷 API | 🔥🔥🔥 | ⭐ | `cloudflare-turnstile-integration` |
| 3.2 | Firebase Auth + Firestore 詩歷史 | 🔥🔥🔥 | ⭐⭐ | `supabase-google-oauth-integration`（改成 Firebase Auth 即可） |
| 3.3 | 修補 proxy SSRF + 加速率限制 | 🔥🔥 | ⭐ | – |
| 3.4 | PWA + Service Worker（可離線、可裝桌面） | 🔥🔥 | ⭐⭐ | `pwa-cache-bust` |
| 3.5 | OG Image / 社群分享預覽 | 🔥🔥 | ⭐ | `og-social-preview-zh` |
| 3.6 | Genkit prompt 升級 + 多風格選擇 | 🔥 | ⭐ | – |
| 3.7 | LINE Bot 模式（傳照片給 Bot 直接出詩） | 🔥 | ⭐⭐⭐ | `line-messaging-firebase` |
| 3.8 | E2E 測試（Playwright） | 🔥 | ⭐⭐ | – |
| 3.9 | 觀測性：Sentry / Cloud Logging dashboard | 🔥 | ⭐ | – |
| 3.10 | 國際化（en + zh-TW） | – | ⭐⭐ | – |

### 3.1 Cloudflare Turnstile（最該先做的防護）

**為什麼重要**：免費 Gemini quota 每天有限（Gemini 2.0 Flash 免費層 RPM 15、RPD 1500）。一個惡意 bot 可以在 1 小時內把你的額度燒爆 → 真的使用者打不到。

```ts
// 前端：載 widget 後拿到 token，跟 photo 一起送
fetch('/api/generate', {
  method: 'POST',
  body: JSON.stringify({ photo, turnstileToken }),
});

// 後端：先驗 token 再走 Gemini
const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
  method: 'POST',
  body: new URLSearchParams({ secret: TURNSTILE_SECRET.value(), response: turnstileToken }),
});
if (!(await verify.json()).success) { res.status(403).json({error:'驗證失敗'}); return; }
```

詳細流程跑 skill `cloudflare-turnstile-integration`。

### 3.2 Firebase Auth + Firestore 歷史紀錄

**收益**：使用者登入後，每首生出的詩自動存進 Firestore，跨裝置可看；也能限制每人每天最多生 N 首（成本控制）。

Firestore 結構建議：
```
users/{uid}
  ├─ displayName, email, photoURL
  └─ usageToday: { date, count }   // 用 Cloud Functions 每天重置
poems/{poemId}
  ├─ uid, photoUrl (Storage), poem, createdAt
  └─ likeCount, isPublic
```

部署 Firestore rules 走 skill `firebase-stack-automation`，**不要** `firebase deploy --force`（看 skill `firebase-multi-app-safety` 為何危險）。

### 3.3 proxy.ts SSRF 修補（已寫進 §2 Step 4 範例）

修補項：
- ✅ 協定白名單（http/https）
- ✅ 私有網段拒絕（10.x / 192.168 / 172.16-31 / 127.x / 169.254.x / localhost）
- ✅ Content-Type 檢查（`image/*`）
- ✅ 大小限制（10 MB）
- 🔄 還可加 IP resolution 後再次 check（防 DNS rebinding）

### 3.4 PWA / Service Worker

加 `next-pwa` 或手寫 SW，重點：
- 圖片 + 字體先快取
- API call **不要** cache（每次要新詩）
- 更新策略採 `skipWaiting` + `clientsClaim`，但搭配版本號 query string 強制 cache-bust（skill `pwa-cache-bust`）

### 3.5 社群分享 OG Image

目前分享連結到 LINE / FB 只會看到網站標題沒預覽圖。
- 用 skill `og-social-preview-zh` 產生 1200×630 OG image
- 中文字注意：用 Noto Sans TC 嵌入 SVG → render PNG，否則會變方框（tofu）
- 在 [`src/app/layout.tsx`](src/app/layout.tsx) 的 metadata 加 `openGraph` + `twitter` 欄位

### 3.6 Prompt 升級 / 多風格

目前 prompt 寫死「一位詩人，繁體中文詩」。可擴成：
- 風格選擇：唐詩、現代詩、俳句、台語白話、長輩問候語
- 字數選擇：四句絕句 / 八行 / 16 行
- 上 [Genkit Dotprompt](https://firebase.google.com/docs/genkit/dotprompt) 把 prompt 拉到 `.prompt` 檔，便於 A/B test

### 3.7 LINE Bot 模式

把使用者上傳照片→詩的流程做成 LINE 官方帳號 webhook：
- 使用者傳照片給 Bot
- Webhook 收到 → 下載照片 → 走同一個 `generatePoem` flow → 回 reply message
- 走 skill `line-messaging-firebase`

### 3.8 E2E 測試

```bash
npm install -D @playwright/test
```
- 單一最重要 case：上傳照片 → 等 30 秒 → 看到詩出現
- mock Gemini response 避免測試打真 API（用 Playwright `route.fulfill`）

### 3.9 觀測性

- Sentry：前端 + Functions 都接，免費層每月 5k events
- Firebase Console → Functions → Logs Explorer 檢視錯誤
- 加 `console.log({ event: 'poem_generated', uid, latencyMs })` 結構化 log，未來可導 BigQuery 算統計

### 3.10 國際化

`next-intl` 在 static export 模式可用：
- 路徑：`/zh-TW/`、`/en/`
- prompt 也要根據 locale 切：英文版改成 "You are a poet, create a poem in English..."

---

## 4. 進階：成本控管與限制

### 4.1 Gemini API 成本
- **Gemini 2.0 Flash 免費層**：1500 requests/day，足夠教學用
- 升級到 paid：$0.075 / 1M input tokens（圖片約 258 tokens / 圖）
- 估算：1000 張圖片約花 $0.02，幾乎免費

### 4.2 Firebase Functions 成本
- gen2 免費層：每月 2M invocations + 400k GB-seconds
- 預估：每次生詩 ~3 秒 × 512 MB → 約 1.5 GB-s/次
- 400k / 1.5 = **約 26 萬次/月** 全免費

### 4.3 Firebase Hosting
- 免費：10 GB storage + 360 MB/day 流量
- static export 整包大概 5-10 MB，輕鬆

### 4.4 雙層保護建議
1. Turnstile 擋 bot（§3.1）
2. Functions 內每 IP 速率限制：用 Firestore counter 或 [`@upstash/ratelimit`](https://github.com/upstash/ratelimit) (free tier)
3. 登入後每人每天上限 50 首（§3.2）

---

## 5. 把專案搬到 GitHub 的具體指令

```bash
# 1. 在 GitHub 建 repo（用 gh CLI，預設帳號 cagoooo）
gh repo create photopoet --public --description "PhotoPoet · 點亮詩意"

# 2. 把本地 worktree push 上去
cd H:/PhotoPoet
git remote add origin https://github.com/cagoooo/photopoet.git
# ⚠️ 若 .env 已 commit 進歷史，先清掉再 push（見 §1.2）
git push -u origin main

# 3. 啟用 GitHub Pages（如果只想簡單先預覽前端，用 skill github-pages-auto-deploy）
gh api -X POST /repos/cagoooo/photopoet/pages -f build_type=workflow

# 4. 設定 Firebase Service Account 進 Secret
gh secret set FIREBASE_SERVICE_ACCOUNT < firebase-sa.json

# 5. push 觸發 CI 自動部署到 Firebase
git push
# → 看 https://github.com/cagoooo/photopoet/actions
```

---

## 6. 收尾檢查清單

部署完成前確認：

- [ ] `.env` 不在 repo（`git ls-files | grep .env` 應該為空）
- [ ] 舊的 Gemini key 已撤銷
- [ ] 新 key 在 Firebase Secret Manager（`firebase functions:secrets:access GOOGLE_GENAI_API_KEY` 看得到）
- [ ] `next.config.ts` 設了 `output: 'export'`、`images.unoptimized: true`
- [ ] `src/pages/` 已刪除
- [ ] `'use server'` 從 [`src/ai/flows/generate-poem.ts`](src/ai/flows/generate-poem.ts) 移除
- [ ] Functions 有設 `region: 'asia-east1'` + `maxInstances`
- [ ] proxy 有私有網段封鎖（§3.3）
- [ ] `firebase emulators:start` 本地跑得起來
- [ ] GitHub Actions 至少跑過一次 deploy 成功
- [ ] Hosting 與 Functions 各自被 `firebase deploy` log 顯示為 ✅
- [ ] 開 https://photopoet-akai.web.app 上傳照片 → 真的生詩
- [ ] Cloudflare Turnstile 已加（避免 quota 被打爆）
- [ ] README.md 加上 Live Demo 連結

---

## 7. 出問題了怎麼辦？

| 狀況 | 看哪 |
|---|---|
| GitHub Actions 紅 | skill `firebase-ci-troubleshooter` |
| Functions deploy 失敗 | `firebase functions:log --only generatePoem` |
| 部署後白畫面 | skill `firebase-ci-troubleshooter` 的 TDZ / 白屏節 |
| Service Worker 快取舊版 | skill `pwa-cache-bust` |
| Gemini 報 model not found | skill `gemini-api-integration`（模型名常被 deprecate） |
| 想忘掉 admin 密碼 | skill `firebase-admin-password-recovery` |
| Firebase 專案沒控制權（IDX 自動建的 sandbox） | skill `firebase-stack-automation` |

---

**完成這份遷移後，你會有**：
- ✅ GitHub 上完整原始碼版控
- ✅ Firebase Hosting 上的快速 CDN 前端
- ✅ Cloud Functions 上的安全後端（API Key 不外洩）
- ✅ 可彈性擴展到 Auth / Firestore / 多語系 / PWA
- ✅ 全部在 Firebase 免費層內運行
