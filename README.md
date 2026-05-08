# PhotoPoet · 點亮詩意（早安長輩圖產生器）

> 上傳照片 → Gemini 2.0 Flash 生成繁體中文詩 → 一鍵下載長輩圖。

**架構**：Next.js 15 (static export) + Firebase Hosting + Cloud Functions (gen2, asia-east1) + Genkit。

- 詳細使用說明：[docs/USAGE.md](docs/USAGE.md)
- 移植 / 優化計畫：[docs/MIGRATION_AND_OPTIMIZATION.md](docs/MIGRATION_AND_OPTIMIZATION.md)
- 原始產品需求：[docs/blueprint.md](docs/blueprint.md)

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
