-- ASI centrally-protected monuments (as of March 2025), district/town granularity.
-- Powers tourist-halt ranking (monument density near a candidate break-town) and
-- the "what will they see here" preview. Seeded by scripts/seed-monuments.ts.

CREATE TABLE IF NOT EXISTS asi_sites (
  id        bigserial PRIMARY KEY,
  location  text,             -- town/village as listed by ASI
  name      text,             -- monument / site name
  district  text,
  state     text,
  lat       double precision, -- geocoded from location via world_cities
  lng       double precision
);
CREATE INDEX IF NOT EXISTS asi_sites_geo_idx ON asi_sites (lat, lng);
CREATE INDEX IF NOT EXISTS asi_sites_loc_idx ON asi_sites (lower(location));
