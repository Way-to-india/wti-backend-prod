-- MERGE KOCHI -> COCHIN. Founder-confirmed: they are the same city.
--
-- AND A CORRECTION I OWE THE RECORD. I called Kochi "a phantom with zero tours". IT IS NOT.
--   tour_cities        0
--   tour_stays         1
--   tours.startCityId  8   <- EIGHT TOURS BEGIN AT KOCHI
-- cities."tourCount" only counts tour_cities. IT HAS NEVER COUNTED START CITIES AT ALL.
-- So the metric was blind, and I repeated its blindness back to the founder as fact.
--
-- Deleting the row without moving these would have orphaned 8 tours' starting point.
--
-- WHICH NAME SURVIVES: COCHIN. It holds the 25 itinerary links and the slug that is already
-- live on the site. Renaming it to "Kochi" would change /cochin and break the URL. That is an
-- SEO decision, not a data one, and it is the founder's -- flagged separately.
BEGIN;

UPDATE tours      SET "startCityId" = 'cmijwfq0y002luww4ox3e4led' WHERE "startCityId" = 'cmijwjz9t005luww4oco0e1j0';
UPDATE tour_stays SET "wtiCityId"   = 'cmijwfq0y002luww4ox3e4led' WHERE "wtiCityId"   = 'cmijwjz9t005luww4oco0e1j0';
-- tour_cities / city_provider_map / contracted_hotel_rates: 0 rows, nothing to move.

DELETE FROM stay_nodes WHERE id = 'cmijwjz9t005luww4oco0e1j0';
DELETE FROM cities     WHERE id = 'cmijwjz9t005luww4oco0e1j0';

-- keep the name alive for LOOKUP, so a traveller typing "Kochi" still finds Cochin.
INSERT INTO city_aliases (our_name, canonical, state, confirmed_by, agreed_km)
VALUES ('Kochi','Cochin','Kerala','founder-confirmed merge', 1.2)
ON CONFLICT (our_name) DO NOTHING;

-- recount, since startCityId moved
WITH truth AS (SELECT c.id, (SELECT count(*)::int FROM tour_cities tc WHERE tc."cityId"=c.id) AS n FROM cities c)
UPDATE cities c SET "tourCount" = truth.n FROM truth WHERE truth.id=c.id AND c."tourCount" <> truth.n;
COMMIT;

\echo '=== nothing orphaned? ==='
SELECT 'tours pointing at the DEAD Kochi id' AS check, count(*) AS must_be_zero
FROM tours WHERE "startCityId" = 'cmijwjz9t005luww4oco0e1j0';

\echo ''
\echo '=== Cochin now carries everything ==='
SELECT c.name, c."tourCount" AS itinerary_links,
       (SELECT count(*) FROM tours t WHERE t."startCityId"=c.id) AS tours_starting_here,
       (SELECT count(*) FROM tour_stays s WHERE s."wtiCityId"=c.id) AS stays
FROM cities c WHERE c.name IN ('Cochin','Ernakulam');
