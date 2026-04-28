# PetLab — 你需要動手做的事

> Code 已經 ship 完 Phase 5–10。這份清單是**只能你做**的 config / 帳號 / 真實測試工作。
> 全部完成才算 v1 真的能用。

---

## 1. 🔄 Rotate Resend API key（**做這個再做其他**）

之前我為了驗 `.dev.vars` 存在，跑了 `cat .dev.vars | head -5`，導致你目前的 `RESEND_API_KEY` 出現在 session transcript。
按你 CLAUDE.md 的規則「一旦出現在 transcript 就視為洩漏，必須 revoke + 重開」。

```bash
# 1. 在 Resend dashboard 撤銷舊 key
open https://resend.com/api-keys

# 2. 產生新 key，更新本地 .dev.vars
nano apps/api/.dev.vars        # 替換 RESEND_API_KEY=...

# 3. 更新 production secret（互動式輸入新值）
cd apps/api
bunx wrangler secret put RESEND_API_KEY
```

---

## 2. 📨 在 Resend 驗證 redarch.dev domain

這條卡死「真的能寄 OTP」這件事。

```bash
open https://resend.com/domains
# 1. Add Domain → 輸入 redarch.dev
# 2. Resend 會給你 SPF / DKIM / 一條 MX 紀錄
# 3. 在 Cloudflare DNS dashboard for redarch.dev 加上去
# 4. 回 Resend 按 "Verify"，等綠燈
```

**驗證未通過前**：寄 OTP 會 502，整個 web 登入流程跑不動。

DNS 改完到 Resend 看到 verified，通常 5–30 分鐘。

---

## 3. 🔐 把所有 production secrets 設好

```bash
cd apps/api
bunx wrangler secret put ANTHROPIC_API_KEY    # OCR 要用，從 console.anthropic.com 拿
bunx wrangler secret put RESEND_API_KEY        # 上面 rotate 完的
bunx wrangler secret put JWT_SECRET            # 隨便一串長 random，用於簽 session JWT
bunx wrangler secret put OTP_FROM_EMAIL        # 例如：PetLab <noreply@redarch.dev>
```

驗證：

```bash
bunx wrangler secret list
# 應該看到上面 4 個都列出來
```

---

## 4. 🚀 Deploy backend (Workers) + 建 D1 / R2

```bash
cd apps/api

# 已經 create 過就跳過
bunx wrangler d1 create petlab                 # 已建（database_id 在 wrangler.toml）
bunx wrangler r2 bucket create petlab-images   # 確認 R2 bucket 存在

# Apply migrations 到 production D1
bunx wrangler d1 migrations apply petlab --remote

# Deploy worker
bunx wrangler deploy

# 驗證
curl https://api.petlab.redarch.dev/
# 應該回 {"name":"PetLab","status":"ok","version":"0.1.0"}
```

---

## 5. 🌐 在 Cloudflare Pages 建 web project

> 這步沒辦法用 wrangler 做完，要進 Cloudflare dashboard。

```bash
open "https://dash.cloudflare.com/?to=/:account/pages"
```

設定：

| 欄位                   | 值                                                |
|------------------------|---------------------------------------------------|
| Project name           | `petlab` (或任何你喜歡的名字)                        |
| Production branch      | `main`                                            |
| Build command          | `cd apps/web && bun install && bunx next-on-pages` |
| Build output directory | `apps/web/.vercel/output/static`                  |
| Root directory         | `/` (repo root)                                   |
| Environment variables (Production) | `API_BASE_URL=https://api.petlab.redarch.dev` |
|                                    | `NODE_VERSION=20`                          |

**Compatibility flags**（在 Pages → Settings → Functions → Compatibility flags）：
- `nodejs_compat`

---

## 6. 🌍 綁 custom domain `petlab.redarch.dev` 到 Pages

在 Pages project → Custom domains → Add custom domain → `petlab.redarch.dev`。

Cloudflare 會自動建 CNAME（因為 redarch.dev 已在 Cloudflare）。等 propagation。

驗證：

```bash
curl -I https://petlab.redarch.dev/
# 應該 200
```

---

## 7. 🧪 真實 smoke test（5 分鐘）

照順序做：

1. 開 `https://petlab.redarch.dev/` → 點「登入」
2. 輸入你 email → 收信、輸入 6 位數驗證碼
3. 進到 `/dashboard`，看到「米寶」
4. 點「+ 上傳報告」→ 選一張米寶的真實檢驗報告照片 → 等 OCR
5. 跳到 `/reports/[id]/edit`，檢查 OCR 抓對沒，修正 → 儲存
6. 回 dashboard 看到報告列表
7. 上傳第二份（不同日期）→ `/trends` 應該畫出趨勢線
8. 點「分享給醫生」→ 複製連結 → 在無痕視窗開連結 → 應該看到 viewer + trends

**任何一步失敗**：
- 開 browser dev tools → Network → 看哪個 request 4xx/5xx
- 開 Cloudflare Workers dashboard → Logs → tail 看後端 error
- 開 Cloudflare Pages → Deployments → 看 build/runtime log

---

## 8. 📅 米寶 4/13 已過 — 改個下次回診日

CLAUDE.md `tone for Claude` 區還寫「米寶 4/13 是真的」。實際上 deadline 已經過 15 天。

你下次帶米寶回診時：
1. 用 web 上傳這次的報告
2. 用「分享給醫生」產生連結
3. 用 LINE 傳給醫生
4. 觀察醫生在診間怎麼用——這才是 Phase 11 真的完成

完成後，回 [CLAUDE.md](./CLAUDE.md) 把 Phase 11 改 `[x]` 並紀錄醫生反饋。

---

## 已知 v1 限制（不修，留給 v1.1+）

- ❌ 沒有 share 連結列表/撤銷 UI（後端 API 已有）
- ❌ 多寵物（schema 已支援，UI 寫死米寶）
- ❌ trends 頁的 N+1 query（v1 用量極低可接受，10 份報告以內 < 1s）
- ❌ Login server actions 無 rate limit（Cloudflare 前面有 Bot Fight Mode 擋）
- ❌ 不支援 Apple/Google Sign-In（Email OTP 對單一用戶夠用）

---

完成 1–6 後，Phase 5–10 的 code 就會 live；7 是 dogfood；8 是真實使用。
