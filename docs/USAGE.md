# PhotoPoet（點亮詩意 · 早安長輩圖產生器）使用說明

> 一個用 Gemini 多模態能力，把照片變成繁體中文詩、再合成「長輩圖」的 Web App。
>
> 📍 線上版：https://photopoet-ha364.web.app
> 📦 Source：https://github.com/cagoooo/PhotoPoet
>
> **目前架構**：Next.js 15 (static export) → Firebase Hosting；後端 = Cloud Functions gen2 (asia-east1)；AI = Gemini 2.0 Flash via Genkit；防 bot = Cloudflare Turnstile；CI = GitHub Actions push-to-deploy。

---

## 1. 專案是什麼？

**核心流程**：
1. 使用者上傳照片（檔案 or 圖片網址）
2. 前端把圖片轉成 base64 data URI
3. 送到 `POST /api/generate` → 後端 (Next.js API route) 呼叫 **Genkit + Google AI (Gemini 2.0 Flash)**
4. AI 用一段固定 prompt（"你是一位詩人..."）產出繁中詩
5. 詩回到前端，可以：
   - 複製詩文
   - 下載「圖文左右分版」組合圖（1200×600 PNG）
   - 下載「文字烙印在原圖上」的長輩圖（JPEG）
   - 行動裝置上一鍵分享（Web Share API）

**靈感來源**：[`docs/blueprint.md`](docs/blueprint.md) — 主題是 PhotoPoet，原始需求「An app that generates poems from photos」。

---

## 2. 技術棧

| 區塊 | 技術 |
|---|---|
| 前端框架 | Next.js 15.2.3（App Router + 部分 pages/api 混用） |
| UI | shadcn/ui + Radix Primitives + Tailwind CSS + lucide-react |
| 字體 | Geist Sans/Mono + Noto Sans TC |
| AI 串接 | [Genkit](https://firebase.google.com/docs/genkit) `^1.0.4` + `@genkit-ai/googleai` |
| AI 模型 | `googleai/gemini-2.0-flash` |
| 圖文合成 | 純 client-side `<canvas>` 繪圖（無外部相依） |
| 表單/驗證 | react-hook-form + zod |
| 開發環境 | Firebase Studio / Project IDX（[`.idx/dev.nix`](.idx/dev.nix)） |
| Port | dev server `9002`，genkit dev `start -- tsx src/ai/dev.ts` |

> **注意**：`package.json` 列了 `firebase` `^11.3.0`、`@tanstack-query-firebase/react`，但目前 [`src/app/page.tsx`](src/app/page.tsx) 完全沒有用到 Firebase Auth / Firestore / Storage —— 是預備好的依賴但未啟用。

---

## 3. 目錄結構

```
.
├── .idx/dev.nix              # Firebase Studio 開發環境定義
├── .env                      # ⚠️ 內含 GOOGLE_GENAI_API_KEY（已外洩，見 §7）
├── docs/
│   ├── blueprint.md          # 原始產品需求
│   ├── USAGE.md              # 本文件
│   └── MIGRATION_AND_OPTIMIZATION.md  # 移植 + 優化計畫
├── src/
│   ├── ai/
│   │   ├── ai-instance.ts    # Genkit 初始化 + Gemini 模型設定
│   │   ├── dev.ts            # genkit:dev 進入點
│   │   └── flows/
│   │       └── generate-poem.ts   # 主 flow：圖→詩 (zod schema + prompt)
│   ├── app/                  # Next.js App Router
│   │   ├── layout.tsx        # 全站 layout + metadata
│   │   ├── page.tsx          # 主頁面（620 行，所有 UI 邏輯都在這）
│   │   ├── globals.css
│   │   └── favicon.ico
│   ├── pages/api/            # 舊版 Pages API Router
│   │   ├── generate.ts       # POST：呼叫 generatePoem flow
│   │   └── proxy.ts          # GET：用 server fetch 拉外部圖片避開 CORS
│   ├── components/ui/        # shadcn/ui 元件（accordion / button / dialog 等共 35 個）
│   ├── hooks/
│   │   ├── use-mobile.tsx    # 偵測行動裝置（影響合成圖品質）
│   │   └── use-toast.ts
│   └── lib/utils.ts          # cn() 工具
├── next.config.ts            # Next 設定（typescript / eslint 都關了 build error）
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. 環境變數

**目前只有一個**：

| 變數 | 用途 | 必填 |
|---|---|---|
| `GOOGLE_GENAI_API_KEY` | Gemini API Key（aistudio.google.com 取得） | ✅ |

放在專案根目錄 `.env`（被 [`src/ai/ai-instance.ts:8`](src/ai/ai-instance.ts:8) 讀取）。

**⚠️ 看 §7 安全章節，目前 `.env` 已 commit 進 git 歷史，必須立刻換 key。**

---

## 5. 在 Firebase Studio (IDX) 上跑

```bash
# 1. 安裝套件
npm install

# 2. 設定環境變數（如果 .env 不存在）
echo "GOOGLE_GENAI_API_KEY=你的_key" > .env

# 3. 啟動 Next.js dev server（port 9002）
npm run dev

# 4. （另一視窗，選用）啟動 Genkit Dev UI 觀察 flow 狀態
npm run genkit:dev
# 或 watch 模式
npm run genkit:watch

# 5. 預覽建置後版本
npm run build
npm start

# 6. 型別檢查（build 並未真的檢查，next.config.ts 有關）
npm run typecheck
```

`.idx/dev.nix` 已預先設定好 Node + 必要 nix package，IDX 開啟後直接可跑。

---

## 6. 主要程式重點摘要

### 6.1 Genkit Flow（後端核心）
[`src/ai/flows/generate-poem.ts`](src/ai/flows/generate-poem.ts)

- Input schema（zod）：`photoDataUri: string`（要 `data:<mime>;base64,...` 格式）
- Output schema：`poem: string`
- Prompt：固定一段，要求 AI 用繁體中文寫詩，並把圖片以 `{{media url=photoDataUri}}` 注入
- 呼叫位置：`src/pages/api/generate.ts:25` 從 HTTP body 拿到照片就直接 invoke

### 6.2 圖片代理
[`src/pages/api/proxy.ts`](src/pages/api/proxy.ts)

- 為了讓使用者貼「外部圖片網址」也能用，後端 fetch 圖片回來再回傳 → 規避瀏覽器 CORS
- 帶有 `Cache-Control: public, max-age=31536000`，但**沒有 SSRF 防護**（可被當開放代理打內網），見 §7

### 6.3 主畫面互動
[`src/app/page.tsx`](src/app/page.tsx)

- 上傳：`<input type="file">` + `FileReader.readAsDataURL`
- URL 模式：先打 `/api/proxy?url=...` 拿 blob 再轉 data URL
- 生成詩：對 `/api/generate` POST，含 503 重試（最多 3 次、指數退避）
- LINE in-app browser 處理：[`page.tsx:36-39`](src/app/page.tsx:36) 偵測到 LINE 內嵌瀏覽器自動加 `?openExternalBrowser=1` 跳出
- 圖文合成：兩個版本（左右分版 / 詩烙印在圖右下），完全 client-side 用 `<canvas>` 畫完轉 dataURL
- 行動分享：`navigator.share` (Web Share API)

### 6.4 樣式
- 主視覺：紫粉漸層 + 多色彩虹詩文
- shadcn/ui 全套元件，但實際只用到 Card / Input / Button / Textarea
- 無 dark mode

---

## 7. ⚠️ 立即要處理的安全問題

### 7.1 API Key 已外洩到 git 歷史
- `.env` 沒被 `.gitignore` 排除，且**從 `initial scaffold` commit 起就在 repo 裡**
- 這把 Gemini Key 等於公開
- **行動**：
  1. 立刻去 [Google AI Studio](https://aistudio.google.com/app/apikey) → 把 `AIzaSyD6fOTXk_u8RS3MM1Ki_VQcoUO4oKZc8aI` 撤銷
  2. 重新建一把**已限制**的 key（限制 referer / 限制 API 為 Generative Language API），用 skill `gcp-api-key-secure-create` 自動處理
  3. 把 `.env` 加進 `.gitignore`，並把它從歷史中清除（`git filter-repo` 或新建 repo 重起）
  4. 之後 key 一律放 Firebase Secrets / GitHub Secrets / Vercel env，**不要硬寫**

### 7.2 `proxy.ts` SSRF 漏洞
- [`src/pages/api/proxy.ts:14`](src/pages/api/proxy.ts:14) 直接拿 `req.query.url` 去 `fetch()`，沒有：
  - 協定白名單（會放行 `file://`、`http://localhost`、`http://169.254.169.254` 等）
  - 私有 IP 範圍封鎖
  - Content-Type 白名單（理論上要回 `image/*`）
  - URL 大小限制
- **行動**：見 [`MIGRATION_AND_OPTIMIZATION.md`](docs/MIGRATION_AND_OPTIMIZATION.md) §3.3 修補建議

### 7.3 沒有任何速率限制 / 認證
- `/api/generate` 完全公開可打，每次都打 Gemini → 任何 bot 都能把你免費額度燒爆
- 見 §優化計畫的 Cloudflare Turnstile + 登入機制建議

---

## 8. 已知問題 / TODO

| 項目 | 說明 |
|---|---|
| `next.config.ts` | `ignoreBuildErrors: true` + `eslint.ignoreDuringBuilds: true` —— 線上版本可能含型別錯誤 |
| LINE in-app browser | 已用查詢參數跳轉處理，但 `viewportMeta` 強制覆寫整個 viewport |
| 沒有 i18n | UI 寫死繁體中文 |
| 沒有歷史紀錄 | 詩生成完關掉就沒了 |
| 沒有測試 | 0 個 unit / e2e test |
| 沒有 Service Worker / PWA | 無離線支援、無 install prompt |
| 中文字 canvas 字體 | `font: 'bold 40px Arial'` —— Arial 在繁中下會 fallback，未指定 Noto Sans TC |

---

## 9. 接下來看哪份文件？

- 想 **把這個專案搬到自己的 GitHub + Firebase 部署** → [`MIGRATION_AND_OPTIMIZATION.md`](docs/MIGRATION_AND_OPTIMIZATION.md)
- 想知道**原始產品設計** → [`blueprint.md`](docs/blueprint.md)
