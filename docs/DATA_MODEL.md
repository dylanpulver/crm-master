# Data Model — Warm-Network Sourcing CRM

**Status:** design (v1 draft)
**Stack:** Postgres / Supabase

---

## Design principles

1. **Relationship-first, not pipeline-first.** The center of gravity is the **person** and
   **your relationship** with them. Deals/initiatives hang OFF relationships, not the reverse.
   A person with zero initiatives still gets warmed (general network). Most
   CRMs are pipeline-shaped; this one is relationship-shaped first.
2. **Warmth is the spine.** Every person has a computed warmth that drives cadence and nudges,
   independent of any deal.
3. **Operator-scoped relationships.** People + orgs are shared; *relationships, warmth, and
   nudges are per-operator*. This cleanly solves multi-operator (a small team): one shared
   contact graph, separate relationship layers. v1 = one operator (you).
4. **Initiatives are optional overlays** — general-warming, sales, fundraising. Each carries its
   own stages, objective, and cadence.
5. **Lean v1, extensible.** Type-specific extras go in `jsonb` rather than wide tables. Warmth
   formula is one tweakable function. Mark v1 vs later; don't build the advanced layers yet.

---

## Entity overview

```
operator ──< operator_relationship >── person ──< channel
                                         │  │
                                         │  └──< person_org >── organization
                                         │
person ──< relationship_edge >── person   (the web: who knows who)
                                         │
initiative ──< initiative_member >── person ──< stage_transition
                                         │
person ──< touchpoint >── (transcript, commitment)
person ──< trigger_event >──> nudge ──> draft
```

---

## Tables

### operator  *(multi-op; v1 = just you)*
`id · name · email · created_at`

### person  *(the node — shared across operators)*
- `id · full_name · preferred_name · photo_url`
- `current_company · current_title` (convenience; history in person_org)
- `location · timezone` (timezone for send-timing)
- `birthday` (date; year nullable) — free recurring touchpoint
- `vertical`
- `how_we_met · bio` (freeform relationship context)
- `is_connector bool · is_target bool` (non-exclusive)
- `created_at · updated_at · archived bool`

### channel  *(many per person — multi-channel requirement)*
- `id · person_id`
- `type` (email | phone | linkedin | imessage | whatsapp | sms | twitter | instagram | other)
- `handle` · `preference_order int` · `is_primary bool`
- `automation_enabled bool` (per-channel auto toggle) · `verified bool · notes`

### organization
`id · name · website · linkedin_url · vertical · notes`

### person_org  *(work history M:N — job changes = trigger source)*
`id · person_id · org_id · title · is_current bool · started_at · ended_at`

### relationship_edge  *(the web — person ↔ person)*
- `id · from_person_id · to_person_id`
- `nature` (knows | introduced_by | works_with | friend | family | invested_in | …)
- `strength int 1-10`
- `note · source · observed_at`
- Directed edges; query both ways. Powers intro-path finding **later** (deferred intelligence
  layer). v1: store + display only.

### operator_relationship  *(YOUR relationship to a person — per operator)*
Holds TWO distinct, orthogonal dimensions — do not conflate (see §Two dimensions):
- `id · operator_id · person_id`
- `closeness_score · closeness_tier` (acquaintance | known | close | inner_circle)
  — **qualitative, settable by hand**, seeded from how-we-met + relationship_edge strength.
  Slow-moving. Reflects depth of bond, not recent activity.
- `engagement_score · engagement_tier` (cold | warming | hot)
  — **computed** from touchpoint recency/frequency. The "front-of-mind" axis. This is what
  warming actions build and what the nudge engine keys off.
- `last_touch_at · next_action_at` (denormalized for fast queue queries)
- `cadence_override_days int null` (person-level cadence override)
- `priority int null` (manual: how much you want to invest here, independent of both scores)
- `owner_notes`
- UNIQUE(operator_id, person_id)

### initiative  *(context / campaign)*
- `id · operator_id · name`
- `type` (general_warming | sales | fundraising | custom)
- `objective text · objective_updated_at` (objectives evolve over time)
- `status` (active | paused | done)
- `default_cadence_days int`
- `created_at`

### initiative_member  *(person in an initiative — M:N)*
- `id · initiative_id · person_id`
- `stage text` (per-initiative pipeline stage — differs by type; see §Stages)
- `role` (target | champion | blocker | connector)
- `cadence_override_days int null`
- `objective_note` (why they're here)
- `fields jsonb` (type-specific: deal_value for sales, ask/check_size for fundraising)
- `status` (active | won | lost | dormant) · `closed_reason`
- `added_at · last_stage_change_at`

### stage_transition  *(velocity + conversion analytics)*
`id · initiative_member_id · from_stage · to_stage · at · dwell_hours numeric · by_operator`

### touchpoint  *(every interaction — drives warmth)*
- `id · person_id · operator_id · initiative_id null` (null = general warming, not deal-tied)
- `channel_type · direction` (inbound | outbound)
- `type` (call | meeting | message | dm | email | linkedin_like | profile_view |
  birthday_msg | note)
- `occurred_at`
- `automated bool · auto_status` (manual | drafted | approved | sent)
- `summary · content`
- `transcript_id null · sentiment null`
- `source` (granola | gmail | slack | linkedin | phone | manual)
- `external_id` (dedup for synced sources) · `metadata jsonb`

### transcript
`id · touchpoint_id · source · raw_text · summary · key_takeaways[] · action_items[] ·
url · created_at`
(Structured extraction — commitments/pain/signals — written to dedicated tables below.)

### commitment  *(extracted promises — powers overdue nudges + BRIEF)*
- `id · person_id · initiative_id null · operator_id`
- `who` (me | them) · `what` · `due_date null`
- `status` (open | done | overdue)
- `source_touchpoint_id`

### trigger_event  *("reach out now" signals)*
- `id · person_id`
- `type` (birthday | job_change | funding_news | new_post | cadence_gap | keyword_match | custom)
- `detected_at · source · payload jsonb`
- `status` (new | actioned | dismissed) · `nudge_id null`

### nudge  *(THE daily queue output)*
- `id · operator_id · person_id · initiative_id null · trigger_event_id null`
- `type` (going_cold | overdue_followup | birthday | trigger | meeting_outcome |
  new_in_initiative | manual)
- `title · reason · suggested_action · suggested_channel`
- `priority int · surface_date`
- `status` (pending | snoozed | done | dismissed) · `snoozed_until null`
- `draft_id null · created_at · resolved_at`

### draft  *(AI message awaiting review — draft-default automation)*
- `id · nudge_id null · person_id · channel_type`
- `subject null · body` · `draft_type` (followup | checkin | intro | birthday)
- `status` (draft | edited | approved | sent | discarded)
- `final_body null` (post-edit) — **body vs final_body diff feeds style learning (v2)**
- `created_at · sent_at null`

### style_profile  *(v2 — learned per-person tone)*  — deferred, noted only.

---

## Stages per initiative type

Stages are per-initiative text (not one global enum), because sales ≠ fundraising ≠ warming.
**Confirmed against observed practice in real sales and fundraising pipelines:**

- **general_warming:** `new → warming → warm → maintaining → dormant`
- **sales:** `target → meeting_requested → meeting_conducted → design_partner → customer`
  branches: `too_early/circle_back · not_interested/passed`
- **fundraising:** `target → warm_intro_secured → intro_meeting → partner_meeting → diligence →
  committed | passed`

**`circle_back` is first-class across all initiatives** — a "too early" contact is a future
nudge (re-surface date), not a dead lead. The **warm intro is the atom** of both sales and
fundraising → `relationship_edge.nature = introduced_by` + a battle-tested 19-status intro pipeline are
core, not deferred. Track `source` on person + initiative_member (feeds later channel-scoring).

---

## Two dimensions (don't conflate)

"Warmth" is overloaded. We track two orthogonal axes:

| | **Closeness** | **Engagement (front-of-mind)** |
|---|---|---|
| Means | depth of bond / how well you know them | are you in their consciousness right now |
| Moves | slowly | fast (each touch) |
| Set by | **manual + seeded** from background | **computed** from touchpoints |
| Drives | tone, priority, target cadence | **the nudge engine** (decay → reconnect) |
| Example | childhood friend = high, forever | … but gone quiet 6mo = low engagement → nudge |

A new prospect = low closeness, high engagement (actively courting). An old friend gone silent
= high closeness, low engagement. The actionable thing "warming" builds is **engagement**.

### Engagement scoring (v1 — simple, iterate)
Computed; stored on `operator_relationship`. Recomputed nightly + on each new touchpoint.
ONE tweakable function.
```
engagement = w_recency * recency_score(last_touch_at)        # decays with time
           + w_freq    * frequency_score(touches_trailing_90d)
           + w_depth   * depth_score(meeting/call > message > like/view)
           + w_recip   * reciprocity_score(inbound / outbound ratio)
```
Tiers (cold/warming/hot) by threshold. **Don't over-tune up front** — calibrate on real data.

### Closeness (qualitative)
Manually settable (slider/tier). Seeded on contact creation from how-we-met + max
`relationship_edge.strength`. Edited as the bond deepens. Does NOT decay with silence —
that's engagement's job. Closer / higher-priority people can carry a tighter target cadence.

---

## Cadence resolution (layered → drives decay/nudges)

Resolve target touch interval by first match:
```
1. operator_relationship.cadence_override_days   (per-person)
2. initiative_member.cadence_override_days        (per-person-per-initiative)
3. initiative.default_cadence_days                (per-initiative)
4. closeness-tier default                         (inner_circle=14d, close=30d,
                                                    known=60d, acquaintance=120d — tweakable)
```
Target cadence is driven by **closeness** (how often you WANT to stay in touch), not engagement.
Then: if `now - last_touch_at > target` → engagement has decayed below the bar → emit
`going_cold` nudge. (Engagement = the measured state; closeness = the desired frequency.)

---

## Nudge generation (the engine, runs nightly + on events)

- **going_cold** — cadence exceeded (above)
- **birthday** — birthday within N days
- **overdue_followup** — commitment.due_date passed, status=open
- **trigger** — new trigger_event (job change, funding, post)
- **meeting_outcome** — new transcript with action items
- Output → `nudge` rows → daily surface (sorted by priority, capped ~5,
  rest scrollable).

---

## v1 vs later

**v1 (build):** operator, person, channel, organization, person_org, operator_relationship,
initiative, initiative_member, touchpoint, transcript, commitment, nudge, draft + warmth +
cadence + nudge engine + daily surface. Manual + Granola/Gmail import.

**Later:** relationship_edge intro-path finding · trigger_event automation (job/funding/post
detection) · LinkedIn auto-reps · style_profile learning · self-improving channel scoring ·
phone-transcript spike · multi-operator activation.
