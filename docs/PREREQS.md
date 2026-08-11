# Prereqs — accounts + keys to provision

Everything runs on free/hobby tiers. Use fresh, dedicated accounts/projects — don't reuse
infra from other apps. Marked [BLOCKS] if it gates the vertical slice.

## Provision

1. **[BLOCKS] Supabase project** — a new project (e.g. `crm-master`).
   You'll need: project URL, `sb_publishable_` key, `sb_secret_` key, DB connection string.
   (New asymmetric JWT keys are the default — keep them.)
2. **[BLOCKS] Google Cloud OAuth app** — for "connect your own Gmail":
   - New Google Cloud project (e.g. `crm-master`)
   - OAuth consent screen → **Testing** mode (personal-use exemption; add your own email —
     and any other operators' — as test users; staying under 100 keeps the app CASA-exempt)
   - Scopes: `contacts.readonly`, `gmail.readonly`, `calendar.readonly`
   - OAuth client (Web) → redirect `https://<vercel-domain>/api/auth/google/callback` (+ localhost)
   - You'll need: client ID + client secret
3. **[BLOCKS] Resend account** — for the daily digest:
   - Add + verify a sending domain (SPF/DKIM/DMARC) — or use their onboarding domain to start
   - You'll need: API key + the from-address
4. **Anthropic API key** — drafts/briefs. Use a project-scoped key.
5. **Vercel** — link the repo and configure env vars (see `.env.local.example`).

## Defer (not needed for the slice)

- **Inngest** — only when event fan-out lands (milestones/sync). Vercel cron covers the one
  nightly job in the slice.
- **Transcript capture** (meeting-notes tool / voice-memo → Whisper) — the transcript layer is
  post-slice. Pick the capture tool whenever; doesn't block.
- **Twilio SMS / PWA push** — digest is email-only in the slice.

## Generated secrets (create locally, e.g. `openssl rand -base64 32`)

- `AES_TOKEN_KEY` (32-byte) for OAuth-token encryption — stored as a Vercel Sensitive env var,
  key lives outside the DB.
- `ACTION_LINK_SECRET` (HMAC) for signed one-tap action links.
- `CRON_SECRET` for protecting the nightly cron route.

## Security notes

- All secrets → Vercel **Sensitive** env vars + Supabase secret-key server-only. Nothing
  `NEXT_PUBLIC_` except the publishable key.
