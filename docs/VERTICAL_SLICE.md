# Vertical Slice — Increment 1 (the thin loop)

**Goal:** the smallest end-to-end loop you'd actually use daily. Build this FIRST, ugly,
before widening into the full backlog. Proves the behavioral core works.

**The loop:**
```
import your network  →  seed closeness  →  detect going-cold  →  daily digest
   →  approve one AI draft  →  log the touch  →  (repeat tomorrow)
```

## In scope (slice)
1. **Auth + shell** — Next.js + Supabase, single operator (you), DAL + RLS scaffolding,
   operator_id from day one.
2. **Import** — Google People API (`connections.list` + `otherContacts.list`) → `person` +
   `contact_methods`. Your real network in.
3. **Closeness seed** — Gmail+Calendar **metadata only** (format=METADATA, no bodies) → compute
   `closeness_seed` per contact, store aggregates. Auto-tier; you bulk-confirm top ~150.
4. **Engagement + going-cold** — decayed-counter engagement; nightly job (Vercel cron to start)
   flags contacts past their closeness-tier cadence → writes `nudge` rows.
5. **Daily digest** — Resend + React Email, top 5 nudges, HMAC-signed one-tap action links.
6. **One draft type** — `followup` via Claude Opus, grounded in that contact's history (SQL
   retrieval, no vectors), draft-default.
7. **Log touch** — one tap logs an interaction → resets cadence → updates engagement.

## OUT of scope (slice) — deferred to later milestones
- relationship_edge / intro-pipeline · initiatives (sales/fundraising) · milestone fan-out
- transcript ingestion (Granola/voice-memo) · style learning / edit-diffs · other draft types
- LinkedIn import/automation · identity-resolution fuzzy pass (deterministic-only in slice)
- Inngest (Vercel cron is enough for one nightly job) · PWA push (email digest only) · multi-op

## Done = you can, for a week:
Open the morning digest → see the right 5 people going cold → approve a grounded draft → it
sends → the touch logs → tomorrow's list reflects it. If that loop feels worth doing daily,
the thesis holds and we widen. If not, we fix the loop before building anything else.

## Build order within the slice
1. Scaffold + auth + schema (person, contact_methods, operator_relationship, interaction, nudge,
   draft) + DAL/RLS
2. Google OAuth + People API import (deterministic dedup only)
3. Metadata closeness-seed + auto-tier + bulk-confirm UI
4. Engagement decayed-counter + nightly going-cold nudge gen (Vercel cron)
5. Resend digest + HMAC signed-action links (snooze/log instant; send = confirm page)
6. Opus followup draft grounded in SQL-retrieved history
7. Log-touch action closes the loop
