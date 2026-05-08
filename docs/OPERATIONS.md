# PhotoPoet 運維手冊（Operations & Maintenance）

> 版本：v1.0（2026-05-08）
> 對象：未來維護這個專案的人（也包括未來的自己）
> 線上版：https://photopoet-ha364.web.app · https://cagoooo.github.io/PhotoPoet/
> Source：https://github.com/cagoooo/PhotoPoet
> 主要操作帳號：`ipad@mail2.smes.tyc.edu.tw`（Firebase / GCP owner）+ `cagoooo`（GitHub）

---

## 目錄

1. [架構總覽](#1-架構總覽)
2. [部署目標與 URL](#2-部署目標與-url)
3. [Cloud / GitHub 資源清單](#3-cloud--github-資源清單)
4. [環境變數與 Secrets](#4-環境變數與-secrets)
5. [日常開發流程](#5-日常開發流程)
6. [部署流程](#6-部署流程)
7. [常見維護任務](#7-常見維護任務)
8. [故障排除](#8-故障排除)
9. [成本與額度](#9-成本與額度)
10. [安全模型](#10-安全模型)

---

## 1. 架構總覽

```
                                      使用者
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                              ▼
    ┌───────────────────────┐               ┌────────────────────────────┐
    │ Firebase Hosting      │               │ GitHub Pages              │
    │ photopoet-ha364.web.app│               │ cagoooo.github.io/PhotoPoet│
    │ • basePath = ''       │               │ • basePath = /PhotoPoet     │
    │ • /api/* 走 hosting   │               │ • /api/* 跨域打 web.app    │
    │   rewrite 到 Functions│               │   (CORS-enabled)           │
    └────────┬──────────────┘               └────────────┬────────────────┘
             │                                            │
             │  /api/generate, /api/proxy                 │ POST + ID token
             ▼                                            │ + turnstileToken
    ┌───────────────────────────────────────────────────┐ │
    │ Hosting rewrites → Cloud Functions (asia-east1)   │◀┘
    └────────┬──────────────────────────────────────────┘
             ▼
    ┌─────────────────────────┐  ┌────────────────────────┐
    │ generatePoem (gen2)     │  │ proxyImage (gen2)      │
    │  1. verify ID token     │  │  • SSRF 防護           │
    │  2. verify Turnstile    │  │  • redirect 重檢       │
    │  3. consume quota txn   │  │  • Content-Type 檢查   │
    │  4. Genkit → Gemini 2.0 │  │  • 10MB / 8s 上限      │
    │  5. save poem to FS     │  └────────────────────────┘
    └────┬───────────────┬────┘
         ▼               ▼
   ┌──────────────┐  ┌────────────────────┐
   │ Gemini API   │  │ Firestore          │
   │ (key in SM)  │  │ users/{uid}.usage  │
   └──────────────┘  │ poems/{id}         │
                     └────────────────────┘
```

---

## 2. 部署目標與 URL

| 用途 | URL | 部署來源 |
|---|---|---|
| 主站（Firebase Hosting） | https://photopoet-ha364.web.app | `.github/workflows/deploy.yml` push to main 自動 |
| Mirror（GitHub Pages） | https://cagoooo.github.io/PhotoPoet/ | `.github/workflows/deploy-pages.yml` push to main 自動 |
| Cloud Functions URL（直連） | `https://generatepoem-tmr27hb2ca-de.a.run.app`、`https://proxyimage-tmr27hb2ca-de.a.run.app` | 透過 `firebase deploy --only functions` |
| Firebase Console | https://console.firebase.google.com/project/photopoet-ha364 | – |
| GCP Console | https://console.cloud.google.com/home/dashboard?project=photopoet-ha364 | – |

---

## 3. Cloud / GitHub 資源清單

### Firebase 專案
- **Project ID**：`photopoet-ha364`
- **Project Number**：`142975838924`
- **Region**：`asia-east1`（Functions、Firestore 都在台北最近的 region）
- **Billing account**：`0119C9-C416DD-660DE3`

### Cloud Functions (gen2)
| Function | URL | Memory | Timeout | maxInstances |
|---|---|---|---|---|
| `generatePoem` | `https://generatepoem-tmr27hb2ca-de.a.run.app` | 512 MiB | 60s | 10 |
| `proxyImage` | `https://proxyimage-tmr27hb2ca-de.a.run.app` | 256 MiB | 30s | 5 |

兩個都 `cors: true`、`allUsers / roles/run.invoker`。

### Firestore
- Database：`(default)` Native mode, asia-east1
- Collections：
  - `users/{uid}`：profile + `usage = { date: 'YYYY-MM-DD', count }`
  - `poems/{id}`：`uid`, `poem`, `createdAt`
- Rules：[firestore.rules](firestore.rules) — clients 只能讀自己的，所有寫入走 admin SDK
- Indexes：[firestore.indexes.json](firestore.indexes.json)

### Service Accounts
| SA Email | 用途 | 主要 IAM Roles |
|---|---|---|
| `github-deploy@photopoet-ha364.iam.gserviceaccount.com` | GitHub Actions 部署用 | firebase.admin、cloudfunctions.admin、run.admin、iam.serviceAccountUser、secretmanager.admin、artifactregistry.admin、cloudbuild.builds.editor、serviceusage.serviceUsageConsumer、billing.viewer (在 billing-account 層級) |
| `142975838924-compute@developer.gserviceaccount.com` | Functions runtime SA | datastore.user |

### GCP API Keys
| Display Name | UID | 用途 | 限制 |
|---|---|---|---|
| `Browser key (auto created by Firebase)` | `78701432-41a2-4dcd-8b9a-db1e1a48886b` | 前端 Firebase SDK | Referrer: web.app/*、firebaseapp.com/*、cagoooo.github.io/*、localhost |
| `PhotoPoet Gemini Key (created 20260508)` | `b3f595a5-2fbb-4d64-84f2-9de6b34b5fd2` | Functions 呼叫 Gemini API（透過 Secret Manager） | API target: generativelanguage.googleapis.com only |

### Firebase Secrets (Secret Manager)
| Name | 用途 | 綁定到 |
|---|---|---|
| `GOOGLE_GENAI_API_KEY` | Gemini API key | `generatePoem` function |
| `TURNSTILE_SECRET` | Cloudflare Turnstile server-side secret | `generatePoem` function |

### Cloudflare Turnstile
- Site Key（公開）：`0x4AAAAAADLU0raESjffGOHA`
- Secret Key（保密）：在 Firebase Secret Manager 的 `TURNSTILE_SECRET`
- Hostnames：`photopoet-ha364.web.app`、`photopoet-ha364.firebaseapp.com`、`cagoooo.github.io`、`localhost`
- Mode：Managed
- Dashboard：https://dash.cloudflare.com/?to=/:account/turnstile

### GitHub
- Repo：`cagoooo/PhotoPoet`（public）
- Branch：`main`（orphan, no IDX legacy history）
- Workflows：
  - `deploy.yml` → Firebase Hosting + Functions + Firestore
  - `deploy-pages.yml` → GitHub Pages
- Secret：`FIREBASE_SERVICE_ACCOUNT`（github-deploy SA 的 JSON key）
- Variables（public values，build 時 inline 進前端）：
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

---

## 4. 環境變數與 Secrets

### 後端（Functions runtime）
| 變數 | 來源 | 行為 |
|---|---|---|
| `GOOGLE_GENAI_API_KEY` | `defineSecret('GOOGLE_GENAI_API_KEY')` | Genkit 呼叫 Gemini |
| `TURNSTILE_SECRET` | `defineSecret('TURNSTILE_SECRET')` | server-side verify CF token；設為 `PLACEHOLDER_NOT_CONFIGURED` 時 fail-open |

### 前端（build-time inline，純 public）
| 變數 | Firebase Hosting | GitHub Pages |
|---|---|---|
| `NEXT_PUBLIC_BASE_PATH` | （未設）| `/PhotoPoet` |
| `NEXT_PUBLIC_API_BASE` | （未設，same-origin） | `https://photopoet-ha364.web.app` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | repo var | repo var |
| `NEXT_PUBLIC_FIREBASE_*`（6 個） | repo var | repo var |

### 本地開發
複製 `.env.example` 為 `.env`，填入 Gemini key 即可（其他 NEXT_PUBLIC_* 不填，前端 fallback 為 disabled）。
另外建 `functions/.secret.local`：
```
GOOGLE_GENAI_API_KEY=<同 Firebase Secret>
TURNSTILE_SECRET=<同 Firebase Secret，或 PLACEHOLDER_NOT_CONFIGURED>
```

---

## 5. 日常開發流程

```bash
# 安裝 deps
npm install
npm install --prefix functions

# 起 emulator（hosting 5000 / functions 5001 / UI 4000）
firebase emulators:start --only hosting,functions \
  --project=photopoet-ha364 --account=ipad@mail2.smes.tyc.edu.tw

# 改 functions code → 自動 watch 重編
# 改前端 code → 重 build 一次 (npm run build) 然後 emulator hot-reload static

# Build 驗證（在 push 前）
npm run build              # 前端 static export
npm run build --prefix functions  # functions tsc

# 重新生成 OG / favicon（很少改）
npm run gen:og
```

---

## 6. 部署流程

### 標準（push to main 觸發）
```bash
git push origin main
```
兩個 workflow **並行**跑：
- `deploy.yml` → Firebase Hosting + Functions + Firestore（~3 分鐘）
- `deploy-pages.yml` → GitHub Pages（~2 分鐘）

監看：
```bash
gh run list --repo=cagoooo/PhotoPoet --limit 5
gh run watch <RUN_ID> --repo=cagoooo/PhotoPoet
```

### 手動部署（緊急修補）
```bash
firebase deploy --only hosting,functions,firestore \
  --project=photopoet-ha364 \
  --account=ipad@mail2.smes.tyc.edu.tw \
  --force
```

`--force` 處理 Artifact Registry cleanup policy 的 prompt（已在 CI 用 `--force`）。

### 只部分部署
```bash
firebase deploy --only hosting           # 前端
firebase deploy --only functions:generatePoem  # 單一 function
firebase deploy --only firestore:rules   # 只更新 rules
firebase deploy --only firestore:indexes # 只更新 indexes
```

---

## 7. 常見維護任務

### 7.1 更換 Gemini API Key（rotate every 90 days）

```bash
# 1. 用 gcloud 建一把新的 restricted key
gcloud services api-keys create \
  --display-name="PhotoPoet Gemini Key (rotated $(date +%Y%m%d))" \
  --api-target=service=generativelanguage.googleapis.com \
  --project=photopoet-ha364 \
  --format="value(uid)"

# 2. 拿 key string（不要落地，pipe 進 Secret Manager）
NEW_UID=<上一步輸出>
gcloud services api-keys get-key-string "$NEW_UID" \
  --project=photopoet-ha364 --format="value(keyString)" | \
firebase functions:secrets:set GOOGLE_GENAI_API_KEY \
  --project=photopoet-ha364 \
  --account=ipad@mail2.smes.tyc.edu.tw \
  --data-file=-

# 3. 必須 redeploy functions 才生效（gen2 secret binding 是部署快照）
firebase deploy --only functions \
  --project=photopoet-ha364 --force \
  --account=ipad@mail2.smes.tyc.edu.tw

# 4. 驗證新 key 能用後 24h，刪舊 key
gcloud services api-keys delete <OLD_UID> --project=photopoet-ha364
```

> ⚠️ **不能跳過 step 3**。Cloud Functions gen2 對 secret 是「部署當下快照」，不是實時跟 latest。

### 7.2 調整每日生詩上限
編輯 [functions/src/auth-quota.ts](functions/src/auth-quota.ts) 的 `DAILY_LIMIT`，redeploy functions 即可。

### 7.3 改 OG 預覽圖 / favicon
編輯 [scripts/generate-og-and-icon.mjs](scripts/generate-og-and-icon.mjs) → 跑 `npm run gen:og` → commit `public/og.png` + `src/app/icon.png`。

要加新中文字（OG 圖文案改變）：
1. 編輯 [scripts/subset-og-font.mjs](scripts/subset-og-font.mjs) 的 `USED_TEXT` 加字
2. `npm run subset:og-font`（重新 subset）
3. `npm run gen:og`（產 PNG）
4. commit 兩個新檔（subset ttf + 兩張 PNG）

### 7.4 加 Authorized Domain
（例如自訂 domain 上線時）

```bash
ACCESS_TOKEN=$(gcloud auth print-access-token --account=ipad@mail2.smes.tyc.edu.tw)
curl -X PATCH \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/photopoet-ha364/config?updateMask=authorizedDomains" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Goog-User-Project: photopoet-ha364" \
  -H "Content-Type: application/json" \
  -d '{"authorizedDomains":["localhost","photopoet-ha364.firebaseapp.com","photopoet-ha364.web.app","cagoooo.github.io","新.domain.com"]}'
```

同時：
- 加進 Cloudflare Turnstile widget 的 hostnames
- 加進 Browser API key 的 `allowedReferrers`

### 7.5 看 Functions log
```bash
firebase functions:log --only generatePoem --project=photopoet-ha364 --lines 50
# 或 GCP Console
# https://console.cloud.google.com/functions/list?project=photopoet-ha364&region=asia-east1
```

### 7.6 看誰用了多少（quota 觀測）
Firestore Console：https://console.firebase.google.com/project/photopoet-ha364/firestore/data/users

每個 `users/{uid}` 文件的 `usage` 欄位。

### 7.7 退 Quota（特殊情況讓某使用者重置）
Firestore Console 直接編輯該 user doc，把 `usage.count` 改成 `0` 或刪 `usage` 欄位即可。

---

## 8. 故障排除

| 症狀 | 排查 |
|---|---|
| 前端「以 Google 帳號登入」失敗 | (1) 看 console error；(2) Browser API key referrer 是否含當前 domain；(3) Firebase Auth authorized domains |
| 生詩回 401「請先用 Google 帳號登入」 | 沒帶 ID token 或 token expired — 重新登入 |
| 生詩回 403 turnstile 失敗 | Turnstile widget 沒載入或 token 過期 — Ctrl+F5 |
| 生詩回 429 已達上限 | 今日 20 首用完 — Firestore 看 `users/{uid}.usage`；要退 see 7.7 |
| 生詩回 500 + Functions log「Secret Version is in DISABLED state」 | rotate Gemini key 後忘了 redeploy functions — 跑 7.1 step 3 |
| Functions deploy 失敗：billing API 403 | github-deploy SA 漏了 billing.viewer（billing-account 層級） |
| GitHub Pages 跨域 fetch fail | (1) Functions cors:true？(2) authorized domain 含 cagoooo.github.io？(3) Browser key referrer 含 cagoooo.github.io/*？ |
| FB Sharing Debugger 顯示 403 | 通常是 Debugger 自己的 cache，OG meta 都對的；用 opengraph.xyz 或直接貼到 Slack/Discord/LINE 驗證 |
| GitHub Secret Scanning 跳警告 | 看是不是 Firebase Web API Key（這把是 public by design，dismiss as wont_fix）；其他 key 立刻 rotate |
| 部署後白屏 + Console TDZ error | 看 `firebase-ci-troubleshooter` skill Fix #14 |
| CI step 顯示 `-`（skipped） | secret 缺失或 if-condition 假；看 `firebase-ci-troubleshooter` skill Fix #15 |

---

## 9. 成本與額度

整套**正常使用全部在免費層內**：

| 服務 | 免費額度 | 預估月用量 |
|---|---|---|
| Firebase Hosting | 10 GB storage + 360 MB/day | ~10 MB / 數 GB 流量 |
| Cloud Functions gen2 | 2M invocations + 400k GB-seconds / 月 | 1 萬次生詩 ≈ 15k GB-s |
| Firestore | 50k reads + 20k writes + 1 GB / day | 1 萬次操作 |
| Gemini 2.0 Flash | 1500 RPD（免費層） | 看使用量 |
| Cloudflare Turnstile | 永久免費無上限 | – |
| GitHub Pages | 軟限制 100 GB/月 | 數 GB |
| GitHub Actions | 2000 分鐘/月（私 repo） | public repo 無限 |
| Artifact Registry | 0.5 GB free + cleanup-policy 1d | 設了 1 day cleanup |

**最容易爆的**：Gemini RPD 1500 — 加上 Auth + Quota（20/人/日）+ Turnstile，要爆需要 75+ 真人帳號每天用滿。實際上幾乎不會。

---

## 10. 安全模型

四層護欄，從外到內：

| 層 | 機制 | 阻擋什麼 |
|---|---|---|
| ① 邊緣 | robots.txt + Cloudflare Turnstile | 純 bot / 腳本 |
| ② 身份 | Firebase Auth ID token | 沒登入的匿名濫用 |
| ③ 額度 | Firestore transactional counter (20/uid/day) | 真人手動刷 |
| ④ 後端 | maxInstances + IAM | 系統超量保護 |

**API key 安全**：
- Gemini key：限制只能呼叫 `generativelanguage.googleapis.com`，存於 Secret Manager 不在 git
- Firebase Browser key：referrer 限制 + API restriction（自動 by Firebase）；這把是 public by design
- 任何「真機敏」secret（Turnstile secret、SA JSON）都走 Secret Manager 或 GitHub Secret，**從不出現在 source code**

**Firestore Rules**：
- Client SDK 只能讀**自己**的 `users/{uid}` + `poems/{poemId}` (where uid==auth.uid)
- 所有寫入走 Cloud Functions admin SDK（繞過 rules）

**SSRF 防護**（`proxyImage`）：
- 協定白名單（http/https）
- 私有 IP 黑名單（含 GCP metadata 169.254.169.254）
- DNS resolve 後 IP check（防 DNS rebinding）
- redirect 手動 follow（每跳重檢）
- Content-Type 檢查 + 10MB / 8s 上限

---

## 附錄 · 緊急聯絡與資源

- 主要操作帳號：`ipad@mail2.smes.tyc.edu.tw`（學校 Gmail，所有 Firebase / GCP owner）
- GitHub 帳號：`cagoooo`（綁 `cagooo@gmail.com`）
- Skill 文件（in `~/.claude/skills/`）：
  - `firebase-ci-troubleshooter`：CI / 部署 / 安全告警處理
  - `gcp-api-key-secure-create`：建立有限制的 GCP API key
  - `cloudflare-turnstile-integration`：Turnstile 整合
  - `firebase-stack-automation`：firebase + gcloud + gh CLI 自動化
  - `og-social-preview-zh`：OG 圖生成（中文不 tofu）
  - `pwa-cache-bust`：使用者看舊版時的 cache 排除
