# PhotoPoet **Pro** · 點亮詩意（早安長輩圖產生器）

> 上傳照片 → Gemini 2.0 Flash 生成繁體中文詩 → 一鍵下載長輩圖。

🌐 **線上使用：[點亮詩意~『早安長輩圖產生器』](https://cagoooo.github.io/PhotoPoet/)**

> 📌 **目前版本：v1.0.0**（版本管理自 2026-09-06 起，依據 `package.json`）

🌐 **線上版**：https://photopoet-ha364.web.app

**架構**：Next.js 15 (static export) + Firebase Hosting + Cloud Functions (gen2, asia-east1) + Genkit + Cloudflare Turnstile。

**安全**：
- Gemini API key 受限只能呼叫 `generativelanguage.googleapis.com`，存於 Firebase Secret Manager
- `proxyImage` 配 SSRF 防護（私有 IP 黑名單、redirect 重檢、Content-Type 白名單、10MB / 8s 上限）
- `generatePoem` 受 Cloudflare Turnstile 保護，無 token 直接 403

**CI/CD**：push 到 `main` → GitHub Actions 自動 deploy 到 Firebase。

- 📖 詳細使用說明：[docs/USAGE.md](docs/USAGE.md)
- 🛠️ 運維手冊：[docs/OPERATIONS.md](docs/OPERATIONS.md)
- 🗺️ 未來開發路線圖：[docs/ROADMAP.md](docs/ROADMAP.md)
- 📜 移植歷史記錄：[docs/MIGRATION_AND_OPTIMIZATION.md](docs/MIGRATION_AND_OPTIMIZATION.md)
- 🎯 原始產品需求：[docs/blueprint.md](docs/blueprint.md)

## 快速開始（本地）

```bash
# 1. 安裝依賴
npm install
npm install --prefix functions

# 2. 設定本地 Gemini key（不會 commit，只在本地 emulator 用）
cp .env.example .env
# 編輯 .env，填入新建的 GOOGLE_GENAI_API_KEY

# 3. 把 key 同時設給 Functions emulator
firebase functions:secrets:set GOOGLE_GENAI_API_KEY \
  --account=ipad@mail2.smes.tyc.edu.tw

# 4. Build 前端 + Functions
npm run build
npm run build --prefix functions

# 5. 開 emulator（Hosting 5000 / Functions 5001 / UI 4000）
firebase emulators:start

# 開瀏覽器：http://127.0.0.1:5000
```

## 部署

```bash
firebase deploy --account=ipad@mail2.smes.tyc.edu.tw
# 完成後：https://photopoet-ha364.web.app
```

---

<!-- BEGIN:PROJECT_GUIDE -->
## 專案導覽

圖片美化詩句

- 專案定位：數位內容／AI 創作工具專案
- Repository：`cagoooo/PhotoPoet`
- 可見性：公開
- 主要技術：TypeScript、React、Next.js、Firebase、Tailwind CSS
- 線上入口：<https://cagoooo.github.io/PhotoPoet/>

### 可以怎麼應用

- 製作教學素材、活動宣傳或學生創作成果
- 把重複的媒體整理、生成與輸出步驟自動化
- 替換模型、提示詞、版型或輸出規格後建立新的內容工作流

這些是依目前專案定位整理的延伸方向，不代表所有情境都已內建完成；實作前請先確認現有功能與資料格式。

### 技術與專案結構

- `README.md`
- `docs`
- `firebase.json`
- `functions`
- `package.json`
- `public`
- `scripts`
- `src`

檔案結構會隨版本演進；若本節與程式碼不一致，以目前預設分支的原始碼為準。

### 本機執行

```bash
npm install
# dev
npm run dev
# start
npm run start
# build
npm run build
# lint
npm run lint
```
請以 `package.json` 的 `scripts` 為準；若專案需要雲端服務，請先建立自己的環境變數與測試專案。

### 給 AI Agent 的接手指南

1. 先閱讀本 README、`AGENTS.md`（若有）、套件腳本與部署設定。
2. 先確認輸入、處理、輸出三個階段，以及模型／外部服務的邊界。
3. 保留來源、授權、個資與生成內容標示；不要把金鑰寫進前端或版本庫。
4. 修改後用一份最小素材走完整流程，檢查失敗處理與輸出品質。
5. 不要捏造尚未存在的功能；README 與實作有落差時，應同時更新文件。
6. 提交前只納入本次任務檔案，並記錄實際執行過的驗證。

### 安全與資料注意事項

- 不要提交 `.env`、服務帳號、API 金鑰、token、學生個資或正式環境匯出資料。
- 使用 Firebase、Supabase、Google API 或其他雲端服務時，請建立自己的測試專案並套用最小權限。
- 若要公開衍生作品，請先確認程式碼、圖片、音訊、字型與教材內容的授權。

### 貢獻與客製化

歡迎依教學現場、活動或工作流程需求進行 fork／客製化。建議在變更說明中交代使用情境、主要修改、測試方式，以及是否影響資料格式或部署設定。
<!-- END:PROJECT_GUIDE -->
