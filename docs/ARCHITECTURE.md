# Architecture Decisions — Build Prep

**Status:** decided (from SOTA research, 2025-2026)
**Companion to:** [[DATA_MODEL.md]]
Per-subsystem locked technical approach + the findings that changed the plan.

---

## ⚠️ Findings that CHANGE the plan (read first)

1. **Google CASA verification is the real external gate.** Restricted scopes (Gmail/Contacts/
   Calendar read) require an **annual, paid security assessment** ($5K–$75K+) for a *public*
   app. BUT the **personal-use exemption** covers us: "only user is you, or a few users all
   known personally to you," hard cap **100 users**. → Build personal/single-user. You plus a
   handful of known users = still exempt. **Do NOT productize to strangers without budgeting CASA.** This
   reshapes the SaaS daydream — stays personal tool for now. Minimize scopes to lower future CASA tier.

2. **Never store email bodies.** For closeness inference, use Gmail `format=METADATA` only
   (headers + dates, no body), fold into per-contact counters in memory, **store only
   aggregates**, discard raw headers. Privacy + shrinks CASA surface.

3. **No vector DB, no fine-tuning in v1.** Long context (Claude 1M) + structured SQL retrieval
   per-contact beats RAG at our scale (one person's history = a few K tokens). Removes a whole
   infra class from the backlog. Add pgvector later only for cross-contact semantic recall.

4. **Job architecture is two-pronged, not one tool:** Supabase **pg_cron + pgmq Queues** for
   nightly DB-centric work (score recompute, nudge gen, digest) + **Inngest** for event-driven
   fan-out (milestone, transcript, sync) with per-step retries. Trigger.dev held in reserve only
   for any single step >800s (Vercel ceiling).

5. **One-tap actions = HMAC-signed links, NOT AMP email.** AMP is dead (Apple Mail unsupported,
   and you're on Apple). Signed single-use action URLs work everywhere.

6. **Edit-diffs are the style-learning substrate.** Capture every `(draft → edited → sent)`
   tuple — denser signal than sent messages. This is what makes "it's learning" real.

---

## 1. People Graph & Store

- **Edge table** for person↔person (NOT adjacency/closure — only edge tables handle cyclic
  social graphs). Two-row mirrored storage for symmetric "knows" (clean single-column neighbor
  lookups); directed single rows for asymmetric (`introduced_by`, `reports_to`).
- **Traversal via recursive CTE** + `CYCLE` clause (PG14+) + depth cap. **Apache AGE is NOT on
  hosted Supabase**; `pg_graphql` ≠ graph traversal. Fine at our scale (<10K nodes) — "the
  performance argument for a graph engine doesn't exist." Precompute/cache intro-paths async;
  never traverse on every read.
- **`contact_methods` child table** (generic, vCard/People-API shape): `type, value,
  normalized_value, label, is_primary, automation_enabled`. `normalized_value` is the hot dedup
  key — a real indexed column, not JSONB. Email lowercase+trim (Gmail dot/plus only for gmail);
  phone→E.164 (libphonenumber); social→canonical handle.
- **JSONB hybrid:** `custom_fields jsonb` + GIN for the long tail; **promote any field you
  filter/sort on to a real column**.
- **person ≠ operator** (separate tables, nullable link). **org via `affiliation`** join table
  with date ranges (people change employers). **Soft-delete** everywhere + partial unique
  indexes `WHERE deleted_at IS NULL`. **Audit log** + **merge tombstones** from day one.
- **Interactions are first-class** rows (not graph edges) — needed for the timeline.
- Reference schema: **Monica HQ** (open source) — typed contact-field pattern, reciprocal
  relationship edges with reverse-name labels, approximate-date columns (birthday year often
  unknown).

## 2. Scoring Engine

- **Two axes, never blended into one number** (research strongly confirms the design).
- **CLOSENESS** `[0,100]` — manual + seeded, **no decay**. Seed tiers (inner_circle=90,
  close=70, friend=50, acquaintance=25, cold=10). Drives *desired* cadence + tone.
- **ENGAGEMENT** — a **decayed counter** (O(1) updates, no history replay):
  ```
  on interaction:  engagement ← engagement · 2^(−Δt/H) + (w · r)
  nightly:         engagement ← engagement · 2^(−Δt/H)
  w (depth): meeting/call=8, real thread=4, short reply=2, like/view=1
  r (reciprocity): 0.5 + 0.5·min(in,out)/max(in,out,1)   # penalize one-sided
  H (half-life) = 60 days  (calibrate by sweeping {30,45,60,90} against your gut)
  display: warmth = engagement/(engagement+10)  → 0..1
  ```
- **Nudge priority = `closeness · max(expected − normalized_engagement, 0)`** — a 90-closeness
  contact gone cold tops the list; a 20-closeness acquaintance barely registers. THIS is where
  the two axes combine, and only here.
- **Feedback loop (v1.5):** log nudge acted/snoozed/dismissed; ×0.7 suppression per dismissal,
  reset on action. Interpretable, no ML.
- Keep <10 signals, coarse weights. Calibrate on real data; don't theorize.

## 3. Cadence & Nudge Engine

- **Tiered cadence** (4-5 buckets: weekly/monthly/quarterly/yearly), resolved
  `person override > initiative > closeness-tier default` → **materialize
  `effective_target_cadence_days`** per contact (don't recompute everywhere).
- **Snooze ≠ logged-touch** (model explicitly): snooze defers surfacing; logged-touch resets the
  cadence clock.
- **Jobs:** nightly `nudge.generate` (pg_cron→pg_net→Edge Fn→pgmq queue, idempotent upsert into
  `nudge_queue`); event `milestone.landed` → **Inngest fan-out** (one durable retriable step per
  warm contact). Queue lives in Postgres (source of truth); Inngest orchestrates only.
- **Decouple generation (nightly) from delivery (one daily digest at your review time).**
- **Ranking:** linear weighted score (config, not code): `urgency + closeness +
  overdue_ratio(cap 3) + decaying event_boost − recency/snooze penalty`. Re-rank on state change.
- **Anti-fatigue:** hard daily cap 5-7, single digest, frictionless varied snooze that closes
  the loop, Fogg B=MAP (tiny <2min review, anchored to a routine, positive "cleared" moment).
  Gentle progress framing over brittle streaks.
- **Milestone fan-out guardrails:** target warm slice only, dedupe vs existing nudges, **spread
  across the event window** (don't dump all day-one), respect the daily cap, event_boost decays
  fast (job-change ~90d, funding immediate).

## 4. Daily Surface / Push Digest

- **Email-first: Resend + React Email** (free tier ample; Postmark = deliverability upgrade if
  needed). Authenticate domain (SPF/DKIM/DMARC).
- **One-tap = HMAC-signed action links** (`{action,nudgeId,exp}` + HMAC): short expiry,
  **single-use/burn** (idempotent), HTTPS. Snooze/log-touch execute on tap; **send requires a
  confirm page** (POST) — also dodges email-scanner prefetch.
- **iOS PWA push** (home-screen install, Safari 18.4 Declarative Web Push) = "digest ready"
  tap-through to the batch-clear queue. SMS (Twilio) = optional late-day escalation only.
- **Batch-clear UX:** card-stack, swipe right=send / left=snooze / down=log, optimistic + 5s
  undo, **Mac keyboard shortcuts** (J/K/E/S/L). "Inbox-zero" completion state.

## 5. AI Intelligence

- **NO vectors, NO fine-tuning v1.** Structured SQL retrieval of a contact's history → stuff
  context. Add pgvector (hybrid search) later only for over-budget contacts / cross-contact recall.
- **Models:** drafting `claude-opus-4-8` (needs less anti-slop scaffolding, warmer prose);
  briefs `claude-sonnet-4-6`; transcript extraction `claude-haiku-4-5` (+ **Batches API** 50%
  off for historical backfill).
- **Drafts:** 5-part skeleton (subject/opener/value/soft-ask/sign-off), <150 words, **negative
  constraints** in system prompt (ban "hope this finds you well," buzzwords, em-dash tics),
  ground every specific claim in a retrieved fact (**Citations** feature).
- **Style learning = few-shot + distilled style profile + edit-diffs** (the premium signal). Two
  scopes: user voice (primary) + per-recipient. **Frame as progressive approximation, not voice
  cloning** (perfect implicit-style imitation is an unsolved 2025 problem — the edit loop is a
  permanent feature, not a crutch). Prompt-cache the stable style prefix.
- **Transcript → structured output** (`output_config` json_schema / `messages.parse()` + Zod),
  feed **speaker labels + meeting date** (relative dates unrecoverable otherwise). **3 validation
  gates** (owner completeness, task specificity, deadline parseable) before any auto-write;
  failures → human queue. (Structured outputs are incompatible with Citations — separate passes.)

## 6. Ingestion & Sync

- **Cold-start = 3-source pipeline:** (1) **People API** spine (`connections.list` pageSize 1000
  + `otherContacts.list` — people you've emailed but never saved); (2) **Gmail+Calendar metadata
  signal** → closeness_seed; (3) **LinkedIn CSV** enrichment (manual export only — scraping
  violates ToS).
- **closeness_seed formula** from metadata: `frequency(log1p(out+in)) + recency(exp(-days/180)) +
  reciprocity + directness + meetings(log1p)` → sigmoid → 0-100. Calendar meetings = highest
  weight. Store aggregates + confidence, **never headers/bodies**.
- **Identity resolution: deterministic-first** (normalize email/phone/linkedin, exact-match
  auto-merge) → **pg_trgm + fuzzystrmatch** fuzzy pass (Jaro-Winkler name ≥0.85, Metaphone
  ≥0.90). **Skip Splink/dedupe.io/ML** (overkill at thousands). Tiers: ≥0.95 auto-merge,
  0.80-0.95 review queue.
- **Soft-merge / canonical-pointer** (never hard-delete): `person ← person_source_record ←
  person_identity` + field-level survivorship + `merge_event` snapshot → **reversible unmerge**.
- **Sync: poll, not push.** Cursor per source (Gmail `historyId`, Calendar/People `syncToken`);
  handle **cursor-death** (Gmail 404 / Calendar 410 / People 429 EXPIRED → full resync — never
  blind-retry those). Idempotent upserts on provider `external_id`. Batch `messages.get` (100/req,
  throttle ~300/min). Quotas: Gmail 6K units/min.
- **Interactions:** `interaction` + `interaction_participant` n:m join (role-tagged, nullable
  person_id backfilled on merge). Thread email via JWZ on References/In-Reply-To + trust Gmail
  threadId. Transcripts: roster from calendar attendees, speaker→person probabilistic/overridable.
- **Noise filter:** drop no-reply/bulk (List-Unsubscribe/Precedence headers); demote one-off
  senders; keep anyone you've sent to / met / saved.

## 7. Automation / Execution

- **Send: email-only v1** (Gmail API / Resend). LinkedIn = browser-harness later (+ ban risk);
  iMessage/SMS = draft-to-clipboard until later.
- **Draft-by-default everywhere**; per-channel + per-person auto toggles, earned carefully.
- **LinkedIn reps** (profile views/likes) = semi-auto (queue → you confirm) early; full-auto via
  browser-harness with anti-bot cadence later. Account-risk is real.

## 8. Platform / Infra & Security

- **Jobs:** pg_cron + pgmq (nightly) + Inngest (events) + Trigger.dev (escape hatch >800s).
- **DAL-centric Next.js:** all auth/authz/DB/`process.env` in a `server-only` Data Access Layer;
  Server Actions thin + re-check auth (every action = public POST endpoint); **middleware =
  session refresh only, NOT authz** (CVE-2025-29927). `getUser()`/`getClaims()`, never trust
  `getSession()`.
- **RLS default-deny on every PII table**, `operator_id` in JWT via Custom Access Token Hook,
  `(select auth.uid())` wrapping + indexed policy cols + `TO authenticated`. Build the operator_id
  model **day one** even single-user (safety net, painful to retrofit).
- **New keys:** `sb_publishable_` (browser) / `sb_secret_` (server, 401s in browser).
- **OAuth tokens:** own the refresh lifecycle (Supabase doesn't persist Google tokens).
  **AES-256-GCM, key OUTSIDE the DB** (Vercel Sensitive env / KMS), ciphertext in BYTEA,
  service-role-only, decrypt only at call time. Vault as the Supabase-native alternative. **Avoid
  pgsodium** (deprecating).
- **Backups:** Pro daily + scheduled encrypted off-site `pg_dump` (survives account compromise).
- **Deletion/retention built now:** on OAuth revoke → hard-delete tokens+synced data + call
  Google revocation. Retention prune on synced rows.

---

## Net effect on the build

- **Simpler than feared:** no vector DB, no fine-tuning, no graph engine — all deferred or
  unnecessary at our scale. Postgres + Claude long-context + Inngest covers it.
- **One hard external constraint:** Google CASA → stay personal/<100 known users. Shapes scope
  (personal tool, not open SaaS) but doesn't block the build.
- **A few new must-dos surfaced:** metadata-only Gmail (no bodies), signed-action-link security,
  soft-merge reversibility, cursor-death resync paths, DAL+RLS from day one, encrypted token
  storage. All folded into the relevant milestones.
- **Vertical-slice path is clear:** People-API import → closeness_seed → going_cold nudge →
  daily digest (Resend + signed actions) → one Opus draft → log touch. Smallest real loop.
