-- =============================================================================
-- U3 — TOUR-LEVEL UNESCO MAPPING (distance tiers)
-- Rides on U1/U2 (unesco_sites). Marks every TOUR (not just the deduped branch)
-- that passes near a UNESCO World Heritage Site, honest by distance:
--   in_city     : a stop is within 12 km of the site's access point
--   short_drive : within 35 km
--   day_trip     : within 65 km
-- Distance is measured from where the traveller STAYS (tour_stays -> cities coords).
-- ADDITIVE + IDEMPOTENT. Populated by scripts/unesco-tour-map.ts (deterministic, NO model).
-- =============================================================================
CREATE TABLE IF NOT EXISTS tour_unesco (
  tour_id    text    NOT NULL,                       -- tours.id (== tour_stays.tourId)
  unesco_id  integer NOT NULL REFERENCES unesco_sites(id) ON DELETE CASCADE,
  tier       varchar(12) NOT NULL CHECK (tier IN ('in_city','short_drive','day_trip')),
  via_city   text    NOT NULL,                       -- the stay city we measured from
  km         numeric(6,1) NOT NULL,                  -- straight-line km, stay -> site access point
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tour_id, unesco_id)
);
CREATE INDEX IF NOT EXISTS tour_unesco_unesco_idx ON tour_unesco(unesco_id);
CREATE INDEX IF NOT EXISTS tour_unesco_tour_idx   ON tour_unesco(tour_id);
CREATE INDEX IF NOT EXISTS tour_unesco_tier_idx   ON tour_unesco(tier);
