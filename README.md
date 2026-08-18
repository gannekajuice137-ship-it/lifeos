# Life OS — Private Personal App

> **⚠️ This is a private, single-user app.** The source repo must remain private. The Pages URL is public-but-hidden — it is only useful because PageCrypt + client-side encryption make it unreadable without the passphrase.

## Overview

Life OS is a private personal management system with six modules:

| Module | Route | Purpose |
|--------|-------|---------|
| Tasks | `/tasks` | Daily task manager + habit tracker |
| GATE | `/gate` | GATE syllabus tracker (S0–S6 pipeline) |
| Codeforces | `/cf` | Competitive programming tracker |
| Notes | `/notes` | Daily notes with markdown + images |
| Wiki | `/wiki` | Knowledge wiki with error book |
| People | `/people` | CRM for tracking contacts |

## Security Model (Defense in Depth)

1. **PageCrypt** — Every HTML file is AES-256 encrypted at build time. Without the passphrase, the app never loads.
2. **Supabase Auth** — Email/password login (signups disabled). Only your account exists.
3. **Row Level Security** — Every table has RLS policies restricting access to your user ID only.
4. **Private Storage** — Images stored in a private bucket, served via short-lived signed URLs.
5. **Client-Side Encryption** — All user content is AES-GCM encrypted in the browser before reaching Supabase. Even a compromised backend sees only ciphertext.

## Setup

### Prerequisites

- Node.js 20+
- A Supabase project (free tier works)
- A private GitHub repo

### 1. Database Setup

Go to your Supabase project → SQL Editor → paste and run the contents of `scripts/schema.sql`.

Then go to Storage → New Bucket:
- Name: `lifeos`
- Public: **OFF** (private)

Add a storage policy:
```sql
-- Allow authenticated users to manage their own files
CREATE POLICY "owner only" ON storage.objects
  FOR ALL USING (bucket_id = 'lifeos' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 2. Disable Signups

In Supabase → Authentication → Providers → Email:
- **Disable signups** (only your existing account should work)

### 3. Create Your Account

In Supabase → Authentication → Users → Add User:
- Email: (your email)
- Password: (your password)

### 4. Enable 2FA

In Supabase → Account → Enable Two-Factor Authentication.

### 5. Environment Variables

Create `.env.local` (gitignored):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 6. Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — sign in, then enter your encryption passphrase.

### 7. Deploy

Push to `main`. GitHub Actions will:
1. Build the Next.js static export
2. Encrypt all HTML files with PageCrypt
3. Deploy to GitHub Pages

**Required GitHub Actions Secrets:**
- `PAGECRYPT_PASSPHRASE` — Your encryption passphrase (16+ chars)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key

### 8. First-Time Setup (on deployed site)

1. Visit the Pages URL
2. Enter the PageCrypt passphrase to unlock the HTML
3. Sign in with your Supabase email/password
4. Enter the encryption passphrase (same one, different system — this derives your AES key)
5. **Save the recovery key** shown on first setup — store it offline

## Recovery Key

⚠️ **CRITICAL:** The recovery key is shown exactly **once** during first setup. If you lose both your passphrase AND recovery key, your data is **permanently unrecoverable**.

Store the recovery key offline:
- Written on paper in a secure location
- Or in a password manager separate from your passphrase

If you forget your passphrase but have the recovery key, you can still decrypt your data using the "Use recovery key instead" option on the unlock screen.

## Backup

### Database Backup

Periodically export your Supabase database:
1. Go to Supabase → Database → Backups (paid plan) or
2. Use `pg_dump` with your connection string
3. Or use the export feature in the app (Settings → Export My Data)

### Code Backup

Keep a local clone of the repo:
```bash
git clone <your-private-repo-url> ~/life-os-backup
```

### What to Back Up Offline

- [ ] PageCrypt passphrase
- [ ] Crypto recovery key
- [ ] Supabase project URL and anon key
- [ ] Periodic database export
- [ ] Local repo clone

## Adding GATE Topics

The GATE tracker mirrors your Obsidian system. Add subjects and topics manually through the UI:

1. Go to `/gate`
2. Click "Add Topic"
3. Enter subject (e.g., "CN", "OS"), topic number, and name
4. Use the stage buttons to advance topics through S0→S6
5. Flag weak topics for focused review

## Engineering

- **Stack:** Next.js (static export) + Supabase + Web Crypto API
- **Design:** Apple-design system (translucent materials, spring animations, system fonts)
- **Encryption:** AES-256-GCM with PBKDF2 key derivation (210K iterations)
- **No:** third-party scripts, CDNs, analytics, telemetry, or external dependencies beyond what's listed in package.json

## License

Private — for owner use only.
