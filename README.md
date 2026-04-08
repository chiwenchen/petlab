# PetLab

把寵物紙本健檢報告變成結構化、可追蹤、可分享的數據紀錄。

> v1 為米寶量身打造（12 歲 Maine Coon，淋巴瘤化療中）。
> 為什麼有這個專案：跨醫院求醫時飼主需要把所有歷史報告一次帶給醫生看，但紙本翻拍找不到關鍵資訊。

## Architecture

```
iOS app (SwiftUI)        →  Cloudflare Workers (Hono)  ←  Cloudflare Pages (Next.js)
飼主的資料輸入管道            api.petlab.redarch.dev          petlab.redarch.dev
                                    ↓                              ↑
                              D1 + R2 + Claude Vision        醫生的閱讀介面
```

- **iOS app** — 飼主端，多選照片批次上傳、OCR、編輯、分享
- **Backend (apps/api)** — Cloudflare Workers + Hono + D1 + R2，OCR 透過 Claude Vision API
- **Web viewer (apps/web)** — Next.js on Cloudflare Pages，醫生點 share link 看到的頁面，包含完整時間軸 + 趨勢圖

## Repo layout

```
petlab/
├── apps/
│   ├── api/          Cloudflare Workers (Hono) backend
│   ├── web/          Next.js web viewer for vets
│   └── ios/          SwiftUI iOS app
├── docs/
└── README.md
```

## Setup (backend)

```bash
cd apps/api
bun install

# Cloudflare resources (run once)
wrangler d1 create petlab
# 把回傳的 database_id 填到 wrangler.toml

wrangler r2 bucket create petlab-images

# Migrations
wrangler d1 migrations apply petlab --local   # local dev
wrangler d1 migrations apply petlab --remote  # production

# Secrets
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put RESEND_API_KEY
wrangler secret put JWT_SECRET   # 任何長 random string

# Dev
bun run dev
# → http://localhost:8787

# Deploy
bun run deploy
```

## Status

- [x] Phase 0: 前置 + repo skeleton
- [ ] Phase 1: Backend auth + pets CRUD  ← **進行中**
- [ ] Phase 2: OCR endpoint
- [ ] Phase 3: Web viewer
- [ ] Phase 4: iOS skeleton
- [ ] Phase 5: iOS capture flow
- [ ] Phase 6: iOS sharing
- [ ] Phase 7: Xcode 直裝手機
- [ ] Phase 8: 米寶 4/13 回診實戰

詳細計畫：[../petlab-impl-plan-20260408-235522.md](../petlab-impl-plan-20260408-235522.md)
