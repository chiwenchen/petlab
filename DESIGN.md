# PetLab — Design System

> The vet experience is the entire deliverable. Every design decision serves
> "the medic in the consult room has 30 seconds to read this and form a clinical
> picture." Trust through restraint, never through ornament.

## Voice

- **Calm clinical competence**, not playful brand fluff.
- Specific medical labels (HCT, RBC, ALT) preserved as-is — never localized.
- Chinese for the human prose; English/abbreviations for clinical terms.
- No emoji, anywhere. Period. (Brand decision — the user explicitly rejected emoji
  as "looking cheap.")
- Active, terse copy. "上傳報告" not "點此上傳新的檢驗報告"。

## Color

Neutral system + one brand accent, semantic red for abnormal, semantic green for
reference range. **No decorative colors anywhere else.**

| Token        | Light hex | Use                                                |
|--------------|-----------|----------------------------------------------------|
| `surface`    | `#fafafa` | Page background (`bg-gray-50`)                     |
| `card`       | `#ffffff` | Cards, modals (`bg-white`)                         |
| `text`       | `#111827` | Body text, headings (`text-gray-900`)              |
| `text-muted` | `#6b7280` | Secondary text, captions (`text-gray-500`)         |
| `text-soft`  | `#9ca3af` | Tertiary, axis labels (`text-gray-400`)            |
| `border`     | `#e5e7eb` | Card borders, dividers (`border-gray-200`)         |
| **`abnormal-bg`** | `#fef2f2` | Out-of-range row tint (`bg-red-50`)            |
| **`abnormal-fg`** | `#b91c1c` | Out-of-range value text (`text-red-700`)        |
| `ref-band`   | `#dcfce7` | Reference range band on charts (`bg-green-100`)    |
| `cta-bg`     | `#111827` | Primary CTA bg (`bg-gray-900`) — kept gray for trust |
| **`brand-700`** | `#0f766e` | Brand accent: logo, "Lab" half of wordmark, focus ring |
| **`brand-100`** | `#ccfbf1` | Brand tint (rarely used — section underlines, badges) |

Brand accent is the **clinical-warm teal** scale (Tailwind `brand-{50,100,200,400,600,700,800}` defined in `tailwind.config.ts`). Used sparingly: logo mark, "Lab" half of the wordmark, focus rings on CTAs. Primary CTA stays gray-900 for trust — accent is for identity, not for action.

**No purple, no blue-to-purple gradients, no decorative blobs.** If a section
feels empty, the data is wrong, not the styling.

## Typography

**Noto Sans TC** (Google Fonts, weights 400/500/600/700) — same family for body
and display. Loaded via `next/font/google` with `font-display: swap`. System
fallback: PingFang TC → Helvetica Neue → Arial. Tailwind's `font-sans` resolves
to this stack.

- Headings: `font-semibold` (600), `tracking-tight` for h1 only
- Body: `font-normal` (400), 14-16px
- Numbers: `tabular-nums` always for value columns
- Wordmark "PetLab": `font-semibold` `tracking-tight`, "Lab" tinted `text-brand-700`
- Medical abbreviations: default font (CJK and Latin both look good in Noto)

Sizes:
- Page title (h1): 24px (`text-2xl`)
- Section title (h2): 14px semibold uppercase tracking-wide (`text-sm font-semibold tracking-wide`)
- Card title (h3): 14px (`text-sm`)
- Body: 14px (`text-sm`)
- Caption: 12px (`text-xs`)
- Numerics in tables: 14px tabular

## Spacing

Use the Tailwind 4px-based scale. **Never** an arbitrary `p-[13px]`.

Composition spacing:
- Page horizontal padding: `px-4` mobile, `px-6` tablet+
- Page vertical padding: `py-8` desktop, `py-6` mobile
- Section gap: `mt-8` (desktop), `mt-6` (mobile)
- Card padding: `p-4` (default), `p-3` (compact)
- Stack gap inside cards: `gap-3` or `space-y-3`

Container width: **`max-w-3xl`** for owner pages (768px). Reading + tabular data both work. Public viewer stays `max-w-lg` (mobile-first since vet often opens on phone).

## Layout

- **Page = single content column on a calm surface.** No sidebars. No card mosaics.
- **Cards earn their existence.** A card is for things you'd want to lift off the
  page (a report, a chart, a form group). Don't card-wrap navigation buttons.
- **Tables for tabular data.** A list of numeric values is a table, not a div soup.
- **Empty states show the action**, not a sad face. "還沒有報告，點上方上傳第一份。"

## Charts (recharts)

- **Height**: 180px fixed (not Tailwind class — pixel value bypasses ResizeObserver).
- **Reference band**: green tint at 50% opacity. Subtle.
- **Line**: 2px stroke, dark gray (`#111827`). Dot 3px filled.
- **Axes**: 11px gray-400 ticks, gray-200 stroke. No gridlines vertical.
- **Tooltip**: 12px, light bg, no border shadow.
- **Order**: most-changed metric first, then by clinical importance, never alphabetical.

## Component conventions

### Button hierarchy
- **Primary** (`bg-gray-900 text-white`): one per view, the verb (上傳, 儲存)
- **Secondary** (`border border-gray-300 text-gray-700 bg-white`): supporting
- **Ghost** (`text-gray-500 underline hover:text-gray-900`): destructive or back
- All buttons: `px-4 py-2.5` minimum, `text-sm font-semibold`. Touch target ≥44px on mobile via `py-2.5` + line-height.

### Date format
- Display: **`yyyy/MM/dd`** (`2026/04/16`). ISO order reads cleanly across panels.
- Input: HTML `type=date` reads/writes `yyyy-MM-dd` natively. Use a helper to slice on read.
- **Never** mix US `MM/DD/YYYY` and ISO. We use ISO order, slash-separated.

### Out-of-range emphasis
- Row background: `bg-red-50`
- Value text: `text-red-700 font-semibold`
- Flag pill: `低 ▼` / `高 ▲` aligned right, same red
- **Never use color alone** — always pair with the 低/高 label.

### Number alignment
- All numeric columns: `text-right tabular-nums`
- Units: `text-xs text-gray-400 ml-1` after the number, never above/below

## Brand mark

Inline SVG roundel: large center circle (`#0f766e`) with two smaller "ear"
circles top-left and top-right, stylized white paw cutout in the middle.

- 16px → favicon
- 24px → top app bar (`<AppNav>`)
- 28-36px → auth pages, landing hero
- Use `<Logo variant="mark">` for icon only, `<Logo variant="wordmark">` (default) for icon + "PetLab" wordmark.
- Brand color is locked to `#0f766e` (brand-700) — do not theme it.

## What we don't do

- ❌ Emoji as decoration or status (use `低 ▼` / `高 ▲` text labels)
- ❌ Card mosaic dashboards (米寶 has one pet, not a kanban board)
- ❌ Gradient backgrounds, decorative blobs, "AI slop" patterns
- ❌ Center-aligned body text (left-align for everything except hero copy)
- ❌ Pill-shaped buttons or `rounded-full` on rectangles
- ❌ More than 2 type weights per page (regular + semibold)
- ❌ Hover-only affordances (mobile has no hover)
- ❌ Colored left borders on cards
- ❌ Any "shimmer" loading state — use simple gray skeletons or spinners

## Accessibility floor

- Body contrast ≥ 4.5:1
- Focus ring visible (`focus-visible:ring-2 focus-visible:ring-gray-900`)
- All interactive elements ≥ 44×44px touch target on mobile
- Labels visible (no placeholder-as-label)
- `prefers-reduced-motion` respected (no chart animations beyond default recharts)
