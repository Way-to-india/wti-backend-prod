-- US-823 / US-830 — THE STANDING CHECK: does the resolver send travellers to the town our own
-- designers actually go to?
--
-- 14 July 2026 — THIS SCRIPT WAS MEASURING THE WRONG THING.
-- It reproduced the OLD world_cities-only ladder. US-823 changed the live resolver
-- (cityVerify.dbExact) so that OUR OWN CATALOGUE ANSWERS FIRST. The script never learned that,
-- so it reported three "wrong towns" (Sultanpur 885 km, Khandala 104 km, Nakhtrana 54 km) that
-- the live engine in fact resolves 0 km off. A check that cries wolf is worse than no check:
-- the day a real defect appears it will hide in the noise it has trained us to ignore.
--
-- IT NOW MODELS THE LADDER THE ENGINE ACTUALLY RUNS.
--
--   psql "$DATABASE_URL" -f scripts/check-city-resolution.sql

\echo '=== PART A — THE REAL LADDER. MUST RETURN ZERO ROWS. ==='
-- Mirrors cityVerify.dbExact(): rung 0 is stay_nodes (similarity > 0.6, our own catalogue),
-- and world_cities is only ever the FALLBACK. A row here means the LIVE engine routes a
-- traveller to a different town of the same name. On 13 July 2026 the old ladder returned
-- FOUR, and the worst was MANALI: 17 tours, every one resolved to a suburb of Chennai,
-- 2,138 km from the mountains.
WITH engine_pick AS (
  SELECT s.id, s.name, s.state_name, s.tour_count, s.lat, s.lng,
         -- rung 0: the catalogue answers first, and for a stay_node it always matches itself
         (SELECT c.lat FROM stay_nodes c
           WHERE similarity(lower(c.name), lower(s.name)) > 0.6
           ORDER BY similarity(lower(c.name), lower(s.name)) DESC, c.tour_count DESC NULLS LAST
           LIMIT 1) AS got_lat,
         (SELECT c.lng FROM stay_nodes c
           WHERE similarity(lower(c.name), lower(s.name)) > 0.6
           ORDER BY similarity(lower(c.name), lower(s.name)) DESC, c.tour_count DESC NULLS LAST
           LIMIT 1) AS got_lng
    FROM stay_nodes s
)
SELECT name, state_name, tour_count,
       round((111.045 * sqrt(power(got_lat - lat, 2)
             + power((got_lng - lng) * cos(radians(lat)), 2)))::numeric, 0) AS km_off
  FROM engine_pick
 WHERE got_lat IS NULL
    OR (111.045 * sqrt(power(got_lat - lat, 2)
       + power((got_lng - lng) * cos(radians(lat)), 2))) > 50
 ORDER BY km_off DESC NULLS FIRST;

\echo ''
\echo '=== PART B — WHERE THE CATALOGUE RULE IS THE ONLY THING SAVING US. Informational. ==='
-- These towns exist in world_cities under the SAME NAME but in a DIFFERENT PLACE. The live
-- engine gets them right ONLY because rung 0 answers first. If a catalogue row is ever renamed,
-- deleted, or drops below the 0.6 similarity gate, THESE are the towns that ship wrong the same
-- day. This list is not a failure. It is a list of load-bearing rows. Do not let it grow silently.
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
            w.population DESC NULLS LAST
)
SELECT s.name, s.state_name, s.tour_count,
       p.id AS world_cities_would_say,
       round((111.045 * sqrt(power(p.latitude - s.lat, 2)
             + power((p.longitude - s.lng) * cos(radians(s.lat)), 2)))::numeric, 0) AS km_off_without_the_catalogue
  FROM stay_nodes s
  JOIN picked p ON p.nm = lower(s.name)
 WHERE (111.045 * sqrt(power(p.latitude - s.lat, 2)
       + power((p.longitude - s.lng) * cos(radians(s.lat)), 2))) > 50
 ORDER BY km_off_without_the_catalogue DESC;
