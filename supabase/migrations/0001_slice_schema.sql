-- crm-master — Vertical Slice schema (increment 1)
-- Relationship-first. Operator-scoped. RLS default-deny per operator.
-- operator_id = auth.uid() (single-operator v1; schema multi-op ready).

create extension if not exists pg_trgm;
create extension if not exists fuzzystrmatch;

-- ============================================================
-- person — the contact (shared canonical record)
-- ============================================================
create table if not exists person (
  id              uuid primary key default gen_random_uuid(),
  operator_id     uuid not null references auth.users(id) on delete cascade,
  full_name       text not null,
  preferred_name  text,
  photo_url       text,
  current_company text,
  current_title   text,
  location        text,
  timezone        text,
  birthday        date,
  birthday_year_known boolean default true,
  vertical        text,
  how_we_met      text,
  bio             text,
  is_connector    boolean not null default false,
  is_target       boolean not null default false,
  source          text,                 -- 'people_api' | 'other_contacts' | 'manual' | 'linkedin'
  external_id     text,                 -- provider id for idempotent re-sync
  custom_fields   jsonb not null default '{}',
  archived        boolean not null default false,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_person_operator on person(operator_id) where deleted_at is null;
create unique index if not exists idx_person_external on person(operator_id, source, external_id)
  where external_id is not null and deleted_at is null;
create index if not exists idx_person_name_trgm on person using gin (full_name gin_trgm_ops);

-- ============================================================
-- contact_method — multi-channel (email/phone/social), normalized
-- ============================================================
create table if not exists contact_method (
  id               uuid primary key default gen_random_uuid(),
  operator_id      uuid not null references auth.users(id) on delete cascade,
  person_id        uuid not null references person(id) on delete cascade,
  type             text not null,        -- 'email'|'phone'|'linkedin'|'twitter'|'imessage'|'whatsapp'|'sms'|'other'
  value            text not null,        -- verbatim for display
  normalized_value text not null,        -- canonical match key
  label            text,                 -- 'work'|'home'|'mobile'
  preference_order int not null default 0,
  is_primary       boolean not null default false,
  automation_enabled boolean not null default false,
  verified         boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists idx_cm_person on contact_method(person_id);
create index if not exists idx_cm_match on contact_method(operator_id, type, normalized_value);
create unique index if not exists idx_cm_person_value on contact_method(person_id, type, normalized_value);
create unique index if not exists idx_cm_primary on contact_method(person_id, type) where is_primary;

-- ============================================================
-- operator_relationship — YOUR relationship to a person
-- Two axes: closeness (manual/seeded, slow) + engagement (computed, decays)
-- ============================================================
create table if not exists operator_relationship (
  id                  uuid primary key default gen_random_uuid(),
  operator_id         uuid not null references auth.users(id) on delete cascade,
  person_id           uuid not null references person(id) on delete cascade,
  closeness_score     numeric not null default 25,   -- 0..100, manual + seeded, no decay
  closeness_tier      text not null default 'acquaintance', -- inner_circle|close|known|acquaintance|cold
  engagement_score    numeric not null default 0,    -- decayed counter
  engagement_updated_at timestamptz not null default now(),
  last_touch_at       timestamptz,
  next_action_at      timestamptz,
  effective_cadence_days int,                          -- materialized from closeness tier / overrides
  cadence_override_days int,
  priority            int,
  owner_notes         text,
  created_at          timestamptz not null default now(),
  unique (operator_id, person_id)
);
create index if not exists idx_or_operator on operator_relationship(operator_id);
create index if not exists idx_or_next_action on operator_relationship(operator_id, next_action_at);

-- ============================================================
-- relationship_signals — metadata-derived aggregates (closeness seed)
-- NO raw headers/bodies, aggregates only
-- ============================================================
create table if not exists relationship_signals (
  id             uuid primary key default gen_random_uuid(),
  operator_id    uuid not null references auth.users(id) on delete cascade,
  person_id      uuid not null references person(id) on delete cascade,
  out_count      int not null default 0,
  in_count       int not null default 0,
  reciprocity    numeric,
  last_contact_at timestamptz,
  thread_count   int not null default 0,
  meeting_count  int not null default 0,
  direct_ratio   numeric,
  closeness_seed numeric,
  confidence     numeric,
  computed_at    timestamptz not null default now(),
  unique (operator_id, person_id)
);
create index if not exists idx_rs_operator on relationship_signals(operator_id);

-- ============================================================
-- interaction — first-class touch timeline (drives engagement)
-- ============================================================
create table if not exists interaction (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references auth.users(id) on delete cascade,
  person_id    uuid not null references person(id) on delete cascade,
  channel_type text,
  direction    text,                  -- 'inbound'|'outbound'
  type         text not null,         -- 'call'|'meeting'|'message'|'dm'|'email'|'linkedin_like'|'profile_view'|'birthday_msg'|'note'
  occurred_at  timestamptz not null default now(),
  automated    boolean not null default false,
  auto_status  text,                  -- 'manual'|'drafted'|'approved'|'sent'
  summary      text,
  content      text,
  source       text,                  -- 'granola'|'gmail'|'manual'|'phone'
  external_id  text,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists idx_int_person_time on interaction(person_id, occurred_at desc);
create index if not exists idx_int_operator on interaction(operator_id);
create unique index if not exists idx_int_external on interaction(operator_id, source, external_id)
  where external_id is not null;

-- ============================================================
-- nudge — the daily queue output
-- ============================================================
create table if not exists nudge (
  id               uuid primary key default gen_random_uuid(),
  operator_id      uuid not null references auth.users(id) on delete cascade,
  person_id        uuid not null references person(id) on delete cascade,
  type             text not null,      -- 'going_cold'|'overdue_followup'|'birthday'|'trigger'|'meeting_outcome'|'manual'
  title            text not null,
  reason           text,
  suggested_action text,
  suggested_channel text,
  priority         numeric not null default 0,
  surface_date     date not null default current_date,
  status           text not null default 'pending', -- 'pending'|'snoozed'|'done'|'dismissed'
  snoozed_until    timestamptz,
  draft_id         uuid,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
create index if not exists idx_nudge_queue on nudge(operator_id, surface_date, status, priority desc);
-- one open nudge per (person,type,day) — idempotent generation
create unique index if not exists idx_nudge_dedup on nudge(operator_id, person_id, type, surface_date)
  where status in ('pending','snoozed');

-- ============================================================
-- draft — AI message awaiting review (draft-default)
-- ============================================================
create table if not exists draft (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references auth.users(id) on delete cascade,
  person_id    uuid not null references person(id) on delete cascade,
  nudge_id     uuid references nudge(id) on delete set null,
  channel_type text,
  subject      text,
  body         text not null,
  draft_type   text not null default 'followup', -- followup|checkin|intro|birthday|milestone_update|propose_times
  status       text not null default 'draft',    -- draft|edited|approved|sent|discarded
  final_body   text,                              -- post-edit (feeds style learning later)
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
create index if not exists idx_draft_person on draft(person_id);

-- ============================================================
-- oauth_token — encrypted refresh tokens (service-role only)
-- ciphertext + iv + auth_tag; key lives OUTSIDE the DB
-- ============================================================
create table if not exists oauth_token (
  id               uuid primary key default gen_random_uuid(),
  operator_id      uuid not null references auth.users(id) on delete cascade,
  provider         text not null default 'google',
  email            text,
  ciphertext       bytea not null,     -- AES-256-GCM(refresh_token)
  iv               bytea not null,
  auth_tag         bytea not null,
  access_token     text,
  token_expiry     timestamptz,
  scopes           text,
  reauth_required  boolean not null default false,
  sync_state       jsonb not null default '{}',  -- cursors: gmail historyId, calendar/people syncToken
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (operator_id, provider)
);

-- ============================================================
-- RLS — default-deny, per-operator. (select auth.uid()) wrapped, TO authenticated.
-- oauth_token has NO authenticated policy → service-role only.
-- ============================================================
alter table person                enable row level security;
alter table contact_method        enable row level security;
alter table operator_relationship enable row level security;
alter table relationship_signals  enable row level security;
alter table interaction           enable row level security;
alter table nudge                 enable row level security;
alter table draft                 enable row level security;
alter table oauth_token           enable row level security;

do $$
declare t text;
begin
  foreach t in array array['person','contact_method','operator_relationship',
    'relationship_signals','interaction','nudge','draft']
  loop
    execute format($f$
      create policy %1$s_select on %1$I for select to authenticated
        using (operator_id = (select auth.uid()));
      create policy %1$s_insert on %1$I for insert to authenticated
        with check (operator_id = (select auth.uid()));
      create policy %1$s_update on %1$I for update to authenticated
        using (operator_id = (select auth.uid()))
        with check (operator_id = (select auth.uid()));
      create policy %1$s_delete on %1$I for delete to authenticated
        using (operator_id = (select auth.uid()));
    $f$, t);
  end loop;
end $$;

-- oauth_token: service role only (no authenticated policy = denied to clients)
create policy oauth_service_all on oauth_token for all to service_role
  using (true) with check (true);
