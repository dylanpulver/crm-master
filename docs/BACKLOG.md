# Build Backlog — Sourcing CRM

Maps to [[DATA_MODEL.md]] v1 cut. Grouped by milestone.

Legend: `[S]` small (<½d) · `[M]` medium (~1-2d) · `[L]` large (3d+)

---

## M0 — Foundation
- `[S]` Scaffold Next.js + Supabase app (auth, env, deploy to Vercel)
- `[S]` Supabase project + RLS baseline (operator-scoped policies)
- `[S]` Auth: operator login (single-operator v1, schema multi-op ready)
- `[S]` CI + preview deploys

## M1 — Data model (schema)
- `[M]` Migrate core tables: operator, person, channel, organization, person_org
- `[M]` operator_relationship (closeness + engagement + cadence override + priority)
- `[M]` relationship_edge + intro-pipeline statuses (warm-intro state machine — CORE, per methodology)
- `[M]` initiative + initiative_member + stage_transition
- `[M]` touchpoint + transcript + commitment
- `[M]` milestone entity (new customer/metric/expansion) + initiative link
- `[S]` trigger_event + nudge + draft
- `[S]` Seed closeness/engagement tier enums + cadence-tier defaults

## M2 — Core CRUD + import
- `[M]` Person CRUD UI (create/edit/archive, multi-channel, birthday, roles)
- `[S]` Organization CRUD + person_org work history
- `[M]` Contact list/table: filter by initiative, sort by staleness/engagement/closeness
- `[M]` Person detail page: timeline (touchpoints), channels, initiatives, relationship edges
- `[M]` Touchpoint logging (manual): call/meeting/message/note + channel + direction
- `[M]` Manual closeness set (slider/tier) + priority
- `[M]` CSV/manual contact import

## M3 — Discipline engine
- `[M]` Engagement scoring function (recency/freq/depth/reciprocity) + nightly recompute
- `[S]` Recompute engagement on new touchpoint
- `[M]` Cadence resolution (4-layer) + target interval per person
- `[M]` Nudge generator: going_cold (engagement decay vs closeness target)
- `[S]` Nudge generator: birthday (within N days)
- `[S]` Nudge generator: overdue_followup (commitment due passed — tight thresholds)
- `[S]` Nudge generator: meeting_outcome (new transcript w/ action items)
- `[M]` Milestone fan-out: trigger-nudges across initiative warm contacts (news = the hook)
- `[S]` Intro-pipeline nudges (ask-if-placed → intro-booked → thank-referrer)

## M4 — Daily surface (THE product)
- `[L]` Daily nudge queue UI: prioritized, capped ~5 + scrollable, mobile-friendly
- `[M]` Batch-clearing flow: draft → approve → next (rapid sequential — per real behavior)
- `[M]` Nudge actions: done / snooze / dismiss / log-touch-from-nudge
- `[M]` Per-contact BRIEF card (AI: history → commitments → next action → risk)
- `[S]` Daily briefing narrative (AI, 3-5 items, leads w/ urgent)

## M5 — AI layer
- `[M]` Claude integration + prompt scaffolding (brief/draft/briefing/transcript)
- `[M]` DRAFT generation (followup/checkin/intro/birthday), draft-default
- `[M]` Draft types: milestone_update + propose_times (dual-tz slots)
- `[M]` Draft review UI: edit → approve → mark sent; store final_body
- `[M]` TRANSCRIPT processor: transcript → commitments/pain/signals/follow-up-date
- `[S]` Per-initiative brief variants (investor brief for fundraising)

## M6 — Sync / activity capture (v1: Granola + Gmail)
- `[M]` Granola sync (read-only API, dedup by note id) → touchpoints + transcripts
- `[M]` Gmail sync (OAuth, in/out, match to person) → touchpoints
- `[S]` Sync state tracking + manual re-sync trigger

---

## Later (post-v1, separate projects)
- Style learning from draft edits (body vs final_body)
- LinkedIn auto-reps (profile views, likes) via browser-harness
- Trigger automation: job-change / funding / new-post detection
- Intro-path finding over relationship_edge graph
- Self-improving channel scoring (conversion feedback loop)
- Phone-call transcript spike (record + transcribe own calls)
- Slack sync
- Multi-operator / team activation
