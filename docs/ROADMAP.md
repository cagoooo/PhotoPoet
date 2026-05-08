# PhotoPoet 開發路線圖（Roadmap）

> 版本：v1.0（2026-05-08）
> 狀態：Stage 1-4 + 雙部署 + 社群分享 + 維護手冊已全部結案
> 線上版：https://photopoet-ha364.web.app · https://cagoooo.github.io/PhotoPoet/

這份文件列出**還能做的優化與功能擴充**，按「**價值 × 工作量 × 技術難度**」分類。每個項目都有：

- **🎯 價值**：使用者體驗 / 安全 / 成本 / 觀測 / 業務
- **⏱️ 工作量**：⭐（30 分內） · ⭐⭐（2 小時內） · ⭐⭐⭐（半天） · ⭐⭐⭐⭐（一天以上）
- **🛠️ 技術難度**：1（純 config） · 2（前端 / 後端改一處） · 3（跨層協調） · 4（架構改動）
- **🔗 相關 skill**：可觸發哪份 skill 自動化執行
- **📋 實作大綱**：直接動手所需步驟（避免之後又要研究）

---

## 目錄

- [快速勝利（Quick Wins）](#-快速勝利quick-wins)
- [體驗強化（UX）](#-體驗強化ux)
- [功能擴充（Features）](#-功能擴充features)
- [內容流通（Sharing & Distribution）](#-內容流通sharing--distribution)
- [安全與韌性](#-安全與韌性)
- [可觀測性（Observability）](#-可觀測性observability)
- [品質保證（QA）](#-品質保證qa)
- [長期願景](#-長期願景)
- [刻意不做的事](#-刻意不做的事)
- [優先順序建議](#-優先順序建議)

---

## ✅ 快速勝利（Quick Wins）

> 都在 30 分鐘到 2 小時內可完成、立即看得到效果。

### Q1. 加入「重新生成」按鈕
**🎯 價值**：UX — 使用者覺得詩不滿意時能重生而不必重傳照片
**⏱️ 工作量**：⭐⭐
**🛠️ 技術難度**：2

**📋 實作大綱**
1. `page.tsx` 在「複製詩句」按鈕旁加「✨ 換一首」按鈕
2. 重新呼叫 `/api/generate`（用同一張照片 + 新 turnstileToken），消耗 1 次 quota
3. 在 prompt 加 randomness：
   ```ts
   prompt: `... 這首詩必須是繁體中文。請以全新角度詮釋這張照片，避免重複先前可能產生的詩句。`
   ```
4. 後端可選：加 `temperature: 0.9` 進 Genkit config 讓多樣性更高

---

### Q2. 加入詩文風格選擇
**🎯 價值**：UX — 增加趣味性 + 教學情境多樣
**⏱️ 工作量**：⭐⭐
**🛠️ 技術難度**：2

**📋 實作大綱**
1. 前端加 `<Select>` 元件（用既有 shadcn/ui）：「現代詩」「七言絕句」「五言絕句」「俳句」「台語白話」「長輩問候語」
2. POST body 加 `style` 欄位
3. Functions 內 prompt 動態組合：
   ```ts
   const stylePrompts = {
     modern: '創作一首自由形式的現代詩。',
     'seven-jueju': '創作一首四句、每句七字的繁中絕句。',
     haiku: '創作一首三句俳句（5-7-5 字節奏）。',
     elder: '創作一句溫暖正向的早安祝福問候語。',
     // ...
   };
   ```
4. 順便把這個 `style` 也存進 `poems/{id}` 文件，未來可以做「我的不同風格收藏」

---

### Q3. 「我的詩歷史」頁
**🎯 價值**：使用者已登入，但目前看不到自己過去寫的詩 — 浪費了 Stage 4 已存的 Firestore 資料
**⏱️ 工作量**：⭐⭐⭐
**🛠️ 技術難度**：2

**📋 實作大綱**
1. 新建 `src/app/history/page.tsx`（client component）
2. 用 `firebase/firestore` query：
   ```ts
   query(
     collection(db, 'poems'),
     where('uid', '==', user.uid),
     orderBy('createdAt', 'desc'),
     limit(20)
   )
   ```
3. 用 react-query / SWR 做分頁（已 `firestore.indexes.json` 建好 uid+createdAt index）
4. 主頁 AuthBar 加「📜 我的詩」按鈕連結
5. **必加**：`admin-route-back-to-home` skill 已強制要求「回主頁」按鈕

**注意**：列表頁的 Firestore query 需要 client SDK 帶 ID token（已自動）+ `firestore.rules` 的 `allow list` 規則允許 `request.auth.uid == request.query.where[0][2]` —— 已寫在 [firestore.rules](firestore.rules:18) 內 ✅

---

### Q4. 主頁加 onboarding 「📖 使用說明」彈窗
**🎯 價值**：給家長 / 老師看的時候不必看 README，第一次打開就知道怎麼用
**⏱️ 工作量**：⭐⭐
**🛠️ 技術難度**：2
**🔗 相關 skill**：`teaching-app-quickstart`（自動觸發）

**📋 實作大綱**
直接觸發 `teaching-app-quickstart` skill。它會：
1. 在 TopNav 加「📖 使用說明」按鈕
2. 寫 `<Dialog>` 元件含 4-5 步操作說明（搭配截圖）
3. 加 localStorage 記錄「已看過」，第二次來不再自動彈

---

### Q5. 頁尾加上「Made with ❤️ by 阿凱老師」
**🎯 價值**：作者署名（個人作品慣例）
**⏱️ 工作量**：⭐
**🛠️ 技術難度**：1
**🔗 相關 skill**：`akai-author-footer`（必須主動觸發）

**📋 實作大綱**
觸發 skill `akai-author-footer`，自動把標準 footer + 連結到學校教師頁加進 `layout.tsx` 或主 page。

---

### Q6. 加「Loading 動畫」更貼近詩意
**🎯 價值**：UX — 目前生詩中只有按鈕變「詠唱中...」，可加更詩意的視覺回饋
**⏱️ 工作量**：⭐⭐
**🛠️ 技術難度**：2

**📋 實作大綱**
- 用 CSS animation 做毛筆字跡浮現效果，或用 lucide-react 既有 icon 做旋轉光點
- 顯示在「詩詞區塊」的 placeholder 裡

---

## 🎨 體驗強化（UX）

### U1. PWA + Service Worker（離線可裝桌面）
**🎯 價值**：使用者可「安裝」到手機桌面，且基本介面離線也能載入
**⏱️ 工作量**：⭐⭐⭐
**🛠️ 技術難度**：3
**🔗 相關 skill**：`pwa-cache-bust`

**📋 實作大綱**
1. `npm install next-pwa` 或手寫 SW
2. `manifest.json` 在 `public/`：
   ```json
   {
     "name": "PhotoPoet 點亮詩意",
     "short_name": "PhotoPoet",
     "icons": [{"src":"/icon.png","sizes":"512x512","type":"image/png"}],
     "theme_color":"#7e22ce",
     "background_color":"#ffffff",
     "display":"standalone",
     "start_url":"/"
   }
   ```
3. `layout.tsx` 加 `<link rel="manifest">` 跟 `<meta theme-color>`
4. SW 策略：
   - 字體 / 圖片 / chunks → cache-first
   - `/api/*` → network-only（每次要新詩）
   - 主 HTML → network-first（更新即時）
5. **注意 PWA 快取陷阱**：搭配 `pwa-cache-bust` skill 加版本號 query string，避免使用者卡舊版

**收益**：行動裝置使用者可 add to home screen，看起來像原生 app。

---

### U2. 自訂域名（custom domain）
**🎯 價值**：好記、品牌感、SEO 友善
**⏱️ 工作量**：⭐⭐
**🛠️ 技術難度**：2

**📋 實作大綱**
1. 買域名（例如 `photopoet.tw` 或子網域 `poem.smes.tyc.edu.tw`）
2. Firebase Console → Hosting → Add custom domain → 跟著 DNS 驗證流程
3. **同步更新四處設定**：
   - Cloudflare Turnstile 的 Hostnames 加新域名
   - Firebase Auth Authorized domains 加新域名
   - Browser API key 的 `allowedReferrers` 加新域名
   - `src/app/layout.tsx` 的 `SITE_URL` / `metadataBase` 改成新域名
4. 更新 OG image URL 改成新域名

---

### U3. Dark Mode
**🎯 價值**：現代 app 標配，半夜用不刺眼
**⏱️ 工作量**：⭐⭐⭐
**🛠️ 技術難度**：2

**📋 實作大綱**
- shadcn/ui 已有 `next-themes` 整合（既有 dependency 都到位）
- 加 `<ThemeProvider>` 包 layout
- 加切換按鈕在 AuthBar
- `globals.css` 已有 dark variant，幾乎免改

---

### U4. 國際化（i18n: zh-TW / en）
**🎯 價值**：擴大使用者群（國際師生 / 海外華人）
**⏱️ 工作量**：⭐⭐⭐⭐
**🛠️ 技術難度**：3

**📋 實作大綱**
1. `next-intl` 在 static export 模式可用，或自己用簡易 dictionary
2. URL 結構：`/zh-TW/`、`/en/`
3. **prompt 也要切**：
   ```ts
   const prompts = {
     'zh-TW': '你是一位詩人...這首詩必須是繁體中文。',
     'en': 'You are a poet. Create a short poem... in English.',
     'ja': 'あなたは詩人です...日本語で書いてください。',
   };
   ```
4. 加 locale switcher

---

### U5. 大字版 / 無障礙
**🎯 價值**：給長輩使用者 / 視覺障礙者
**⏱️ 工作量**：⭐⭐
**🛠️ 技術難度**：2

**📋 實作大綱**
- 加「字體放大」切換（root font-size 從 16 → 20px）
- ARIA labels 補齊
- 顏色對比 audit（用 axe DevTools 跑一遍）

---

## 🚀 功能擴充（Features）

### F1. 詩文「妙用長輩圖」批次模式
**🎯 價值**：一次上傳多張照片 → 各自生詩 → 一次下載
**⏱️ 工作量**：⭐⭐⭐⭐
**🛠️ 技術難度**：3

**📋 實作大綱**
- 前端：multi-file `<input>` + 列表化進度顯示
- 注意 quota：每張消耗 1 次（20 上限），到了就停
- ZIP 打包：用 `jszip` client-side 打包 + 下載

---

### F2. 詩文評分 + 重生機制（生成後 thumbs up/down）
**🎯 價值**：收集 prompt 品質回饋，未來可調 prompt
**⏱️ 工作量**：⭐⭐⭐
**🛠️ 技術難度**：3

**📋 實作大綱**
- 詩生成後加「👍 / 👎」
- 點 👎 + 「重新生成」直接 retry，並記錄到 Firestore `poems/{id}.feedback`
- 之後可分析高評分的詩特徵，回過頭調 prompt

---

### F3. 多模型支援（Gemini / GPT-4o / Claude 3.5 比較）
**🎯 價值**：教學情境可比較不同 AI 寫詩風格差異
**⏱️ 工作量**：⭐⭐⭐⭐
**🛠️ 技術難度**：3
**🔗 相關 skill**：`claude-api`（如果加 Anthropic）

**📋 實作大綱**
- 後端加 model selector（環境變數選擇用哪家）
- Genkit 支援 `@genkit-ai/openai` plugin
- Anthropic 用 Anthropic SDK
- **成本控制**：免費額度只 Gemini 有，加付費 model 必須限制（每天某個 quota / 老師帳號專屬）

---

### F4. 圖文 export 多版型（IG story 9:16 / 桌布 16:9 / 紙本 A4）
**🎯 價值**：使用者實際拿來用的場景多樣
**⏱️ 工作量**：⭐⭐⭐
**🛠️ 技術難度**：2

**📋 實作大綱**
- 把 `generateEmbedImageDataUrl` 改寫成接受 `format` 參數
- 預設模板：square / story (9:16) / wide (16:9) / a4 (300dpi for printing)
- UI 加 dropdown 選版型

**注意**：A4 列印用 `window.print() + @media print` CSS 才正確（觸發 skill `pdf-export-print-best-practice`）

---

### F5. 「每日精選詩文牆」
**🎯 價值**：社群感 — 看別人寫的好詩
**⏱️ 工作量**：⭐⭐⭐⭐
**🛠️ 技術難度**：3

**📋 實作大綱**
- 寫詩時加「✅ 公開分享」checkbox（默認不開）
- 公開的詩寫入 `poems/{id}.isPublic: true`
- 新頁面 `/wall`：query 公開詩，按時間排序 / 按讚排序
- 加「點讚」功能（每人每詩 1 次，記錄在 `poems/{id}.likes` map）
- **內容審查**：管理員能下架（看 F8 admin dashboard）

---

### F6. 公開單首詩的分享頁（per-poem OG image）
**🎯 價值**：分享連結到 LINE 時，OG 預覽顯示**那首詩本身的圖**而非通用 OG
**⏱️ 工作量**：⭐⭐⭐⭐
**🛠️ 技術難度**：4

**📋 實作大綱**
- 詩公開後，產生 `/p/{poemId}` 路由（這需要 Cloud Function 動態 SSR，因為 static export 沒辦法）
- 或者：用 Cloud Function 動態產生 `/p/{poemId}.png`（用 @napi-rs/canvas 跟 [scripts/generate-og-and-icon.mjs](scripts/generate-og-and-icon.mjs) 一樣的方法）
- 把 OG meta 直接寫進那個 Cloud Function 回的 HTML

**注意**：架構改動 — 變成 hybrid（部分 static + 部分 SSR），複雜度上升

---

## 🌐 內容流通（Sharing & Distribution）

### S1. LINE Bot 模式（傳照片給 Bot 直接出詩）
**🎯 價值**：使用者不用開瀏覽器，直接在 LINE 用
**⏱️ 工作量**：⭐⭐⭐⭐
**🛠️ 技術難度**：3
**🔗 相關 skill**：`line-messaging-firebase`（已串好流程）

**📋 實作大綱**
1. LINE Developer Console 建 Messaging API channel
2. 用 skill `line-messaging-firebase` 建 webhook function：
   - 收到 message event → 如果是 image → 下載 → 走 generatePoem flow → reply 詩文
   - 如果是 text → 簡單 echo / 引導使用網頁版
3. 加 LINE Login（取代或輔助 Google Login，國內使用者更熟悉）

---

### S2. Telegram Bot
**🎯 價值**：對外國使用者更友善（國際版）
**⏱️ 工作量**：⭐⭐⭐
**🛠️ 技術難度**：3

**📋 實作大綱**
類似 LINE Bot 流程：webhook function → Telegram Bot API。

---

### S3. PWA Push Notification（每日詩意提醒）
**🎯 價值**：每天 9:00 push「來生一首晨間詩吧」，提升使用者黏度
**⏱️ 工作量**：⭐⭐⭐⭐
**🛠️ 技術難度**：4

**📋 實作大綱**
1. 設 Firebase Cloud Messaging
2. 前端註冊 SW + permission prompt
3. Cloud Function with cron：每天某時間段 batch send
4. **倫理**：只給明確 opt-in 的使用者推送，且設「我已生過今天」就不推

---

### S4. 詩文 fork / remix 機制
**🎯 價值**：看別人的詩，可以「換我用這張照片再寫一首」
**⏱️ 工作量**：⭐⭐⭐
**🛠️ 技術難度**：3

**📋 實作大綱**
- 從別人公開的詩進入「fork」流程：自動載入照片、保留原作引用
- Firestore: `poems/{id}.forkedFrom` 記錄祖先

---

## 🔒 安全與韌性

### P1. 自動備份 Firestore（每日）
**🎯 價值**：誤刪 / 規則漂移時可還原
**⏱️ 工作量**：⭐⭐
**🛠️ 技術難度**：2

**📋 實作大綱**
1. 建 Cloud Storage bucket `photopoet-ha364-backups`
2. 加 GCS lifecycle 規則：30 天後自動刪除
3. 寫 scheduled Cloud Function：
   ```ts
   import {onSchedule} from 'firebase-functions/v2/scheduler';
   export const dailyBackup = onSchedule('every day 03:00', async () => {
     await firestore.exportDocuments({
       outputUriPrefix: `gs://photopoet-ha364-backups/${new Date().toISOString().slice(0,10)}`,
       collectionIds: ['users', 'poems'],
     });
   });
   ```

---

### P2. IP 速率限制（除了 user-level quota，再加 IP-level）
**🎯 價值**：同一個 IP 用 20 個帳號注入 → 還是會被擋
**⏱️ 工作量**：⭐⭐⭐
**🛠️ 技術難度**：3

**📋 實作大綱**
- 在 Firestore 加 `rate_limits/{ip}` collection
- generatePoem 開頭：取 client IP → check + inc counter（5 RPM/IP）
- 用 transaction 確保 race-free
- TTL 自動清理：使用 Firestore TTL 政策（field：`expiresAt`）

---

### P3. Firebase App Check（防 reverse-engineered API 直連）
**🎯 價值**：阻止「不是從合法 frontend 來的」呼叫
**⏱️ 工作量**：⭐⭐⭐
**🛠️ 技術難度**：3
**🔗 相關 skill**：`firebase-ci-troubleshooter` (Fix #12)

**📋 實作大綱**
1. Firebase Console → App Check → Register Web app（用 reCAPTCHA Enterprise）
2. 前端 `initializeAppCheck`
3. **先用 Unenforced 模式跑 1-2 天**，看 logs 確認沒誤殺合法流量
4. 確認 OK 後對 Functions 設 `enforceAppCheck: true`

> 注意：跟 Cloudflare Turnstile **角色重疊**。如果 Turnstile 已夠用，App Check 是 belt-and-suspenders；要做的話兩者並用。

---

### P4. 內容審查（防仇恨 / 不當圖片）
**🎯 價值**：教學環境裡的 PG 內容把關
**⏱️ 工作量**：⭐⭐⭐
**🛠️ 技術難度**：3

**📋 實作大綱**
- 在送 Gemini 前先用 Cloud Vision API SafeSearch 過濾不當圖片
- 或用 Gemini 的 safety_settings 直接 block
- 公開詩文牆加 admin 下架按鈕

---

## 📊 可觀測性（Observability）

### O1. Sentry / Cloud Logging dashboard
**🎯 價值**：使用者 1 個月後遇到 bug 你不會即時知道
**⏱️ 工作量**：⭐⭐
**🛠️ 技術難度**：2

**📋 實作大綱**
- Sentry：前端 + Functions 都接（每月免費 5k events）
- 或用 GCP Cloud Logging 過濾 `severity>=ERROR`，加 alert policy
- 結構化 log：每次 generatePoem 寫
  ```ts
  console.log(JSON.stringify({event: 'poem_generated', uid, latencyMs, model: 'gemini-2.0-flash'}));
  ```
- 之後可導 BigQuery / Looker Studio 做 dashboard

---

### O2. LINE 推播管理員告警
**🎯 價值**：嚴重錯誤即時推到 LINE，不必開 Console 查
**⏱️ 工作量**：⭐⭐
**🛠️ 技術難度**：2
**🔗 相關 skill**：`line-messaging-firebase`

**📋 實作大綱**
- Cloud Function 監控錯誤事件 → 推送到 LINE 管理員帳號
- 細節：頻率限制（同類 error 1 小時內只推 1 次）

---

### O3. 使用者統計儀表板（admin only）
**🎯 價值**：看「今日活躍使用者」「平均每人生詩數」「Quota 命中率」
**⏱️ 工作量**：⭐⭐⭐
**🛠️ 技術難度**：3

**📋 實作大綱**
- 新建 `/admin/stats` 頁（強制驗證 admin email allowlist）
- 從 Firestore aggregate users / poems
- 用 recharts（已是 dependency）畫趨勢圖
- **必加** `admin-route-back-to-home` skill 觸發要求的「回主頁」按鈕

---

### O4. Firestore 用量觀測
**🎯 價值**：避免哪天突然超免費額度
**⏱️ 工作量**：⭐
**🛠️ 技術難度**：1

**📋 實作大綱**
- GCP Console → Quotas → Filter Firestore → 設「達 80% free quota 時 email 提醒」
- 或者用 Cloud Monitoring alert policy

---

## 🧪 品質保證（QA）

### T1. E2E 測試（Playwright）
**🎯 價值**：未來改 code 時，自動測「能登入 + 能生詩」
**⏱️ 工作量**：⭐⭐⭐
**🛠️ 技術難度**：3

**📋 實作大綱**
1. `npm install -D @playwright/test`
2. 寫 5 個關鍵測試：
   - 主頁載入無 console error
   - Auth gate（未登入按生詩 → 跳「請先登入」toast）
   - Login flow（mock Google popup or 用 test account）
   - 上傳照片 → 等 30 秒 → 看到詩出現
   - 生詩超 quota 時看到 429 訊息
3. CI 加 step：`npx playwright test`
4. 對 Gemini API 用 `route.fulfill` mock，避免測試真打 API（省 quota + 加快）

---

### T2. Functions Unit Test
**🎯 價值**：改 quota 邏輯 / SSRF 邏輯時不容易 regression
**⏱️ 工作量**：⭐⭐⭐
**🛠️ 技術難度**：3

**📋 實作大綱**
- `functions/test/` 加 vitest 測 `auth-quota.ts`、`turnstile.ts`
- 用 `@firebase/rules-unit-testing` 跑 Firestore rules 測試
- CI 加 `npm run test --prefix functions`

---

### T3. Lighthouse CI
**🎯 價值**：保證效能不退步
**⏱️ 工作量**：⭐⭐
**🛠️ 技術難度**：2

**📋 實作大綱**
- GitHub Action 用 `treosh/lighthouse-ci-action`
- 設 budget：performance > 90、accessibility > 90、best-practices > 90、SEO > 95

---

## 🌌 長期願景

### V1. 學校教師專用版
**🎯 價值**：把這套變成 SMES 桃園市石門國小的教學工具
**⏱️ 工作量**：⭐⭐⭐⭐
**🛠️ 技術難度**：4

**📋 實作大綱**
- 老師帳號 → 學生組綁定（Firestore：teachers, classes, students collection）
- 老師看自己班學生的詩
- 班級限額（一個 class 共享 quota，老師可調分配）
- 詩作展示牆 / 投影模式

---

### V2. 圖片儲存 + 翻翻書
**🎯 價值**：讓使用者把每首詩 + 照片做成「我的詩集」
**⏱️ 工作量**：⭐⭐⭐⭐
**🛠️ 技術難度**：4

**📋 實作大綱**
- 啟用 Firebase Storage（成本：免費 5GB）
- 上傳照片 → 存 Storage → URL 寫進 `poems/{id}.photoUrl`
- 翻翻書 view 用 `react-flip-page` 之類元件

**成本提醒**：每張原圖 ~2MB，免費額度只能存 ~2500 張。要做這功能要先想好成本控制。

---

### V3. 詩文 print on demand（合作印刷）
**🎯 價值**：使用者把詩集印成精裝本（變現可能）
**⏱️ 工作量**：⭐⭐⭐⭐⭐
**🛠️ 技術難度**：4
**📋 實作大綱**
- 整合 print-on-demand 服務（如 Printful, Lulu）
- 收益分成（學校公益 vs 個人）

---

## ❌ 刻意不做的事

| 項目 | 為什麼不做 |
|---|---|
| **改寫 Functions 為 Edge Functions / Cloudflare Workers** | 現在 Cloud Functions 在免費額度內運作正常；遷移成本高、收益低 |
| **加 OpenTelemetry / Distributed Tracing** | 規模還沒到需要這個 |
| **服務化拆分（多個 Cloud Run service）** | 保持單一 codebase 清爽，目前才 2 個 endpoint |
| **加付費訂閱機制（Stripe）** | 偏離教學工具初衷；如真要做變成 V1 學校版 |
| **改用 Server Components / 取消 static export** | 失去 GitHub Pages 雙部署能力，且 hosting 成本上升 |
| **棄用 Genkit 改直接呼叫 Gemini SDK** | Genkit 在 prompt 管理 / flow 抽象上有優勢，沒必要拆 |

---

## 🎯 優先順序建議

如果你只能挑 5 件做，我推薦這個順序：

| # | 項目 | 為什麼是這個順序 |
|---|---|---|
| 1 | **Q3「我的詩歷史」頁** | Stage 4 已存資料但看不到，立刻補完是最有「即時收穫感」的 |
| 2 | **Q5 加 footer + Q4 onboarding** | 阿凱老師作品標記 + 新使用者門檻降低，整體完整度提升 |
| 3 | **Q1 重新生成 + Q2 風格選擇** | 30 分鐘的 UX 大躍進，使用者「想再玩」的動機強 |
| 4 | **U1 PWA** | 行動裝置體驗從「網頁」變「應用」，加分巨大且工作量中等 |
| 5 | **O1 Sentry + O2 LINE 告警** | 上線後最該有的「夜裡能睡得著」基本盤 |

---

## 📅 建議節奏

- **本週末**（2-3 hr）：Q1 + Q2 + Q3 + Q5 — 一次補齊使用者面所有缺口
- **本月內**（半天）：Q4 onboarding + U1 PWA + O1 Sentry — 上線品質完備
- **下個月**（一天）：U2 自訂域名 + T1 E2E 測試 — 進入「正式服務」階段
- **長期**（看興趣）：S1 LINE Bot / V1 學校教師版 / V2 詩集 — 由教學情境驅動

---

## 🤝 接手者須知

要在這個 roadmap 上動手前，先讀：
1. **[OPERATIONS.md](OPERATIONS.md)** — 知道現在的架構長怎樣、有哪些 secrets 與 IAM
2. **[USAGE.md](USAGE.md)** — 知道 app 是給誰用 / 怎麼用
3. 找對應的 **`~/.claude/skills/*`**（每個 task 上面都有列）

新功能 PR 前 checklist：
- [ ] 加進 `OPERATIONS.md §7 常見維護任務`（如果改變了維護方式）
- [ ] `npm run build` + `npm run build --prefix functions` 過
- [ ] 部署到 emulator 跑一遍
- [ ] 開無痕視窗驗證 production（避開 PWA / SW cache）
- [ ] 該項目從本 roadmap 移除（或標 ✅）

---

> 💡 **本文件會隨開發進度持續更新**。完成的項目移到 OPERATIONS.md / 加註 ✅；新發現的優化方向直接補進來。
