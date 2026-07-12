-- FOUNDER REPAIRS, 2026-07-12. Everything here was confirmed by him, with the evidence in hand.
--
-- POKHARA IS DELIBERATELY NOT TOUCHED. He asked for it to be deleted, but muktinath-yatra has
-- Pokhara as its ONLY city -- deleting it would leave a live, sellable tour with no cities at
-- all, and tour_cities cascades. Held for his decision. Silence would have been damage.
BEGIN;

-- 1. DELETE the junk rows. Verified safe: no tour is left city-less.
--    jim-corbett-...-by-rail keeps Corbett, Delhi, Ram Nagar.
--    kumaon-tour keeps Binsar, Delhi, Kasauni.
--    New / Port / Sawai have ZERO tour links (their tourCount of 2 was a stale counter).
--    And the proper rows all already exist with coordinates:
--      New Delhi 28.6139,77.2089 (9 links) | Port Blair 11.6661,92.7464 (3) | Sawai Madhopur 26.0230,76.3441 (1)
DELETE FROM cities WHERE name IN ('24','Kumaon Village','New','Port','Sawai');

-- 2. RAIGAD -- founder-supplied: 18.6500 N, 72.8833 E (Raigad district / Alibag coast).
--    Consistent with konkan-beach-resorts-tour, which runs Mahad - Kashid - Alibaug - Murud.
UPDATE cities SET latitude = 18.6500, longitude = 72.8833 WHERE name = 'Raigad';

-- 3. SUNDARBANS -- founder-supplied: 22 06 05 N, 88 48 06 E (Sudhanyakhali Watch Tower).
--    = 22.10139, 88.80167 decimal. A named, fixed landmark inside the delta -- which is exactly
--    what a 10,000 sq km park needs, since a park is not a point.
UPDATE cities SET latitude = 22.10139, longitude = 88.80167 WHERE name = 'Sundarbans';

COMMIT;

\echo '=== the three tours must still have cities ==='
SELECT tc."tourId", string_agg(c.name, ', ' ORDER BY c.name) AS cities
FROM tour_cities tc JOIN cities c ON c.id=tc."cityId"
WHERE tc."tourId" IN ('jim-corbett-park-weekend-tour-package-by-rail','kumaon-tour','konkan-beach-resorts-tour')
GROUP BY 1;

\echo ''
\echo '=== what is left unplaced ==='
SELECT name, (SELECT count(*) FROM tour_cities tc WHERE tc."cityId"=c.id) AS links
FROM cities c WHERE c."isActive" AND c.latitude IS NULL ORDER BY 2 DESC;

\echo ''
SELECT count(*) FILTER (WHERE latitude IS NOT NULL) AS placed, count(*) AS total FROM cities WHERE "isActive";
