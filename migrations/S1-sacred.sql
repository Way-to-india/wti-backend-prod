-- =============================================================================
-- S1 — SACRED TEMPLE CIRCUITS (Jyotirlinga, Char Dham, Chota Char Dham,
-- Arupadai Veedu, Navagraha, Shakti Peetha, Divya Desam). Same traversal engine
-- as the UNESCO layer. ADDITIVE + IDEMPOTENT. Populated by scripts/sacred-seed.ts
-- (deterministic, NO model; coordinates from OUR gazetteer + a small verified map).
-- =============================================================================
CREATE TABLE IF NOT EXISTS sacred_sites (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  circuits text[] NOT NULL DEFAULT '{}',
  deity text,
  state text NOT NULL,
  nearest_town text NOT NULL,
  lat double precision, lng double precision,
  geocoded_from text,
  blurb text,
  verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sacred_geo_idx ON sacred_sites(lat, lng);
CREATE INDEX IF NOT EXISTS sacred_circuits_gin ON sacred_sites USING gin(circuits);

CREATE TABLE IF NOT EXISTS tour_sacred (
  tour_id    text    NOT NULL,
  sacred_id  integer NOT NULL REFERENCES sacred_sites(id) ON DELETE CASCADE,
  tier       varchar(12) NOT NULL CHECK (tier IN ('in_city','short_drive','day_trip')),
  via_city   text    NOT NULL,
  km         numeric(6,1) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tour_id, sacred_id)
);
CREATE INDEX IF NOT EXISTS tour_sacred_sacred_idx ON tour_sacred(sacred_id);
CREATE INDEX IF NOT EXISTS tour_sacred_tour_idx   ON tour_sacred(tour_id);
