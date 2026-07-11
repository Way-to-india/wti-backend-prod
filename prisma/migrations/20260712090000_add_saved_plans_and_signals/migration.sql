-- =============================================================================
-- US-701 / US-403 / US-505 / US-506 — the plan becomes a THING, not a page view.
--
-- House convention (DB-STORAGE-DECISION-us403-us505.md §0): route-optimizer tables
-- are RAW SQL, not Prisma models, read via prisma.$queryRaw. Additive, guard-created,
-- zero backfill. Every column is nullable or defaulted. Nothing existing can break.
--
-- THE ONE NON-NEGOTIABLE LINE: the share token is a uuid, never a bigserial. A
-- sequential id in a public share URL (/plan/1042) lets a stranger walk 1041, 1043 …
-- and read other families' trips, their dates, and who is travelling.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- US-505a / US-701: a saved, shareable plan. The uuid IS the share token.
CREATE TABLE IF NOT EXISTS saved_plans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- OWNERSHIP: a CONTACT owns the plan; a full account is optional and may come later.
  -- All owner columns may be NULL: that is the anonymous explorer, and law #1 allows him
  -- ("give the whole plan away — no gate, no telephone number").
  owner_user_id         text,
  owner_email           text,
  owner_phone           text,
  owner_channel         text,
  claim_token           uuid,
  claimed_at            timestamptz,
  consent_marketing     boolean NOT NULL DEFAULT false,
  title                 text,
  input                 jsonb NOT NULL,
  payload               jsonb,
  understanding         jsonb,
  status                text NOT NULL DEFAULT 'draft',
  auto_saved            boolean NOT NULL DEFAULT true,
  shared_at             timestamptz,
  opened_count          integer NOT NULL DEFAULT 0,
  last_opened_at        timestamptz,
  plan_visibility       text NOT NULL DEFAULT 'link',
  discussion_visibility text NOT NULL DEFAULT 'members',
  lead_id               text,
  run_id                bigint,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_plans_owner_idx ON saved_plans (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS saved_plans_email_idx ON saved_plans (lower(owner_email));
CREATE INDEX IF NOT EXISTS saved_plans_phone_idx ON saved_plans (owner_phone);
CREATE INDEX IF NOT EXISTS saved_plans_claim_idx ON saved_plans (claim_token) WHERE claim_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS saved_plans_title_idx ON saved_plans (lower(title));
CREATE INDEX IF NOT EXISTS saved_plans_lead_idx  ON saved_plans (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS saved_plans_sweep_idx ON saved_plans (created_at)
  WHERE lead_id IS NULL AND owner_email IS NULL AND owner_phone IS NULL AND shared_at IS NULL;

-- US-505b: who is on the trip. EACH JOINER = A REACHABLE CONTACT.
CREATE TABLE IF NOT EXISTS plan_members (
  id                bigserial PRIMARY KEY,
  plan_id           uuid NOT NULL REFERENCES saved_plans(id) ON DELETE CASCADE,
  user_id           text,
  display_name      text NOT NULL,
  email             text,
  phone             text,
  channel           text,
  consent_marketing boolean NOT NULL DEFAULT false,
  role              text NOT NULL DEFAULT 'member',
  physio_class      text,
  tpp               jsonb,
  vote              text,
  vote_note         text,
  voted_at          timestamptz,
  joined_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_members_contact_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS plan_members_plan_contact_idx
  ON plan_members (plan_id, lower(coalesce(email, phone)));
CREATE INDEX IF NOT EXISTS plan_members_plan_idx  ON plan_members (plan_id);
CREATE INDEX IF NOT EXISTS plan_members_email_idx ON plan_members (lower(email));
CREATE INDEX IF NOT EXISTS plan_members_phone_idx ON plan_members (phone);

-- US-505d: PLAN HISTORY — an append-only snapshot each time a plan is (re-)solved.
CREATE TABLE IF NOT EXISTS plan_revisions (
  id              bigserial PRIMARY KEY,
  plan_id         uuid NOT NULL REFERENCES saved_plans(id) ON DELETE CASCADE,
  revision        integer NOT NULL,
  reason          text,
  actor_member_id bigint REFERENCES plan_members(id) ON DELETE SET NULL,
  input           jsonb NOT NULL,
  payload         jsonb,
  days            smallint,
  ease_score      smallint,
  peak_fatigue    numeric,
  cost_pp_min     integer,
  cost_pp_max     integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS plan_revisions_plan_rev_idx ON plan_revisions (plan_id, revision);
CREATE INDEX IF NOT EXISTS plan_revisions_plan_idx ON plan_revisions (plan_id, created_at DESC);

-- US-505c/e: FAMILY NOTES. Names, dates, opinions. Members-only by default.
CREATE TABLE IF NOT EXISTS plan_comments (
  id         bigserial PRIMARY KEY,
  plan_id    uuid NOT NULL REFERENCES saved_plans(id) ON DELETE CASCADE,
  member_id  bigint REFERENCES plan_members(id) ON DELETE SET NULL,
  parent_id  bigint REFERENCES plan_comments(id) ON DELETE CASCADE,
  day        smallint,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at  timestamptz,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS plan_comments_plan_idx   ON plan_comments (plan_id, day, created_at);
CREATE INDEX IF NOT EXISTS plan_comments_parent_idx ON plan_comments (parent_id);

-- US-403a: the episode corpus. APPEND-ONLY. Start writing on day one.
CREATE TABLE IF NOT EXISTS route_episodes (
  id           bigserial PRIMARY KEY,
  run_id       bigint,
  plan_id      uuid,
  region       text,
  context      jsonb NOT NULL,
  presented    jsonb,
  behavior     jsonb,
  committed    jsonb,
  outcome      jsonb,
  observations jsonb,
  weight       numeric NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS route_episodes_region_idx ON route_episodes (region, created_at DESC);
CREATE INDEX IF NOT EXISTS route_episodes_run_idx    ON route_episodes (run_id);

-- US-403b: the learned coefficients. VERSIONED, never overwritten, so a bad batch
-- can be rolled back (spec 15.4.4 replay validation).
CREATE TABLE IF NOT EXISTS route_coeffs (
  id               bigserial PRIMARY KEY,
  region           text NOT NULL DEFAULT 'global',
  version          integer NOT NULL,
  coeffs           jsonb NOT NULL,
  episodes_applied integer NOT NULL DEFAULT 0,
  active           boolean NOT NULL DEFAULT false,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS route_coeffs_region_version_idx ON route_coeffs (region, version);
CREATE UNIQUE INDEX IF NOT EXISTS route_coeffs_one_active_idx     ON route_coeffs (region) WHERE active;

-- US-506: DEMAND SIGNALS. Written on EVERY solve, signed-in or not.
-- FIREWALLED: this feeds the BUSINESS. learn.ts must never read it, and it must never
-- write to route_coeffs. A popular road is not a faster road.
CREATE TABLE IF NOT EXISTS route_demand (
  id             bigserial PRIMARY KEY,
  run_id         bigint,
  plan_id        uuid,
  request_text   text,
  cities         text[],
  start_city     text,
  end_city       text,
  must_see       text[],
  month          smallint,
  nights         smallint,
  pax            smallint,
  profile        text,
  physio_classes text[],
  purpose        text,
  budget_pp_min  integer,
  budget_pp_max  integer,
  outcome        text,
  dropped_cities text[],
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS route_demand_month_idx   ON route_demand (month);
CREATE INDEX IF NOT EXISTS route_demand_profile_idx ON route_demand (profile, created_at DESC);
CREATE INDEX IF NOT EXISTS route_demand_cities_idx  ON route_demand USING gin (cities);
CREATE INDEX IF NOT EXISTS route_demand_outcome_idx ON route_demand (outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS route_demand_plan_idx    ON route_demand (plan_id);
