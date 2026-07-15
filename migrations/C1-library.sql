-- =============================================================================
-- SPRINT C1 — THE LIBRARY (itinerary memory + faceted retrieval)
-- Ruling doc: THE-LIBRARY-ARCHITECTURE-2026-07-15.md §2 (schema) as AMENDED by
-- §10.1 (stop roles + night classes) and §10.4 (structural hash, ltree variants).
--
-- ADDITIVE + IDEMPOTENT. No existing table is altered. ours-only in C1 (the trade is C3).
-- pgvector columns are DEFERRED to C2 (the experience/embedding layer): C1 stores NO
-- embeddings and makes NO LLM calls. Retrieval in C1 is pure SQL + arithmetic.
--
-- Apply on the box: strip ?pgbouncer=true from the line-36 DSN, then psql < this file.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS ltree;

-- ---- raw ingested itineraries (C1: all license_class='ours', our own 368 tours) ------
CREATE TABLE IF NOT EXISTS itinerary_sources (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  operator      text NOT NULL,
  url           text,
  title         text NOT NULL,
  our_tour_id   text,
  structure     jsonb NOT NULL DEFAULT '{}'::jsonb,
  license_class varchar(20) NOT NULL DEFAULT 'ours'
                CHECK (license_class IN ('ours','trade_structural')),
  fetched_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS itinerary_sources_tour_idx ON itinerary_sources(our_tour_id);

-- ---- the canonical unit: the BRANCH (§1) --------------------------------------------
-- struct_hash = ordered stay_node ids + entry_region + exit_region ONLY (§10.4: nights
-- live in bands; hashing nights would mint a false product per 1-night delta).
CREATE TABLE IF NOT EXISTS branches (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  label          text NOT NULL,
  struct_hash    text NOT NULL,
  entry_region   varchar(32),
  exit_region    varchar(32),
  states         text[] NOT NULL DEFAULT '{}',
  nights_min     smallint NOT NULL,
  nights_max     smallint NOT NULL,
  chips          text[] NOT NULL DEFAULT '{}',
  season_mask    smallint NOT NULL DEFAULT 4095,   -- 12-bit month mask (Jan=bit0). 4095=all.
  body_class     varchar(24) NOT NULL DEFAULT 'standard'
                 CHECK (body_class IN ('standard','moderate','high_altitude','strenuous')),
  reversible     boolean NOT NULL DEFAULT true,     -- §10.1 orientation-free branches
  evidence_count integer NOT NULL DEFAULT 1,
  our_tour_id    text,                              -- the receipt: our owning tour
  path           ltree,                             -- §10.4 variant tree (child = extension)
  needs_review   boolean NOT NULL DEFAULT true,     -- ours-only law: unverified until ticked
  verified_at    timestamptz,
  verified_by    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS branches_struct_hash_uniq ON branches(struct_hash);
CREATE INDEX IF NOT EXISTS branches_entry_region_idx ON branches(entry_region);
CREATE INDEX IF NOT EXISTS branches_states_gin ON branches USING gin(states);
CREATE INDEX IF NOT EXISTS branches_chips_gin  ON branches USING gin(chips);
CREATE INDEX IF NOT EXISTS branches_path_gist  ON branches USING gist(path);
CREATE INDEX IF NOT EXISTS branches_tour_idx   ON branches(our_tour_id);

-- ---- branch stops, WITH ROLES + NIGHT CLASSES (§10.1, the deepest catch) -------------
CREATE TABLE IF NOT EXISTS branch_stops (
  id                 text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  branch_id          text NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  ord                smallint NOT NULL,
  stay_node_id       text NOT NULL REFERENCES stay_nodes(id) ON DELETE RESTRICT,
  nights_min         smallint NOT NULL,
  nights_max         smallint NOT NULL,
  role               varchar(24) NOT NULL DEFAULT 'SUPPORT'
                     CHECK (role IN ('MANDATORY_GATE','MANDATORY_TRANSFER','ANCHOR',
                                     'SUPPORT','OPTIONAL','BUFFER','RECOVERY')),
  night_class        varchar(12) NOT NULL DEFAULT 'FLEXIBLE'
                     CHECK (night_class IN ('FIXED','FLEXIBLE','OPTIONAL')),
  themes             jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{chip, strength}] §4b.1
  experience_text_id text,
  needs_review       boolean NOT NULL DEFAULT true,
  UNIQUE(branch_id, ord)
);
CREATE INDEX IF NOT EXISTS branch_stops_branch_idx ON branch_stops(branch_id);
CREATE INDEX IF NOT EXISTS branch_stops_node_idx   ON branch_stops(stay_node_id);

-- ---- evidence (dedup count = popularity tie-break, never opens a gate) ----------------
CREATE TABLE IF NOT EXISTS branch_evidence (
  id                    text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  branch_id             text NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  source_id             text REFERENCES itinerary_sources(id) ON DELETE SET NULL,
  our_tour_id           text,
  structural_similarity numeric(4,3) NOT NULL DEFAULT 1.0,
  UNIQUE(branch_id, our_tour_id)
);

-- ---- aliases: STAGE 0 name match ("Nau Devi Yatra" is a lookup, not a search) --------
CREATE TABLE IF NOT EXISTS branch_aliases (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  alias      text NOT NULL,
  norm_alias text NOT NULL,                    -- lower, non-alpha stripped, h-drift removed
  branch_id  text NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  source     varchar(16) NOT NULL DEFAULT 'title'
             CHECK (source IN ('founder','query_log','title')),
  approved   boolean NOT NULL DEFAULT false,   -- founder-approved before it binds (§5)
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(norm_alias, branch_id)
);
CREATE INDEX IF NOT EXISTS branch_aliases_norm_idx   ON branch_aliases(norm_alias);
CREATE INDEX IF NOT EXISTS branch_aliases_branch_idx ON branch_aliases(branch_id);

-- ---- experience texts: stop × theme, OURS ONLY (§3 copyright law). Schema present in
--      C1; the write-once generation + embeddings are C2. C1 serves day text via the
--      existing tour_itinerary overlay (US-871), so this table is only lightly seeded.
CREATE TABLE IF NOT EXISTS experience_texts (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  stay_node_id text NOT NULL REFERENCES stay_nodes(id) ON DELETE CASCADE,
  theme        varchar(48),                    -- one of the 8 chips, or NULL = theme-agnostic
  our_tour_id  text,
  day          smallint,
  text         text NOT NULL,
  source       varchar(24) NOT NULL DEFAULT 'tour_itinerary',
  needs_review boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS experience_texts_node_theme_idx ON experience_texts(stay_node_id, theme);

-- ---- coverage (the gap map, §6): node × theme → covering-branch count -----------------
CREATE OR REPLACE VIEW branch_coverage AS
  SELECT bs.stay_node_id,
         (t->>'chip') AS chip,
         count(DISTINCT bs.branch_id) AS branches
    FROM branch_stops bs,
         LATERAL jsonb_array_elements(bs.themes) AS t
   GROUP BY bs.stay_node_id, t->>'chip';

-- ---- the FOUNDER REVIEW QUEUE for tour_stays corrections (the double-win, §3/§8) ------
-- The sleep-event parser (§10.4) PROPOSES a corrected skeleton; nothing is silently
-- applied. Each row is a proposal the founder ticks. tour_stays itself is untouched by
-- C1; only ADMIN-verified rows are trusted for serving, everything else needs_review.
CREATE TABLE IF NOT EXISTS tour_stays_review (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tour_id       text NOT NULL,
  proposed      jsonb NOT NULL,               -- [{order, name, stay_node_id, nights, why}]
  current_stays jsonb NOT NULL,               -- what tour_stays holds today
  delta_kind    varchar(16) NOT NULL          -- 'town_set' | 'nights' | 'order' | 'ok'
                CHECK (delta_kind IN ('town_set','nights','order','ok','unparsed')),
  confidence    numeric(3,2) NOT NULL DEFAULT 0.50,
  parser_note   text,
  serve_freq    integer NOT NULL DEFAULT 0,   -- ordered by expected serving frequency (§3)
  resolved      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tour_id)
);
CREATE INDEX IF NOT EXISTS tour_stays_review_unresolved_idx
  ON tour_stays_review(resolved, confidence) WHERE NOT resolved;

-- =============================================================================
-- END C1 library DDL
-- =============================================================================
