# Life OS — Agent Handoff Context

> **Purpose:** This document gives you full context on the Life OS project so you can continue work from where we left off. Read `PRD.md`, `KICKOFF.md`, and `apple-design/SKILL.md` for the full specification.

---

## What Is This Project?

A **private, single-user** personal web app called **Life OS** with 6 modules. The owner is the only user. Data must be encrypted and protected at every layer.

## Project Location

`C:\Users\shahd\Music\2`

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Output | Static export (`output: 'export'`) — runs 100% client-side |
| Backend | Supabase (auth, Postgres, private storage) |
| Encryption | Web Crypto API — AES-256-GCM, PBKDF2 (210K iterations) |
| Styling | Plain CSS with CSS variables (no Tailwind) — **"Dark Console" design system** |
| Animation | Motion (installed, basic press feedback so far) |
| Markdown | react-markdown + remark-gfm (installed) |
| Compression | JSZip (for export feature) |
| Build encryption | PageCrypt (custom `scripts/pagecrypt.mjs`) |

## Live Backend (Supabase — set up)

- **Project URL:** `https://hxroqjspqiqyjuxvefce.supabase.co`
- **Publishable (anon) key:** `sb_publishable_QchjY8qOQcyM_Z_edmHtgw_A9mCJE8v` (new-style key; works in `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- **Database:** all 9 tables live from `scripts/schema.sql` (verified via REST API; `crypto_meta` uses `user_id` as PK, not `id`)
- **Storage:** private bucket `lifeos` created; `owner only` policy on `storage.objects` (bucket_id + `auth.uid()::text = (storage.foldername(name))[1]`). No `storage.buckets` policy needed — app only uses `.upload`/`.download`, never lists buckets.
- **Auth:** signups disabled; owner account created via dashboard (email + password)
- **Storage policy note:** the storage API returns "Bucket not found" for unauthenticated bucket probes — expected with RLS, not a misconfiguration.

## What Has Been Built (Complete)

### Core
- [x] Next.js project configured for static export
- [x] Supabase client singleton (`src/lib/supabase.ts`)
- [x] Client-side encryption module (`src/lib/crypto.ts`) — encrypt/decrypt strings, bytes, JSON payloads
- [x] Full data access layer (`src/lib/db.ts`) — CRUD for all 9 tables with encryption/decryption
- [x] TypeScript types for all tables (`src/lib/types.ts`)
- [x] React context for auth + crypto state (`src/lib/context.tsx`) — cookie-based unlock persistence
- [x] SQL schema with RLS policies (`scripts/schema.sql`) — applied to live Supabase project

### UI / Design — "Dark Console" (redesigned, all emojis removed)
- [x] **Design system** (`src/app/globals.css`): dark-first layered charcoal surfaces (`#0e0e11` → `#18181d`), hairline borders, translucent sidebar blur, light theme kept as secondary
- [x] **Per-module accent identity**: Tasks `#0a84ff` blue · CF `#ff9f0a` orange · Notes `#ffd60a` yellow · Wiki `#30d158` green · People `#ff375f` pink (`--accent-gate` `#bf5af2` retained only for the sidebar logo gradient)
- [x] **Module headers**: mono uppercase eyebrow (with accent tick) + large display title + context sub-line, per module
- [x] **Stat-card grids** on Tasks, GATE, CF, People (tabular numerals, accent top-edge)
- [x] **Custom SVG icon library** (`src/components/icons.tsx`, ~40 icons): atom mark, flame, trophy, monitor, chart, book/bug/stack, target, list, warning, zap, code, dumbbell, graduation cap, heart, star, 5 mood faces (line art). No emoji anywhere in the UI.
- [x] Sidebar: gradient atom logo mark, per-module accent active pill with glow, theme toggle, Lock button
- [x] AppShell sets `data-route` → faint static accent wash per module background
- [x] Tasks: habit **icon + color picker** (8 SVG habit icons × 6 colors — payload field still named `emoji`, stores icon key; `HabitAvatar` falls back to zap), streak shown with flame SVG
- [x] Notes: mood = 5 SVG faces + word labels (Rough/Meh/Okay/Good/Great)
- [x] Wiki: category tabs with SVG icons (note/bug/book), eyebrow header
- [x] GATE: `weak-chip` with warning triangle, stage pills tinted via `color-mix`
- [x] CF: trophy/monitor entry badges, rating chart strokes use module accent, **fixed "Total Entries" stat counting bug**
- [x] **CF problem entries enriched** (per owner request): problem link (opens in new tab), difficulty (CF rating brackets 800–2600), time taken (minutes), topics (chips), mistakes made (warning-colored line), verdict kept; legacy `problem_rating` used as difficulty fallback
- [x] **CF "Problems by Difficulty" breakdown** at page bottom: per-difficulty count with proportional bars
- [x] **CF payload decryption fixed**: `fetchCfEntries` now decrypts `payload_enc` (previously returned raw rows — names/ratings were never displayed)
- [x] **CF entries are a discriminated union** (`CfContestEntry` | `CfProblemEntry` in `types.ts`, `CfEntryItem` alias) — type guards `isContest`/`isProblem` narrow payloads cleanly; `fetchCfEntries` returns `CfEntryItem[]`
- [x] Empty states: SVG tile illustrations everywhere
- [x] PageCrypt unlock shell restyled to match (dark console + gradient lock tile, SVG lock, light-mode media query)
- [x] Accessibility preserved: `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast: more`

### Module Pages (5 — GATE page removed per owner request)
- [x] `/tasks` — daily task manager + habit tracker (calendar grid, streaks, carry-forward, habit picker)
- [x] `/cf` — Codeforces tracker, rating chart (SVG), contest + rich problem entries, per-difficulty breakdown, stats cards
- [x] `/notes` — daily notes, date picker, markdown textarea, mood selector
- [x] `/wiki` — wiki with 3 categories (Short Notes, Error Book, General), client-side search, page editor
- [x] `/people` — people CRM, contacts sorted by last contacted, reminders strip, mark-contacted

### Image Pipeline
- [x] Client-side downscale to 2000px max, JPEG quality 0.8
- [x] Encrypt image bytes before upload
- [x] Upload to private `lifeos` bucket as `.enc` files
- [x] Download → decrypt → createObjectURL for display

### Build / Deploy
- [x] PageCrypt post-build script (`scripts/pagecrypt.mjs`) — dark console unlock shell
- [x] GitHub Actions workflow (`.github/workflows/deploy.yml`) — **artifact-based** (`actions/deploy-pages`), so `gh-pages` branch force-push protection stays enforceable; requires Pages source = "GitHub Actions"
- [x] README with setup, backup, recovery-key documentation
- [x] `.env.example` with placeholders (created — was missing)
- [x] `.gitignore` (created — was missing): ignores `.env.local`, `.env`, `node_modules`, `.next/`, `out/`
- [x] `.env.local` with real Supabase values (gitignored, never commit)

### Verification Done
- [x] TypeScript compiles clean (`npx tsc --noEmit` — 0 errors)
- [x] `npm run lint` — 0 errors, 7 pre-existing warnings (unused vars in UnlockScreen/notes, `window.location.href` in UnlockScreen)
- [x] `npm run build` succeeds — all 7 routes static (GATE removed)
- [x] PageCrypt encrypts all HTML files — no readable app markup
- [x] All 5 module routes serve 200 in dev (`/gate` 404s); zero emoji characters in served HTML
- [x] **Lint errors fixed**: `react-hooks/set-state-in-effect` on all 6 pages — effects now call `loadData()` via `requestAnimationFrame` + cleanup (also prevents setState-after-unmount)

## What Has NOT Been Built Yet

> **GATE page removed** (owner request, 2026-08-18): `src/app/gate/` deleted, nav item + route wash dropped, `/gate` returns 404. The `gate_topics` table + `db.ts` gate functions + types are intentionally left in place — the table stays in Supabase (RLS-protected, empty) in case the tracker comes back.

- [ ] **Push to GitHub** — owner provided a fine-grained PAT; private repo `life-os` not created yet. TODO: create repo → push → branch protection (main: require PR + block force push; gh-pages: block force push) → secrets (`PAGECRYPT_PASSPHRASE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) → enable Pages (source: GitHub Actions) → first deploy
- [ ] **Export-my-data feature** — download all decrypted data as JSON + images zip (JSZip is installed)
- [ ] **Full Motion/Framer Motion spring animations** — only basic `:active` scale feedback so far
- [ ] **Markdown rendering in display mode** — wiki and notes currently use `whiteSpace: pre-wrap`; react-markdown installed but not wired
- [ ] **Image attachment UI** — upload pipeline built in `db.ts`, no file picker in Notes/Wiki UIs
- [ ] **Detailed accessibility audit** — basic aria-labels only
- [ ] **Passphrase change flow** — PRD mentions re-encrypting all data; not implemented
- [ ] **Enable 2FA reminder** — should prompt if 2FA isn't enabled on Supabase
- [ ] Cleanup of 8 lint warnings (pre-existing)

## Key Files Reference

```
src/
├── app/
│   ├── layout.tsx          # Root layout with Providers + theme init script
│   ├── page.tsx            # Root page — redirects to /tasks or shows unlock
│   ├── globals.css         # Dark Console design system (tokens, modules, components)
│   ├── tasks/page.tsx      # Tasks + Habits module (habit icon/color picker)
│   ├── cf/page.tsx         # Codeforces tracker (problems: link/difficulty/time/topics/mistakes)
│   ├── notes/page.tsx      # Daily notes (mood = SVG faces)
│   ├── wiki/page.tsx       # Knowledge wiki
│   └── people/page.tsx     # People CRM
├── components/
│   ├── Sidebar.tsx         # Translucent nav sidebar (atom mark, per-accent pills)
│   ├── AppShell.tsx        # Layout wrapper (data-route accent wash)
│   ├── PageWrapper.tsx     # Auth guard for all module pages
│   ├── UnlockScreen.tsx    # Login + passphrase + recovery key flow
│   ├── Providers.tsx       # AuthCryptoProvider wrapper
│   ├── SpringButton.tsx    # Spring-animated button (minimal)
│   └── icons.tsx           # ~40 inline SVG icons (no CDN, no emoji)
└── lib/
    ├── supabase.ts         # Supabase client
    ├── context.tsx         # Auth + crypto state (cookie persistence)
    ├── crypto.ts           # AES-GCM encryption, PBKDF2, key management
    ├── db.ts               # All CRUD operations for 9 tables + storage
    └── types.ts            # TypeScript types for all tables

scripts/
├── pagecrypt.mjs           # Build-time HTML encryption (dark console shell)
└── schema.sql              # Database setup SQL (applied)

.github/workflows/deploy.yml  # Build → PageCrypt → upload-pages-artifact → deploy-pages
```

## Design System Notes (Dark Console — supersedes earlier notes)

- **Dark is the flagship**: `--bg-primary: #0e0e11`, `--bg-secondary: #131316`, `--bg-tertiary: #1e1e24`, `--bg-elevated: #18181d`; light theme inverted and kept polished
- **Per-module accents** (see above) drive: sidebar active pill, module eyebrow tick, progress fills, stat-card top edge, background wash (`data-route` on `.app-layout`)
- **Typography**: system font stack; module titles `clamp(1.9rem, 4vw, 2.6rem)`, `-0.03em` tracking, weight 800; eyebrows in `--font-mono`, 0.12em uppercase; stat values tabular-nums
- **Chips/badges**: `background: color-mix(in srgb, currentColor 13%, transparent)` — tint follows text color automatically
- **Motion**: `:active` scale 0.97 everywhere; springs still pending (apple-design skill §4)
- **Accessibility**: reduced-motion → instant; reduced-transparency → solid surfaces; contrast-more → stronger borders
- **Rule of thumb for new UI**: use the token variables, add new icon as SVG in `icons.tsx`, never reintroduce emoji

## Environment Variables

```
# .env.local (real values, gitignored)
NEXT_PUBLIC_SUPABASE_URL=https://hxroqjspqiqyjuxvefce.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_QchjY8qOQcyM_Z_edmHtgw_A9mCJE8v
```

`.env.example` has placeholders for new clones. GitHub Actions secrets (for deploy):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PAGECRYPT_PASSPHRASE` (the deployed site's unlock passphrase — not set yet, must be created with the repo)

## How to Run

```bash
cd C:\Users\shahd\Music\2
npm install          # already installed
npm run dev          # dev server at http://localhost:3000
```

Deploy build locally: `npm run build:deploy` (requires `PAGECRYPT_PASSPHRASE` env var).

## PRD Acceptance Checklist Status

| Category | Status |
|----------|--------|
| Security (PageCrypt, RLS, signups disabled, storage) | ✅ Built; live Supabase configured; needs deployed-site curl verification |
| `/tasks` functionality | ✅ Built (habit picker redesigned) |
| `/gate` functionality | ❌ Page removed per owner request (table kept in DB) |
| `/cf` functionality | ✅ Built (rich problems + difficulty stats) |
| `/notes` functionality | ✅ Built (mood selector redesigned) |
| `/wiki` functionality | ✅ Built (category icons redesigned) |
| `/people` functionality | ✅ Built |
| Design compliance | ✅ Dark Console built; Motion spring pass still pending |
| Ops (build, encrypt, deploy) | ✅ Working; workflow ready; needs GitHub repo + secrets + first run |
| Export-my-data | ❌ Not built |
| Image attach UI in Notes/Wiki | ❌ Pipeline built, UI not wired |

## What to Do Next (Priority Order)

1. **Push to GitHub** (token in hand): create private `life-os` → push → branch protection → secrets → Pages (source: GitHub Actions) → trigger deploy
2. **Wire image attachment UI** into Notes and Wiki pages (file picker → encrypt → upload → display) — same pattern applies to CF problem entries if screenshots are wanted later
3. **Add markdown rendering** with react-markdown in Notes and Wiki display mode
4. **Build export-my-data** button using JSZip
5. **Add Motion spring animations** to interactive elements per apple-design skill
6. **Accessibility audit** — add missing ARIA labels
7. **Clean up 8 lint warnings** (unused vars in UnlockScreen/db.ts, `window.location.href`, unused icon imports)
