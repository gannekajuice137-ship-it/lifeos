# Life OS — Product Requirements Document (PRD)

- **Status:** Ready for implementation (MVP)
- **Version:** 1.0 · **Date:** 2026-08-18
- **Owner:** sole user (private, personal app — no other users, ever)
- **Delivered with this document:** `apple-design/SKILL.md` (binding design system — see §8)

---

## 0. How to use this document (read first)

1. Read this document fully before writing any code.
2. Sections marked **MANDATORY** are binding constraints, not suggestions. Do not "improve" or silently relax them.
3. The attached `apple-design/SKILL.md` is a binding design system (§8). Every UI decision must trace to it.
4. Do not claim completion until every item in the MVP Acceptance Checklist (§12) is verified with real output.
5. Karpathy engineering guidelines apply (§11): minimum code that solves the problem, nothing speculative, surface assumptions.

---

## 1. Product summary

A single-user personal "Life OS" web app with six modules. The owner accesses it from multiple devices and IPs. Access must be restricted to the owner alone, and the owner's data must remain unreadable even if the URL, the source code, or the hosting/backend provider is compromised.

**The six modules (each on its own page/route):**

| # | Module | Route |
|---|--------|-------|
| 1 | Daily Task Manager + Habit Tracker (combined) | `/tasks` |
| 2 | GATE Syllabus Tracker | `/gate` |
| 3 | Codeforces (CF) Tracker | `/cf` |
| 4 | Daily Notes (supports images) | `/notes` |
| 5 | Knowledge Wiki (short notes + Error Book, supports images) | `/wiki` |
| 6 | People CRM | `/people` |

---

## 2. Hard constraints (non-negotiable)

1. **Hosting:** GitHub Pages via static export, in a **private** GitHub repo. Source must never be public.
2. **Permanence:** the site must "never go away" — see §4.5 (branch protection, no force-push, local backup copy).
3. **Front door:** PageCrypt (AES-256). Every emitted HTML file is encrypted; without the passphrase the visitor sees only ciphertext and the app never loads.
4. **Backend:** Supabase — email/password auth, Row Level Security on every table, private storage bucket for images.
5. **Client-side encryption:** all user-typed text AND all image bytes are AES-GCM encrypted in the browser before leaving it. Supabase stores ciphertext, never readable content. [Decision flag — §7.4]
6. **Design:** must strictly follow the attached `apple-design` skill (§8). No exceptions, no "close enough".
7. **Theme:** light and dark mode, with a user toggle (default: follow system `prefers-color-scheme`).
8. **Routing:** each module on its own route (multi-page app), shared sidebar navigation.
9. **Image storage budget:** total ≤ 2 GB for the entire site, all time.

---

## 3. Architecture

```
Browser
 ├── GitHub Pages (static; EVERY HTML file PageCrypt-encrypted)
 │    ├── /           → unlock screen (styled, Apple-grade)
 │    ├── /tasks  /gate  /cf  /notes  /wiki  /people
 │    └── Next.js static export — runs 100% client-side, no server
 └── Supabase (anon key + owner's session token)
      ├── Auth        → email + password, JWT session
      ├── Postgres    → tables with RLS: auth.uid() = user_id
      └── Storage     → private bucket "lifeos", signed URLs only
```

**Stack decisions (settled, do not revisit):**

- **Next.js** (App Router, TypeScript) with `output: 'export'` — static export only, no server runtime, no API routes.
- **supabase-js** for auth, database, and storage.
- **Web Crypto API** for client-side encryption (no third-party crypto lib unless it wraps Web Crypto).
- **Motion (Framer Motion)** or equivalent spring library for animation, per the design skill.
- No other frameworks, no state-management library, no CSS framework — plain CSS (CSS variables for theming) unless the design skill dictates otherwise. Minimal dependency count is a goal.

**Build/deploy pipeline:**

```
push to main → GitHub Actions → npm ci → next build (static export)
→ PageCrypt-encrypt EVERY emitted .html file (passphrase from Actions secret)
→ deploy to gh-pages branch
```

---

## 4. Access & security model (layered)

Security is defense-in-depth. Every layer must exist; no layer is "the" protection.

### 4.1 Layer 1 — PageCrypt (front door)

- All emitted HTML is AES-256 encrypted at build time with the owner's passphrase.
- Visiting any URL without the passphrase shows ciphertext only. No app code runs.
- **MANDATORY multi-page behavior:** the passphrase is remembered per device via a cookie (not sessionStorage), so navigating between `/tasks` and `/gate` does not re-prompt. Provide a visible **"Lock" button** that clears the cookie (and the Supabase session) so the owner can lock the device before walking away.
- The unlock screen itself must be styled to Apple standards (§8) — it is the first thing seen.
- PageCrypt or a maintained equivalent with multi-page + cookie support. The implementation must be verified: `curl` of any deployed URL must return ciphertext with no readable app markup.

### 4.2 Layer 2 — Supabase auth

- Email + password auth. Single user. **Disable all public signups** (this is a no-signup app).
- Session persists across visits (refresh token) so the owner isn't logged out constantly on new devices.
- The owner enables 2FA on the Supabase account itself (documented in §14 — a human step).

### 4.3 Layer 3 — Row Level Security (the vault)

- **MANDATORY:** every table has RLS enabled with the policy `using (auth.uid() = user_id)` and `with check (auth.uid() = user_id)`.
- No table, no storage bucket, no RPC is accessible without an authenticated session, even with the anon key.
- Verified by test (§12): an unauthenticated Supabase query returns 0 rows.

### 4.4 Layer 4 — Private storage bucket

- Bucket `lifeos` is **private**. No public URLs, ever.
- Images are served via short-lived signed URLs (60-second expiry) generated only inside an authenticated session.
- Image blobs are also encrypted client-side before upload (§7.4) — defense in depth.

### 4.5 Layer 5 — Client-side encryption of content

- Every user-typed field and every image is encrypted in the browser with AES-GCM before the bytes leave the device. Supabase's database and storage contain ciphertext only. Even a compromised Supabase project, leaked anon key, or rogue employee cannot read the owner's data.
- Full design in §7.4.

### 4.6 Permanence ("never goes away")

- Repo settings: `main` branch requires pull requests and **blocks force pushes**; `gh-pages` branch also blocks force pushes.
- Owner keeps a local clone of the repo as backup.
- Owner keeps offline copies of: the passphrase, the crypto recovery key (§7.4), and a periodic Supabase export (§14).
- The repo is private; the Pages URL is technically public-but-hidden. That is acceptable **only because** PageCrypt + encryption make the URL useless without the passphrase. State this clearly in the docs so nobody relies on obscurity alone.

---

## 5. Data model

**Design rule (MANDATORY):** every table has two kinds of columns:

- **Plaintext operational columns** — only where filtering/ordering genuinely requires them, and only for non-sensitive values (dates, statuses, stages, counts, booleans, storage refs).
- **`payload_enc` column** — AES-GCM ciphertext of a JSON object containing ALL user-typed content (titles, notes, names, captions, error-book entries, etc.).

Any field the user types, or that could reveal anything personal, goes in `payload_enc`. Nothing user-typed is ever stored plaintext. Client-side, the app decrypts `payload_enc` into a typed object.

**Common to all tables:** `id uuid pk`, `user_id uuid not null references auth.users`, `created_at timestamptz default now()`, `updated_at timestamptz`.

### 5.1 `tasks` (daily task manager)

- Plaintext: `status` (`pending | done | cancelled`), `due_date date`, `sort_order int`.
- Payload: `title`, `notes`, `priority` (`low|medium|high`), `recurring` (optional simple rule, e.g. `daily`, or null), `completed_at` ISO string.
- Behavior: incomplete tasks **carry forward** to the next day automatically (visible as "overdue/pending" with their original due date).

### 5.2 `habits` + `habit_logs`

- `habits`: plaintext `created_at`; payload: `name`, `emoji` (or SF Symbol name), `color`, `target_days_per_week` (optional).
- `habit_logs`: plaintext `log_date date`, `habit_id uuid`; no payload needed beyond existence (or payload: `note`).
- Unique constraint: `(user_id, habit_id, log_date)`.
- UI: streak display + a visual calendar grid (GitHub-contribution style, but Apple-styled — see §8).

### 5.3 `gate_topics` (GATE syllabus tracker)

- Plaintext: `subject text`, `topic_no int`, `stage text` (`S0`–`S6`), `next_review date`, `weak boolean default false`, `status text` (`not_started | in_progress | done`).
- Payload: `topic_name`, `notes`, `resources`, `error_book_entries` (array of {date, entry}).
- The tracker mirrors the owner's existing Obsidian GATE system: topics per subject (CN has 25, OS has 6), a 7-stage pipeline (S0–S6), expanding-interval revision dates, and weak flags. The app shows: per-subject progress (X/25), each topic's current stage, next revision date, and which topics are flagged weak.
- Seed data: allow the owner to add subjects/topics manually (no hardcoded syllabus in code).

### 5.4 `cf_entries` (Codeforces tracker)

- Plaintext: `entry_date date`, `entry_type text` (`rating | problem | contest`).
- Payload: for rating/contest entries — `contest_name`, `rating`, `rank`, `delta`; for problem entries — `problem_name`, `problem_rating`, `tags` (array), `verdict` (`solved | upsolved`), `notes`.
- UI: rating timeline (simple line/area chart), problem-solving log, counts.

### 5.5 `notes` (daily notes)

- Plaintext: `entry_date date`.
- Payload: `title`, `content` (markdown), `images` (array of `{path, mime, caption?}`), `mood` (optional, 1–5).
- One entry per day (upsert on same date).

### 5.6 `wiki_pages` (Knowledge Wiki)

- Plaintext: `slug text unique (per user)`, `category text` (`short-notes | error-book | general`), `updated_at`.
- Payload: `title`, `content` (markdown), `images` (array of `{path, mime, caption?}`), `tags` (array).
- UI: sidebar list grouped by category, search (client-side, over decrypted content), markdown rendering, image display from decrypted blobs.

### 5.7 `people` (CRM)

- Plaintext: `last_contacted date` (nullable, for sorting).
- Payload: `name`, `relationship` (e.g. family/friend/colleague), `notes`, `next_reminder` (date + note, optional), `tags` (array), `avatar` (storage ref, optional).
- UI: list sorted by last contacted; "what's due" hint for `next_reminder` on the dashboard.

### 5.8 `crypto_meta` (client-side encryption support)

- Per-user: `user_id`, `salt` (for PBKDF2), `created_at`. **No key material ever stored server-side.**

---

## 6. Module specifications (MVP scope only)

Shared chrome: translucent sidebar navigation (all six routes + Lock button + theme toggle), content area per route. See §8 for design rules that apply to every module.

### 6.1 `/tasks` — Daily Task Manager + Habit Tracker

- Today view: pending tasks (carried-forward first, then today's), add task inline, mark done with animated check, priority badge, due date.
- Habit section: habit list with today's checkbox, streak count, and the visual calendar grid.
- MVP excludes: recurring-rule engine beyond simple `daily`; no drag-drop reordering (use up/down buttons or sort by priority/date).

### 6.2 `/gate` — GATE Syllabus Tracker

- Subject list with progress bars (CN: 25 topics, OS: 6 topics — counts come from data, not code).
- Topic rows: name, current stage (S0–S6), next review date, weak flag toggle.
- Actions: advance stage (S0→S1→…), set next review date, mark weak/strong.
- "Due now" filter: topics whose `next_review` ≤ today.

### 6.3 `/cf` — Codeforces Tracker

- Rating timeline chart; recent entries list (add entry form: type = contest/problem).
- Stats summary: current rating, problems solved count, streak.

### 6.4 `/notes` — Daily Notes

- Date picker / today button; one markdown editor per day; image attachments (pick → downscale client-side → encrypt → upload); saved images render inline.
- MVP excludes: multi-image drag-drop ordering (append order is fine), rich-text editor (markdown textarea + preview is fine).

### 6.5 `/wiki` — Knowledge Wiki

- Categories: Short Notes, Error Book, General.
- Page list per category, create/edit page, markdown + images (same image pipeline as notes), client-side search, last-updated sort.
- The Error Book is a first-class category — entries typically short: "problem → cause → fix".

### 6.6 `/people` — People CRM

- Add/edit people; fields per §5.7; list sorted by last contacted; optional "upcoming reminders" strip.
- MVP excludes: birthday calendars, contact import, notifications.

---

## 7. Security implementation requirements

### 7.1 PageCrypt

- Post-build step encrypts **every** `.html` file in the export output with the same passphrase (from GitHub Actions secret `PAGECRYPT_PASSPHRASE`).
- Cookie-based unlock persistence with configurable expiry (e.g. 30 days) + "Lock" button that clears it.
- **Never** commit the passphrase to the repo. It exists only as: (a) an Actions secret, (b) the owner's memory/password manager.
- Verified: `curl` of every route returns ciphertext, no readable markup, no leaked strings.

### 7.2 Supabase hardening

- Auth: email+password; **signups disabled**; only the owner's account exists.
- RLS enabled on every table + every policy per §4.3. Storage bucket private; storage policies restricted to owner.
- Do NOT use the service-role key anywhere in the app or repo. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are used (anon key is public by design — RLS is what protects data).
- `.env.local` (with real values) gitignored; repo contains `.env.example` with placeholders.

### 7.3 Image pipeline (notes + wiki)

- Client-side before upload: downscale to max dimension ~2000px, JPEG/WebP quality ~0.8, strip EXIF metadata (privacy + budget).
- Encrypt the resulting bytes (AES-GCM, §7.4), upload ciphertext to `lifeos` bucket under `{user_id}/{uuid}.enc`.
- Display: download blob → decrypt in memory → render via `URL.createObjectURL` (revoke after use). Never create public URLs.
- Limits: per-file ≤ 10 MB original, formats jpg/png/webp/gif. Total budget 2 GB — show a storage-used indicator on uploads.
- **Note:** Supabase free tier includes 1 GB storage; the 2 GB budget may require Supabase Pro ($25/mo) later. Design the storage layer as a thin module so the backend stays swappable, but do not build any other backend now.

### 7.4 Client-side encryption (decision flag — see §15)

- Key derivation: passphrase → PBKDF2 (SHA-256, ≥ 210,000 iterations, per-user random salt stored in `crypto_meta`) → 256-bit AES-GCM key. Done once per session, held in memory only.
- Each encryption operation uses a fresh random 12-byte IV. Ciphertext format: `base64(iv) + '.' + base64(ciphertext + authTag)` — one string stored in `payload_enc`.
- Covers: every `payload_enc` value AND every image blob.
- **Recovery:** generate a printable recovery key (a long random string) shown to the owner exactly once at first setup, which they must store offline. The recovery key can re-derive the same encryption key (stored as a second, independent derivation path — e.g. derived from `passphrase` or `recoveryKey`, whichever the app has). Without passphrase AND recovery key, data is unrecoverable. Document this tradeoff clearly in the UI and README.
- If the owner later wants to change the passphrase, re-derive the key and re-encrypt in place (client-side, one row at a time).

### 7.5 What NOT to do

- No service-role key in client code, no hardcoded secrets, no `console.log` of ciphertext or keys, no telemetry/analytics of any kind, no third-party CDN scripts (all assets bundled locally — a CDN script would both leak the owner's IP and violate the no-third-party rule).

---

## 8. Design compliance — MANDATORY (apple-design skill)

**The attached `apple-design/SKILL.md` is a binding design system.** The implementing agent MUST:

1. Load/read the full skill file before writing any UI code.
2. Treat every principle and concrete value in it as a requirement. If a UI decision conflicts with the skill, the skill wins.
3. Implement its concrete rules, at minimum:
   - **Typography:** system font stack (`-apple-system`, `system-ui`, …); size-specific tracking (negative `letter-spacing` on large display text, near 0 on body); tight leading on headings, comfortable on body; hierarchy via weight+size+leading as a set; layout in `rem`/`em` so it scales with the user's text-size setting.
   - **Materials:** translucent chrome (`backdrop-filter: blur() saturate()` + semi-transparent background) for the sidebar and any toolbars/sheets, with content scrolling under; edge fade instead of hard borders; heavier material for structural regions, lighter for interactive elements; never stack light-on-light translucency.
   - **Motion:** springs everywhere a user can touch — default `damping 1.0` (critically damped), `response 0.3–0.4`; `damping ~0.8` only for momentum-driven interactions (flicks, drags); animate from the live/presentation value; interruptible; `transform`/`opacity` only; `will-change` hints; pointer-down feedback (e.g. `:active` scale 0.97, 100ms) not click-only.
   - **Gestures (where present):** 1:1 tracking with Pointer Events + `setPointerCapture`; ~10px hysteresis; velocity handoff; momentum projection on release; rubber-banding at boundaries.
   - **Feedback & affordances:** instant press feedback; four feedback kinds (status/completion/warning/error); destructive actions get confirmation; inline validation, not on-submit.
   - **Wayfinding:** every screen answers where-am-I / where-can-I-go / what's-here / how-do-I-exit. Direct, specific nav labels.
   - **Accessibility:** honor `prefers-reduced-motion` (cross-fades instead of springs/slides), `prefers-reduced-transparency` (solid surfaces), `prefers-contrast: more`; no full-viewport moving backgrounds; ease light↔dark theme changes (no abrupt brightness jump).
   - **Light/dark:** both themes fully designed (tokens as CSS variables), toggle in the sidebar, default follows system.
4. Run the skill's checklists as a **self-review pass** before declaring the UI done, and fix every violation found.

---

## 9. Non-functional requirements

- **Responsive:** usable on phone and desktop (owner may access from any device). Touch targets ≥ 44px.
- **Performance:** static export, no heavy JS on first paint; images lazy-loaded; bundle kept lean (no giant deps). The unlock screen decrypts fast.
- **Offline:** not required. No PWA.
- **Single-user:** no multi-user concerns anywhere (no shared state, no conflict resolution).
- **Data export:** a "Export my data" button (download all decrypted data as JSON + images as zip) — cheap insurance for "never lose my data".

---

## 10. Repo & deployment requirements

- Private repo. `main` protected: require PR, block force push. `gh-pages` protected: block force push.
- GitHub Actions workflow: build → PageCrypt → deploy (e.g. `actions/deploy-pages` or direct `gh-pages` branch push).
- Secrets in Actions: `PAGECRYPT_PASSPHRASE`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- README (private, owner-facing): setup steps, how to add topics, how to back up, recovery-key warning.

---

## 11. Engineering guidelines (Karpathy)

- **Simplicity first:** minimum code that solves the problem. No speculative features, no abstractions for single-use code, no "flexibility" that wasn't requested.
- **Surgical changes:** touch only what the requirements demand; match existing style; no drive-by refactors.
- **Surface assumptions:** if something in this PRD is ambiguous or seems wrong, stop and note it rather than silently picking an interpretation.
- **Verifiable goals:** every feature maps to a check in §12.

---

## 12. MVP acceptance checklist (verify each with real output)

**Security:**
- [ ] `curl` of `/`, `/tasks`, `/gate`, `/cf`, `/notes`, `/wiki`, `/people` (deployed) returns ciphertext — no readable app markup or user data anywhere in the HTML.
- [ ] Unauthenticated Supabase query (using only the anon key, no session) returns 0 rows for every table and no bucket listings.
- [ ] RLS policy present and enabled on every table (`select pg_policies` shows owner-only policies).
- [ ] Signups disabled in Supabase; only the owner account exists.
- [ ] Supabase database contains no plaintext user content — spot-check rows show `payload_enc` ciphertext only.
- [ ] Storage bucket is private; image files are `.enc` ciphertext; no public URLs generated.
- [ ] No third-party scripts/CDNs; no secrets in committed code or in the exported HTML.

**Functionality (each module):**
- [ ] `/tasks`: add/complete/delete tasks; incomplete tasks carry forward; habit check-in updates streak + calendar grid.
- [ ] `/gate`: add subject + topics; advance stage S0→S6; set next-review; weak flag; "due now" filter shows correct topics.
- [ ] `/cf`: add contest & problem entries; rating chart renders; counts correct.
- [ ] `/notes`: create/edit per-day note with markdown; attach image → appears inline; re-open shows image.
- [ ] `/wiki`: create pages in Short Notes / Error Book / General; markdown + images; search finds text inside encrypted content (client-side).
- [ ] `/people`: add/edit/delete people; list sorted by last contacted; reminder hint shows.

**Design (apple-design compliance):**
- [ ] Self-review against the skill's checklist completed; all violations fixed.
- [ ] Light + dark both polished; toggle works; system default respected; theme switch is eased.
- [ ] Sidebar is translucent with blur; content scrolls under it; typography follows size-specific tracking/leading rules.
- [ ] `prefers-reduced-motion` and `prefers-reduced-transparency` respected.

**Ops:**
- [ ] Build succeeds from a clean checkout with only the three secrets set.
- [ ] Unlock cookie persists across route navigation; Lock button clears it and the session.
- [ ] Export-my-data produces a valid JSON + images archive.
- [ ] README documents setup, backup, and the recovery-key warning.

---

## 13. Explicitly out of scope (do NOT build)

- No multi-user features, sharing, or public views.
- No PWA/offline, no mobile apps, no push notifications.
- No recurring-task engine beyond simple `daily`.
- No rich text editor (markdown textarea + preview is the MVP).
- No analytics, telemetry, or third-party services of any kind.
- No admin UI, no settings beyond theme toggle + lock + export.
- No drag-and-drop reordering (buttons or sort keys are fine).

---

## 14. Owner setup checklist (human steps — the agent cannot do these)

1. Create the private GitHub repo; set branch protection (§10); enable 2FA on the GitHub account.
2. Create the Supabase project; disable signups; create the owner account; enable 2FA on the Supabase account.
3. Create the `lifeos` storage bucket (private) and the tables from §5 (the agent may provide SQL for this).
4. Set the three GitHub Actions secrets.
5. Choose a strong passphrase (16+ chars, not a dictionary word) and save the recovery key offline.
6. Keep a local clone of the repo; run periodic Supabase exports (free tier has no automatic backups).

---

## 15. Assumptions & open decisions

- **DECISION FLAG — client-side encryption (§7.4): assumed YES.** The owner explicitly asked to "encrypt everything" and named data privacy as their top concern. Tradeoff (documented in the app): losing the passphrase AND the recovery key means permanent data loss. To drop this layer, delete §7.4 and change constraint #5 in §2 — everything else in this PRD still holds (PageCrypt + RLS + private bucket already block outsiders).
- **Storage:** Supabase for now, per owner. Free tier = 1 GB; the 2 GB budget may require Pro ($25/mo) later. Storage access is isolated in a thin module for a possible future swap to R2/etc. — no other backend abstraction.
- **CF = Codeforces.** GATE tracker mirrors the owner's Obsidian system (S0–S6 pipeline, expanding-interval revisions, weak flags; CN = 25 topics, OS = 6 topics) — topic lists are data, not hardcoded.
- **Design skill:** emilkowalski's `apple-design` (attached). The other candidate (dickwu's) targets native cross-platform apps and was explicitly rejected.
- **Credentials on a new device:** owner enters the passphrase (unlock) then signs in with Supabase email+password; both persist per device.
