-- =====================================================================================
-- FOUNDER-CONFIRMED, 2026-07-12
--   (a) Delhi / New Delhi / Old Delhi -> ONE row: Delhi
--   (b) Raigad -> RAIGAD FORT, and Alibag stays the beach stay
--   (c) Corbett / Ram Nagar: LEFT ALONE (the park/town split is deliberate and correct)
-- =====================================================================================
BEGIN;

-- (a) THE DELHI FAMILY. Three rows, one city.
--
-- THE COLLISION. tour_cities is keyed on (tourId, cityId). ONE tour links to Delhi AND New
-- Delhi; ONE links to Delhi AND Old Delhi. A blind UPDATE would have violated the primary
-- key and taken the transaction down. Drop the redundant link first, THEN move the rest.
DELETE FROM tour_cities t2
 WHERE t2."cityId" IN ('cmijwjfic005auww4o8sd1a4o','cmijwr1y700axuww4htghjs63')
   AND EXISTS (SELECT 1 FROM tour_cities t1
                WHERE t1."cityId" = 'cmijwc7ta0000uww4vrdsjj1x' AND t1."tourId" = t2."tourId");

UPDATE tour_cities            SET "cityId"      = 'cmijwc7ta0000uww4vrdsjj1x' WHERE "cityId"      IN ('cmijwjfic005auww4o8sd1a4o','cmijwr1y700axuww4htghjs63');
UPDATE tour_stays             SET "wtiCityId"   = 'cmijwc7ta0000uww4vrdsjj1x' WHERE "wtiCityId"   IN ('cmijwjfic005auww4o8sd1a4o','cmijwr1y700axuww4htghjs63');
UPDATE tours                  SET "startCityId" = 'cmijwc7ta0000uww4vrdsjj1x' WHERE "startCityId" IN ('cmijwjfic005auww4o8sd1a4o','cmijwr1y700axuww4htghjs63');
UPDATE city_provider_map      SET "wtiCityId"   = 'cmijwc7ta0000uww4vrdsjj1x' WHERE "wtiCityId"   IN ('cmijwjfic005auww4o8sd1a4o','cmijwr1y700axuww4htghjs63');
UPDATE contracted_hotel_rates SET "wtiCityId"   = 'cmijwc7ta0000uww4vrdsjj1x' WHERE "wtiCityId"   IN ('cmijwjfic005auww4o8sd1a4o','cmijwr1y700axuww4htghjs63');

DELETE FROM stay_nodes WHERE id IN ('cmijwjfic005auww4o8sd1a4o','cmijwr1y700axuww4htghjs63');
DELETE FROM cities     WHERE id IN ('cmijwjfic005auww4o8sd1a4o','cmijwr1y700axuww4htghjs63');

-- a traveller typing "New Delhi" must still land on Delhi
INSERT INTO city_aliases (our_name, canonical, state, confirmed_by, agreed_km) VALUES
  ('New Delhi','Delhi','Delhi','founder-confirmed merge',4.8),
  ('Old Delhi','Delhi','Delhi','founder-confirmed merge',0)
ON CONFLICT (our_name) DO NOTHING;

-- (b) RAIGAD = THE FORT. Verified by TWO independent sources, not by my memory:
--     Google 18.2335,73.4407 | OSM 18.2360,73.4293 -- they agree to 1.2 km.
--     Midpoint 18.2347, 73.4350. Elevation 746 m. (My remembered guess was 0.7 km out.)
UPDATE cities SET latitude = 18.2347, longitude = 73.4350 WHERE name = 'Raigad';

-- AND YOU CANNOT SLEEP IN A FORT. (Amendment 1: a StayNode is a town you sleep in; an
-- Attraction is a thing you go and see.) Leaving Raigad in stay_nodes would invite the
-- planner to book a hotel on top of an 820 m hill. It leaves the spine and becomes what it
-- actually is -- and the traveller sleeps at Alibag, 0.9 km from where its coordinate used to be.
DELETE FROM stay_nodes WHERE name = 'Raigad';

INSERT INTO attractions (name, lat, lng, state_name, source_kind, source_url, verified_at, verified_by)
SELECT 'Raigad Fort', 18.2347, 73.4350, 'Maharashtra', 'own_guide', NULL, now(), 'founder+google+osm'
WHERE NOT EXISTS (SELECT 1 FROM attractions WHERE lower(name) = 'raigad fort');

COMMIT;

-- attach the fort to whichever town you actually sleep in
WITH nearest AS (
  SELECT a.id AS att_id, b.node_id, b.km FROM attractions a
  CROSS JOIN LATERAL (
    SELECT n.id AS node_id,
           (6371*acos(LEAST(1,GREATEST(-1, cos(radians(a.lat))*cos(radians(n.lat))*cos(radians(n.lng)-radians(a.lng))
            + sin(radians(a.lat))*sin(radians(n.lat)))))) AS km
    FROM stay_nodes n ORDER BY km ASC LIMIT 1) b
  WHERE lower(a.name) = 'raigad fort')
UPDATE attractions att SET stay_node_id = nearest.node_id, straight_line_km = round(nearest.km::numeric,1)
FROM nearest WHERE nearest.att_id = att.id;

\echo '=== Delhi now carries everything ==='
SELECT c.name, c."tourCount" AS itin_links,
       (SELECT count(*) FROM tours t WHERE t."startCityId"=c.id) AS starts,
       (SELECT count(*) FROM tour_stays s WHERE s."wtiCityId"=c.id) AS stays
FROM cities c WHERE c.name='Delhi';
SELECT 'rows still pointing at the dead Delhi ids' AS check, count(*) AS must_be_zero
FROM tour_cities WHERE "cityId" IN ('cmijwjfic005auww4o8sd1a4o','cmijwr1y700axuww4htghjs63');

\echo ''
\echo '=== Raigad Fort is now an ATTRACTION, hanging off the town you sleep in ==='
SELECT a.name, a.lat, a.lng, n.name AS you_sleep_at, a.straight_line_km AS km_away, a.source_kind
FROM attractions a LEFT JOIN stay_nodes n ON n.id = a.stay_node_id WHERE lower(a.name)='raigad fort';
SELECT 'Raigad still in stay_nodes?' AS check, count(*) AS must_be_zero FROM stay_nodes WHERE name='Raigad';
