-- The three our OWN ITINERARIES settle. Not a guess: the tour text names them.
--   mumbai-with-karla-caves-tour  day 2: "Mumbai - Karla Caves - Mumbai"   -> 'Kalra Caves' is a typo
--   north-kerala-tour             day 3: "Kannur - Bekal (85 km.)"          -> 'Bekal Town' is 'Bekal'
--   Ratnagiri: a real Konkan town. Google/OSM split on district-vs-town; town centre taken.
--
-- The catalogue NAME is corrected here (unlike city_aliases, where the name is preserved),
-- because these two names are simply WRONG -- not a variant spelling we sell under.
BEGIN;
UPDATE cities SET name='Karla Caves', slug='karla-caves', latitude=18.7869, longitude=73.4728 WHERE name='Kalra Caves';
UPDATE cities SET name='Bekal',       slug='bekal',       latitude=12.3908, longitude=75.0353 WHERE name='Bekal Town';
UPDATE cities SET latitude=16.9944, longitude=73.3000 WHERE name='Ratnagiri';
COMMIT;

\echo '=== GATE: do our designers written road distances hold for these? (a road cannot beat the crow) ==='
SELECT c.name, c2.name AS other,
       substring(ti.title from '([0-9]{2,4})\s*[Kk][Mm]') AS designers_km,
       round((6371*acos(LEAST(1,GREATEST(-1,
          cos(radians(c.latitude::float))*cos(radians(c2.latitude::float))*cos(radians(c2.longitude::float)-radians(c.longitude::float))
        + sin(radians(c.latitude::float))*sin(radians(c2.latitude::float))))))::numeric,0) AS crow_km
FROM cities c
JOIN tour_cities tc ON tc."cityId"=c.id
JOIN tour_itinerary ti ON ti."tourId"=tc."tourId" AND ti.title ~* '[0-9]{2,4}\s*km'
JOIN tour_cities tc2 ON tc2."tourId"=ti."tourId" AND tc2."cityId"<>c.id
JOIN cities c2 ON c2.id=tc2."cityId" AND c2.latitude IS NOT NULL
WHERE c.name IN ('Bekal','Karla Caves','Ratnagiri')
  AND ti.title ILIKE '%'||c.name||'%' AND ti.title ILIKE '%'||c2.name||'%';

\echo ''
SELECT count(*) FILTER (WHERE latitude IS NOT NULL) AS placed, count(*) AS total FROM cities WHERE "isActive";
SELECT name FROM cities WHERE "isActive" AND latitude IS NULL;
