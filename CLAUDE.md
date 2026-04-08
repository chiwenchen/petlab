# PetLab — Claude Context

> Project-specific instructions for Claude Code. Reads on every session. Keep tight.

## What this is

把寵物紙本健檢報告變成結構化、可追蹤、可分享的數據紀錄。

**第一個 (and only) v1 user：米寶** — 12 歲 Maine Coon，淋巴瘤化療中。
**真實截止日：2026-04-13 週一回診**。所有 v1 範圍以「能在那天用」為準。

The vet experience is the entire deliverable. iOS app is the data pipe. Web viewer
is the product face. Trust is the foundation — everything that erodes "this looks
like a real thing" gets cut.

## Architecture

```
iOS app (SwiftUI)  →  Cloudflare Workers (Hono)  ←  Next.js (Cloudflare Pages)
飼主資料輸入管道       api.petlab.redarch.dev          petlab.redarch.dev
                            ↓                              ↑
                      D1 + R2 + Claude Vision        醫生看的閱讀介面
```

- **Backend** — `apps/api`. Hono on Workers. D1 for relational, R2 for images.
  OCR via Claude Vision (`claude-opus-4-6` / `claude-sonnet-4-6`). Email OTP via Resend.
- **Web viewer** — `apps/web` (Phase 3, 尚未存在). Next.js SSR, recharts for trends,
  no SPA complexity. Public read by share token, no auth.
- **iOS** — `apps/ios` (Phase 4, 尚未存在). SwiftUI, native, distributed via Xcode
  free provisioning (7-day cert) for v1 — 不等 TestFlight 審核。Possibly WKWebView
  the trends page from web viewer to avoid maintaining two chart implementations.

### Why D1 not Postgres
v1 的 schema 簡單、寫入流量極低、不需要 pgvector。D1 + Cloudflare 一條龍少一個外
部服務要管。當 v1.5+ 加 AI 解讀 / 語意搜尋時再評估遷移到 Neon (Postgres)，遷移
成本是一個下午。

### Why Cloudflare end-to-end
redarch.dev 已經在 Cloudflare、wrangler 已登入、一個帳單一個 dashboard。Workers +
D1 + R2 + Pages 同生態，免費 tier 對 v1 綽綽有餘。

## Repo layout

```
petlab/
├── apps/
│   ├── api/          Cloudflare Workers (Hono) backend
│   ├── web/          Next.js web viewer (Phase 3)
│   └── ios/          SwiftUI iOS app (Phase 4)
├── .github/workflows/
│   ├── auto-approve.yml   auto-approve chiwenchen 的 PR
│   ├── auto-merge.yml     PR open → squash auto-merge
│   └── test.yml           bun install + typecheck on PR to main
├── CLAUDE.md         （本檔）
└── README.md
```

## Branch protection — IMPORTANT

main 是受保護的。**從不直接 push 到 main**。違反規則的 push 會被 GitHub 拒絕。

Active rulesets:
1. **Protect main** — block delete, block force push, 必須 `test` 狀態檢查通過
2. **Copilot review for default branch** — 必須 signed commits、1 PR approval、
   Copilot code review、block delete/force push

### Standard workflow for any code change

```bash
git checkout -b <type>/<short-description>     # feat/ fix/ chore/ docs/ refactor/
# ...write code...
git commit -S -m "<type>(<scope>): <subject>"  # -S 強制簽章（GPG key A7CCED43...）
git push -u origin <branch>
gh pr create --title "..." --body "..."
# 自動發生:
#   - Auto Approve workflow approves the PR
#   - Auto Merge workflow enables squash auto-merge
#   - Test workflow runs bun run typecheck
#   - Copilot code review
#   - All green → squash merged → branch auto-deleted
# 一般 ~25-60 秒從 push 到 merged
```

After merge, sync local:
```bash
git checkout main && git pull
```

### Commit message format
```
<type>(<scope>): <subject>

<optional body>
```
- types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `perf`
- scopes: `api`, `web`, `ios`, `db`, `auth`, `ocr`, `share`
- subject: imperative, lowercase, no period
- 範例: `feat(api): claude vision OCR endpoint`

### Never
- Direct push to `main`
- `git push --force` to `main`
- `--no-verify` / `--no-gpg-sign` (簽章是強制的)
- 把 secrets 寫到任何會被 commit 的檔案
- Commit `apps/api/.dev.vars`（已 gitignored）

## Local dev (apps/api)

```bash
cd apps/api
bun install
bunx wrangler d1 migrations apply petlab --local
bunx wrangler dev          # http://localhost:8787
bun run typecheck          # 在 push 前一定要 pass，因為 CI 會跑
```

Smoke test endpoints:
```bash
curl -s http://localhost:8787/                                                         # health
curl -s -X POST http://localhost:8787/auth/request -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com"}'
curl -s -X POST http://localhost:8787/auth/verify -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","code":"123456"}'
curl -s http://localhost:8787/pets -H "Authorization: Bearer <jwt>"
```

### Secrets
- **Local dev:** `apps/api/.dev.vars` (gitignored). Contains `RESEND_API_KEY`,
  `JWT_SECRET`, `ANTHROPIC_API_KEY`, `OTP_FROM_EMAIL`.
- **Production:** `wrangler secret put <NAME>` — 互動式輸入，不留痕跡。
- **絕對不要** 把 key 貼進任何聊天視窗、issue、PR、commit。一旦出現在 transcript
  就視為洩漏，必須 revoke + 重開。

### Cloudflare resources (one-time setup)
```bash
bunx wrangler d1 create petlab           # → 把 database_id 填到 wrangler.toml
bunx wrangler r2 bucket create petlab-images
bunx wrangler secret put ANTHROPIC_API_KEY
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put JWT_SECRET
bunx wrangler secret put OTP_FROM_EMAIL
```

## Code conventions

### Backend (TypeScript / Hono)
- TypeScript strict mode, no `any` unless unavoidable
- Web Crypto API instead of Node crypto packages (Workers runtime)
- 自寫 minimal helpers > 拉大 dependency（JWT 是自寫的，no `jose`）
- Hono route files 一個 resource 一個檔案 (`routes/auth.ts`, `routes/pets.ts`, ...)
- DB queries 用 raw `prepare(...).bind(...)` — no ORM in v1
- 每個 row interface 在 `lib/db.ts` 集中定義
- nanoid IDs，alphabet 排除 `0/O/1/l/I` (見 `lib/ids.ts`)

### Errors
- HTTP 4xx for client error，5xx for server error
- Response shape: `{ error: "snake_case_code", message?: string }`
- Logging: `console.error("context", err)` — Workers logs go to wrangler tail / Cloudflare dashboard

### Soft delete
所有 user-data table 用 `deleted_at` (nullable INTEGER unix seconds)，不硬刪。
唯一例外：用戶刪帳號 — 那時候硬刪 (GDPR-style，align with「信任是基礎」)。

## v1.0-Monday scope (locked)

**Keep:**
- Email OTP 登入
- 寵物寫死米寶（首次自動建）
- 多選相片批次上傳 → OCR → 飼主 review/edit → 存
- 報告列表 + 單筆完整數據
- 「分享給醫生」→ token → iOS share sheet → LINE
- Web viewer：完整時間軸 + 趨勢圖 (recharts) + 並排對比

**Cut to v1.1+:**
- ❌ 多寵物 UI（schema 已支援）
- ❌ Trends 在 iOS 內 (考慮用 WKWebView 嵌 web viewer)
- ❌ 已分享連結列表 / 撤銷
- ❌ 用藥/餵食記錄
- ❌ AI 解讀
- ❌ 提醒/通知
- ❌ PDF 下載
- ❌ Android / iPad / Apple Watch

## Phase status

- [x] **Phase 0** — Repo skeleton + monorepo
- [x] **Phase 1** — Backend auth + pets CRUD
- [ ] **Phase 2** — OCR endpoint (`POST /reports`, single + batch)
- [ ] **Phase 3** — Next.js web viewer
- [ ] **Phase 4** — iOS skeleton + auth flow
- [ ] **Phase 5** — iOS capture + OCR happy path
- [ ] **Phase 6** — iOS sharing
- [ ] **Phase 7** — Xcode 直裝手機
- [ ] **Phase 8** — 米寶 4/13 回診實戰

詳細計畫: `../petlab-impl-plan-20260408-235522.md` (在 repo parent dir，未進 git)
原始設計文件: `../petlab-design-20260408-233739.md`

## Pre-flight check (start of every session)

1. `pwd` — 確認在 `~/Documents/repos/petlab`
2. `git status` — 乾淨？on `main`？
3. `git fetch -p && git log --oneline origin/main..HEAD` 跟 `git log --oneline HEAD..origin/main` — 跟 remote 同步？
4. 如果要動 backend: `cd apps/api && bun run typecheck` 確認 baseline 是綠的
5. 如果要動 iOS: 確認 Xcode + 手機在 USB 上、free provisioning cert 還沒過期

## Tone for Claude when working on this project

- 米寶是真的、淋巴瘤是真的、4/13 是真的。做產品決定時想著「米寶下次回診那 30 秒
  醫生會怎麼用這個」，不是想著「市場規模」或「漂亮 demo」。
- 直接、簡潔、不堆積術語。代碼勝過簡報。
- 看到使用者貼 secret 立刻警告 + 建議 revoke。
- 砍 scope 比堆 scope 重要。每個 feature 都要回答「米寶 4/13 用得到嗎？」
- 不要做沒被要求的「順手改進」。bug fix 不需要清理周圍 code，新 feature 不需要
  加 configurability。
- 對醫生的 UX 苛刻 — 醫生在診間 30 秒，第一秒看不懂的東西就是失敗。
