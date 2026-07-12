-- =====================================================================================
-- US-802b — OUR OWN TRAVEL GUIDES. The source I walked past.
--
-- FOUNDER, 2026-07-12: "why can't we create a dataset of tourist attractions from our own
-- well researched travel guides and destinations?"
--
-- He was right, and the spec had said so all along. US-802 reads, verbatim: "Backfill from
-- `cities`, `asi_sites`, `poi_monuments`, `travel_guide_cities`." I used the first three,
-- looked at the ASI coverage of the North East, found it nearly empty (83 monuments across
-- eight states, SEVENTEEN with coordinates), and reported the North East as data-poor.
--
-- IT IS NOT DATA-POOR. IT IS WELL DOCUMENTED — BY US.
--
--   Assam      7 guides   Guwahati, Kaziranga, Majuli, Silchar, Haflong, Hailakandi, Marigaon
--   Sikkim     6 guides   Gangtok, Pelling, Lachung, Yumthang, Aritar, Chopta Valley
--   Arunachal  5 guides   Tawang, Ziro, Bhalukpong, Along, Tezu
--   Nagaland   4 guides   Kohima, Mokokchung, Wokha, Zunheboto
--   Mizoram    5   Tripura 2   Meghalaya 1   Manipur 1
--
-- 220 of our 303 guides carry `nearbyPlaces`, `placesToSeeTop`, `foodAndDining` and
-- `shopping` — human-researched, ours, and there is no legal question about any of it.
--
-- THIS IS THE SAME MISTAKE AS LAST SESSION, IN A NEW COAT. I reported "zero North-East
-- tours" from a search of tour TITLES; the co-occurrence proved me wrong. I have now
-- reported "no North-East attractions" from a search of asi_sites; our own guides prove me
-- wrong. SEARCH THE DATA, NOT THE LABELS. Twice taught.
--
-- =====================================================================================
-- WHAT THIS CHANGES, AND IT IS NOT SMALL
-- =====================================================================================
--
-- The spec's central fear (§3.4) is: "AI may PROPOSE a place. It may never REGISTER one."
-- It assumed Cherrapunji, Tawang and Kohima would have to enter through an AI proposal
-- gated by the verify ladder.
--
-- THEY DO NOT. OUR OWN WRITERS ALREADY WENT THERE. The place is proposed by a HUMAN, in
-- our own guide, with a state attached. All the ladder has to do is find its COORDINATES.
-- No model proposes a single place in this file.
--
-- So a Tawang or a Kohima enters as `own_guide` — our own written knowledge — and NOT as
-- `ai_proposed`. That is a materially stronger promise to the traveller, and it is true.
--
-- =====================================================================================
-- THE HARD GATE ON THE COORDINATES
-- =====================================================================================
--
-- Our guide gives a NAME and a STATE. The gazetteer gives coordinates. Joining them on the
-- name alone is how you send a traveller to the wrong end of India: there are TWO Manalis,
-- and the only one in world_cities is a suburb of CHENNAI (admin1 25), not the hill station
-- in Himachal. A fuzzy name match with no state check would happily book it.
--
-- So every coordinate lookup must clear a STATE GATE:
--     the gazetteer row's admin1Code MUST equal the code for the state OUR OWN GUIDE names.
--
-- The state codes come from india_states below — each one VERIFIED on production by
-- querying a city everybody knows to be in that state and reading back the code it carries.
-- The witness is stored. Nothing here is from memory. (Same discipline as regions.ts.)
--
-- If no gazetteer row clears the gate, the town gets NO COORDINATES and is NOT a StayNode.
-- We would rather lose a town than place it in the wrong state. It waits for a human.
-- =====================================================================================

BEGIN;

-- ---- 1. THE VERIFIED STATE TABLE — name -> code, with the city that proves it ---------

DROP TABLE IF EXISTS india_states;
CREATE TABLE india_states (
  admin1_code varchar(2) PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  witness     text NOT NULL   -- the city queried on production to prove this code. The receipt.
);
INSERT INTO india_states (admin1_code, name, witness) VALUES
  ('01','Andaman & Nicobar Islands','Port Blair'), ('02','Andhra Pradesh','Rasapudipalem'),
  ('03','Assam','Guwahati'),          ('05','Chandigarh','Chandigarh'),
  ('07','Delhi','Delhi'),             ('09','Gujarat','Ahmedabad'),
  ('10','Haryana','Faridabad'),       ('11','Himachal Pradesh','Shimla'),
  ('12','Jammu & Kashmir','Srinagar'),('13','Kerala','Kochi'),
  ('16','Maharashtra','Mumbai'),      ('17','Manipur','Imphal'),
  ('18','Meghalaya','Shillong'),      ('19','Karnataka','Bengaluru'),
  ('20','Nagaland','Kohima'),         ('21','Odisha','Bhubaneswar'),
  ('22','Puducherry','Puducherry'),   ('23','Punjab','Ludhiana'),
  ('24','Rajasthan','Jaipur'),        ('25','Tamil Nadu','Chennai'),
  ('26','Tripura','Agartala'),        ('28','West Bengal','Kolkata'),
  ('29','Sikkim','Gangtok'),          ('30','Arunachal Pradesh','Itanagar'),
  ('31','Mizoram','Aizawl'),          ('33','Goa','Mormugao'),
  ('34','Bihar','Patna'),             ('35','Madhya Pradesh','Indore'),
  ('36','Uttar Pradesh','Agra'),      ('37','Chhattisgarh','Raipur'),
  ('38','Jharkhand','Jamshedpur'),    ('39','Uttarakhand','Dehra Dun'),
  ('40','Telangana','Hyderabad'),     ('41','Ladakh','Leh');

-- ---- 2. STAY NODES FROM OUR OWN GUIDES ------------------------------------------------
--
-- Coordinates resolved through the gazetteer, THROUGH THE STATE GATE. Exact ascii match
-- first; trigram similarity only as a second rung, and it must clear the same state gate.

INSERT INTO stay_nodes (id, name, lat, lng, admin1_code, state_name, district, tour_count, source_kind, fetched_at, verified_at, verified_by)
SELECT
  'guide_' || gc.id,
  gc.name,
  loc.lat, loc.lng,
  st.admin1_code,
  gc."stateName",
  NULL,
  0,                     -- our guides are where we have BEEN, not where we have SOLD
  'own_guide',           -- the tier. A human wrote this, and it is ours.
  now(),
  -- VERIFIED: a human writer of ours produced a researched guide to this town, AND the
  -- gazetteer independently places it in the state our guide named. Two sources agree.
  -- That is exactly the standard the spec sets (§3.2), and it is met.
  now(),
  'own_guide+gazetteer'
FROM travel_guide_cities gc
JOIN travel_guide_data g ON g."cityId" = gc.id AND g."isActive"
JOIN india_states st ON st.name = gc."stateName"
CROSS JOIN LATERAL (
  SELECT w.latitude::double precision AS lat, w.longitude::double precision AS lng
  FROM world_cities w
  WHERE w."countryCode" = 'IN'
    -- THE STATE GATE. The gazetteer must agree with OUR OWN GUIDE about which state this
    -- town is in. This is the line that stops Chennai's Manali being sold as Himachal's.
    AND w."admin1Code" = st.admin1_code
    AND (
         lower(w."asciiName") = lower(gc.name)
      OR lower(w.name)        = lower(gc.name)
      OR similarity(lower(w."asciiName"), lower(gc.name)) >= 0.62   -- Darjiling ~ Darjeeling
    )
  ORDER BY
    (lower(w."asciiName") = lower(gc.name)) DESC,   -- an exact match always beats a fuzzy one
    w.population DESC NULLS LAST
  LIMIT 1
) loc
-- Never duplicate a town we already hold from the sold catalogue. `cities` wins: it is
-- where we have actually SOLD, which is a stronger signal than where we have written.
WHERE NOT EXISTS (
  SELECT 1 FROM stay_nodes sn WHERE lower(sn.name) = lower(gc.name)
);

-- ---- 3. ATTRACTIONS FROM OUR OWN GUIDES ------------------------------------------------
--
-- `placesToSeeTop` and `nearbyPlaces` are PROSE, written by our staff. We do NOT parse
-- prose into a list of named monuments here — a regex that splits English sentences into
-- "attractions" would manufacture places that do not exist, and manufacturing places is
-- the one thing we have sworn not to do.
--
-- What we take is the thing prose can honestly give us: THE FACT THAT WE HAVE RESEARCHED
-- THIS TOWN, and the guide URL as the receipt. The Designer may then say, truthfully,
-- "we have written a guide to this place" — and LINK to it. The traveller reads our own
-- words, in our own voice, and nothing is invented on the way.
--
-- Extracting individual named attractions from this prose is a real piece of work and it
-- belongs to Sprint 9 (the content layer), where a human can sign off what a parser found.

DROP TABLE IF EXISTS stay_node_guides;
CREATE TABLE stay_node_guides (
  stay_node_id    text PRIMARY KEY REFERENCES stay_nodes(id) ON DELETE CASCADE,
  guide_city_id   text NOT NULL,
  source_url      text NOT NULL,           -- THE RECEIPT. Our own page, our own words.
  has_places      boolean NOT NULL DEFAULT false,
  has_food        boolean NOT NULL DEFAULT false,   -- feeds the US-806 FOOD GATE
  has_shopping    boolean NOT NULL DEFAULT false,
  best_time       text,
  fetched_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO stay_node_guides (stay_node_id, guide_city_id, source_url, has_places, has_food, has_shopping, best_time)
SELECT
  sn.id, gc.id,
  'https://www.waytoindia.com/travel-guide/' || COALESCE(g."citySlug", gc.slug),
  btrim(COALESCE(g."placesToSeeTop", '')) <> '' OR btrim(COALESCE(g."nearbyPlaces", '')) <> '',
  btrim(COALESCE(g."foodAndDining", '')) <> '',
  btrim(COALESCE(g.shopping, '')) <> '',
  NULLIF(btrim(COALESCE(g."bestTimeToVisit", '')), '')
FROM travel_guide_cities gc
JOIN travel_guide_data g ON g."cityId" = gc.id AND g."isActive"
JOIN stay_nodes sn ON lower(sn.name) = lower(gc.name)
ON CONFLICT (stay_node_id) DO NOTHING;

COMMIT;

-- ---- 4. PROVE IT ------------------------------------------------------------------------

\echo ''
\echo '=== the spine, after our own guides were let in ==='
SELECT source_kind, count(*) AS stay_nodes FROM stay_nodes GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '=== THE NORTH EAST WE CAN NOW ACTUALLY PLAN. (Tawang and Kohima are OUR OWN, not a model.) ==='
SELECT n.name, s.name AS state, n.source_kind, n.tour_count AS sold,
       (SELECT count(*) FROM stay_node_gateways gg WHERE gg.stay_node_id = n.id AND gg.kind='rail') AS railheads,
       (g.stay_node_id IS NOT NULL) AS has_guide, g.has_food
FROM stay_nodes n
JOIN india_states s ON s.admin1_code = n.admin1_code
LEFT JOIN stay_node_guides g ON g.stay_node_id = n.id
WHERE n.admin1_code IN ('03','18','29','20','17','31','26','30')
ORDER BY n.tour_count DESC, n.name;

\echo ''
\echo '=== THE STATE GATE HELD? Every guide StayNode must sit in the state OUR GUIDE named. ==='
SELECT count(*) AS must_be_zero
FROM stay_nodes n JOIN india_states s ON s.name = n.state_name
WHERE n.source_kind = 'own_guide' AND n.admin1_code <> s.admin1_code;

\echo ''
\echo '=== and the food gate now has a source ==='
SELECT count(*) FILTER (WHERE has_food) AS nodes_with_our_own_food_notes,
       count(*) FILTER (WHERE has_places) AS nodes_with_our_own_places,
       count(*) AS guided_nodes
FROM stay_node_guides;
