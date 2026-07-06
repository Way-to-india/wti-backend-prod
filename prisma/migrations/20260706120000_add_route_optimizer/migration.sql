-- Route Optimizer — additive DDL (P1).
-- Only the audit-log table is needed for P1 (road-only). The curated multimodal
-- option pool (transport_leg_options) and per-city constraints
-- (city_transport_profile) arrive in P2. world_cities / travel_modes /
-- osm_leg_distance already exist and are reused.

CREATE TABLE IF NOT EXISTS optimizer_runs (
  id          bigserial PRIMARY KEY,
  input       jsonb NOT NULL,
  objective   text  NOT NULL,
  plans       jsonb NOT NULL,
  created_by  bigint,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- osm_leg_distance already exists (created by the verified-route authoring
-- feature). Guard-create it here so a fresh DB can run the optimizer standalone.
CREATE TABLE IF NOT EXISTS osm_leg_distance (
  "fromName"    text NOT NULL,
  "toName"      text NOT NULL,
  km            numeric,
  "durationMin" integer
);
CREATE UNIQUE INDEX IF NOT EXISTS osm_leg_distance_pair_idx
  ON osm_leg_distance (lower("fromName"), lower("toName"));
