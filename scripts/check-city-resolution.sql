-- US-823 — THE STANDING CHECK: does the resolver send travellers to the town our own
-- designers actually go to?
--
-- For every stay_node (a town WE have built real tours to), run the EXACT ladder the engine
-- runs, and measure how far the winner lands from where our tours actually go.
--
-- MUST RETURN ZERO ROWS. A row here means we are routing a traveller to a different town of
-- the same name. On 13 July 2026 this returned FOUR, and the worst was MANALI: 17 tours, and
-- every one of them resolved to a suburb of Chennai, 2,138 km from the mountains.
--
--   psql "$DATABASE_URL" -f scripts/check-city-resolution.sql
WITH picked AS (
  SELECT DISTINCT ON (lower(w.name)) lower(w.name) AS nm, w.id, w.latitude, w.longitude
    FROM world_cities w
   WHERE lower(w.name) IN (SELECT lower(name) FROM stay_nodes)
   ORDER BY lower(w.name),
            (w."countryCode" = 'IN') DESC,
            (EXISTS (SELECT 1 FROM stay_nodes s
                      WHERE abs(s.lat - w.latitude) < 0.25
                        AND abs(s.lng - w.longitude) < 0.25
                        AND similarity(lower(s.name), lower(w.name)) > 0.45)) DESC,
            (EXISTS (SELECT 1 FROM airport_cities a
                      WHERE abs(a.lat - w.latitude) < 0.8
                        AND abs(a.lng - w.longitude) < 0.8)) DESC,
            (EXISTS (SELECT 1 FROM train_stations t
                      WHERE abs(t.lat - w.latitude) < 0.5
                        AND abs(t.lng - w.longitude) < 0.5)) DESC,
            w.population DESC NULLS LAST
)
SELECT s.name,
       s.state_name,
       s.tour_count,
       p.id AS resolved_to_world_cities_id,
       round((111.045 * sqrt(power(p.latitude - s.lat, 2)
             + power((p.longitude - s.lng) * cos(radians(s.lat)), 2)))::numeric, 0) AS km_off
  FROM stay_nodes s
  JOIN picked p ON p.nm = lower(s.name)
 WHERE (111.045 * sqrt(power(p.latitude - s.lat, 2)
       + power((p.longitude - s.lng) * cos(radians(s.lat)), 2))) > 50
 ORDER BY km_off DESC;
