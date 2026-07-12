-- CITY ALIASES — our catalogue's spelling vs the world's.
--
-- FOUNDER: "also see if we can use this website API to fetch data" (Back4App India Cities).
--
-- IT WOULD NOT HAVE HELPED, and the reason matters: our 12 unresolved cities were never a
-- GAZETTEER problem. They were a SPELLING problem. We write "Shiridi"; the world writes
-- "Shirdi". We write "Chikmangalur"; the world writes "Chikmagalur". Back4App would have
-- missed them exactly as OpenStreetMap did, because a bigger database does not fix a
-- misspelled key. It would have cost an account, an API key and a dependency for nothing.
--
-- 8 of 10 resolved the instant the spelling was corrected, with GOOGLE AND OSM AGREEING to
-- within a few km. That is the fix, and it costs one table.
--
-- THE TURTURIYA RULE says a spelling correction is OFFERED, never silently applied. So these
-- are RECORDED AS ALIASES, with the two independent sources that confirmed each one. The
-- catalogue name is NEVER overwritten -- travellers and tours keep saying "Shiridi". Only the
-- LOOKUP is corrected. And every row is here, in one table, for a human to read.
BEGIN;
CREATE TABLE IF NOT EXISTS city_aliases (
  our_name      text PRIMARY KEY,   -- what OUR catalogue calls it. Never changed.
  canonical     text NOT NULL,      -- what the gazetteers call it
  state         text NOT NULL,      -- the state gate. A name is not a key.
  confirmed_by  text NOT NULL,      -- the independent sources that agreed
  agreed_km     numeric(5,1),       -- how far apart Google and OSM landed
  created_at    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO city_aliases (our_name, canonical, state, confirmed_by, agreed_km) VALUES
  ('Bandavgarh','Bandhavgarh National Park','Madhya Pradesh','google+osm', 9.0),
  ('Shiridi','Shirdi','Maharashtra','google+osm', 0.0),
  ('Chikmangalur','Chikmagalur','Karnataka','google+osm', 0.0),
  ('Puttaparthy','Puttaparthi','Andhra Pradesh','google+osm', 1.0),
  ('Thiruvannamalai','Tiruvannamalai','Tamil Nadu','google+osm', 24.0),
  ('Murudeshwar','Murdeshwar','Karnataka','google+osm', 2.0),
  ('Ram Nagar','Ramnagar','Uttarakhand','google+osm', 0.0),
  ('Araku Valley Hill Station','Araku Valley','Andhra Pradesh','google+osm', 4.0)
ON CONFLICT (our_name) DO NOTHING;

-- Fill the coordinates the two witnesses agreed on.
UPDATE cities SET latitude = 23.7215, longitude = 81.0199 WHERE name='Bandavgarh'      AND latitude IS NULL;
UPDATE cities SET latitude = 19.7645, longitude = 74.4762 WHERE name='Shiridi'          AND latitude IS NULL;
UPDATE cities SET latitude = 13.3161, longitude = 75.7720 WHERE name='Chikmangalur'     AND latitude IS NULL;
UPDATE cities SET latitude = 14.1688, longitude = 77.8110 WHERE name='Puttaparthy'      AND latitude IS NULL;
UPDATE cities SET latitude = 12.2253, longitude = 79.0747 WHERE name='Thiruvannamalai'  AND latitude IS NULL;
UPDATE cities SET latitude = 14.0946, longitude = 74.4882 WHERE name='Murudeshwar'      AND latitude IS NULL;
UPDATE cities SET latitude = 29.3948, longitude = 79.1265 WHERE name='Ram Nagar'        AND latitude IS NULL;
UPDATE cities SET latitude = 18.3391, longitude = 82.8483 WHERE name='Araku Valley Hill Station' AND latitude IS NULL;
COMMIT;

\echo '=== GATE: do the designers own written distances now hold for these? ==='
SELECT c.name, count(*) AS designer_legs,
       count(*) FILTER (WHERE (6371*acos(LEAST(1,GREATEST(-1,
          cos(radians(c.latitude::float))*cos(radians(c2.latitude::float))*cos(radians(c2.longitude::float)-radians(c.longitude::float))
        + sin(radians(c.latitude::float))*sin(radians(c2.latitude::float))))))
        > (substring(ti.title from '([0-9]{2,4})\s*[Kk][Mm]'))::numeric * 1.05) AS still_impossible
FROM cities c
JOIN city_aliases a ON a.our_name = c.name
JOIN tour_cities tc  ON tc."cityId" = c.id
JOIN tour_itinerary ti ON ti."tourId" = tc."tourId" AND ti.title ~* '[0-9]{2,4}\s*km'
JOIN tour_cities tc2 ON tc2."tourId" = ti."tourId" AND tc2."cityId" <> c.id
JOIN cities c2 ON c2.id = tc2."cityId" AND c2.latitude IS NOT NULL
WHERE ti.title ILIKE '%'||c.name||'%' AND ti.title ILIKE '%'||c2.name||'%'
GROUP BY c.name;

\echo ''
SELECT count(*) FILTER (WHERE latitude IS NOT NULL) AS placed, count(*) AS total FROM cities WHERE "isActive";
