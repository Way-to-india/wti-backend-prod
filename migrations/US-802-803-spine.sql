-- =====================================================================================
-- US-802 / US-803 — THE SPINE. StayNode, Attraction, and the gateways.
-- Sprint 8 / THE DESIGNER. Founder ruling, Amendment 1 & 2, 2026-07-12.
--
--   StayNode   — a town you can SLEEP in. Has coords, a railhead, an airport, hotels.
--                THE PLANNER ROUTES BETWEEN THESE.
--   Attraction — a thing you go and SEE. Has coords, a parent StayNode, and the honest
--                drive from it. (Kaziranga NP, Cherrapunji falls, Kamakhya temple.)
--
-- You sleep at a town. You see a park. If the model conflates the two it will try to
-- book a hotel inside a national park, or route a train to a waterfall.
--
-- DISTRICT IS AN ATTRIBUTE, NEVER A ROUTING KEY (Amendment 2). It is a column here and
-- it is a column nowhere else. Trains do not stop at districts; they stop at stations,
-- and stations serve towns at a distance.
--
-- =====================================================================================
-- THE TWO LAWS THIS FILE ENFORCES, AND WHY EACH ONE HAS A CORPSE BEHIND IT
-- =====================================================================================
--
-- LAW A — AN AIRSTRIP WITH NO SCHEDULED SERVICE IS NOT AN AIRPORT. (standing law)
--
--   `airport_cities` holds 163 cities. Only 125 of them appear in `flight_sectors`.
--   THIRTY-EIGHT ARE AIRSTRIPS WITH NO FLIGHTS. Tezpur is one of them: it sits in
--   airport_cities with ZERO sectors. Any rule that picks an airport on coordinates and
--   population — which is what gateway.ts does today — will cheerfully route a traveller
--   to an airport no aeroplane visits.
--
--   So: an airport is a gateway ONLY IF it appears in flight_sectors. No exceptions.
--
-- LAW B — A STATION WHERE NO TRAINS STOP IS NOT A RAILHEAD. (the same law, in a new coat)
--
--   THIS ONE NEARLY REPEATED THE SPRINT-7 FAILURE. The nearest station to Gangtok is
--   "DARJEELING - DJ", 47 km away. It is the TOY TRAIN terminus — the Darjeeling
--   Himalayan Railway, a heritage line. It is not something you arrive on from Delhi.
--   A "nearest station" rule would have put the man who wrote "we would prefer trains
--   wherever possible" onto a mountain toy train as his ARRIVAL, and called it service.
--
--   The truth is in train_stops:
--       NJP  New Jalpaiguri   180 services   <- THE railhead for Gangtok and Darjeeling
--       GHY  Guwahati         146 services   <- THE railhead for Assam and Meghalaya
--       FKG  Furkating Jn      39 services
--       DJ   Darjeeling        25 services   (the toy train)
--       JKB  Jakhalabandha      9 services   (nearest to Kaziranga, and nearly useless)
--       KKET Kamrup Khetri      8 services
--
--   So a railhead is ranked BY SERVICE FIRST, DISTANCE SECOND. A seasoned consultant
--   sends you where the trains actually are, and treats the drive as the price. That is
--   why Kaziranga is reached from Guwahati and not from the halt 18 km down the road.
--
-- =====================================================================================
-- WHAT IS HONEST ABOUT THE DISTANCES IN HERE
-- =====================================================================================
--
-- This file stores `straight_line_km` — and it CALLS IT straight_line_km, because that
-- is what haversine gives you. In the hills a straight line is a lie about a drive.
-- The REAL road distance and the REAL drive time are filled in by the second pass
-- (scripts/build-spine-gateways.ts) which asks OSRM and writes `road_km` / `road_min`.
-- Nothing in this schema is ever allowed to call a straight line a drive time.
-- =====================================================================================

BEGIN;

DROP TABLE IF EXISTS attractions;
DROP TABLE IF EXISTS stay_node_gateways;
DROP TABLE IF EXISTS stay_nodes;

-- ---- 1. THE STAY NODE — a town you can sleep in --------------------------------------

CREATE TABLE stay_nodes (
  id              text PRIMARY KEY,          -- cities.id, so the spine stays joinable
  name            text        NOT NULL,
  lat             double precision NOT NULL, -- a node WITHOUT coordinates cannot be routed,
  lng             double precision NOT NULL, -- cannot be driven to, and is not a node.
  admin1_code     varchar(8),                -- the state. world_cities is the only source.
  state_name      text,
  district        text,                      -- AN ATTRIBUTE. Never a routing key. (Amendment 2)
  tour_count      integer     NOT NULL DEFAULT 0,   -- how often WE have sold it
  source_kind     varchar(24) NOT NULL DEFAULT 'wti_catalogue',
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  verified_at     timestamptz,               -- nothing unverified is ever shown (spec 3.2)
  verified_by     text
);

-- Only towns we hold COORDINATES for. 148 of the 209 rows in `cities` have them; the
-- other 61 cannot be routed to, cannot have an attraction attached by drive time, and
-- are therefore not StayNodes. We would rather have 148 real nodes than 209 with holes.
-- THE STATE COMES FROM GEOGRAPHY, NOT FROM SPELLING — AND FROM THE NEAREST ROW, NOT A VOTE.
--
-- TWO BUGS DIED HERE, AND THE SECOND WAS MINE, INTRODUCED BY OVER-ENGINEERING THE FIRST.
--
-- BUG 1 — SPELLING. My first attempt matched cities.name = world_cities.name. It found a
-- state for only 69 of 148 nodes, and one it missed was DARJEELING, because the gazetteer
-- spells it "Darjiling". A state assigned by string equality is hostage to a
-- transliteration, and Darjeeling is a town our own designers have sold six times.
--
-- BUG 2 — MY FIX. I replaced it with "the five nearest gazetteer towns within 60 km, and
-- let them vote". That produced GANGTOK = 28 (WEST BENGAL). Gangtok is in SIKKIM.
-- Sikkim has exactly ONE row in the whole gazetteer, so four West Bengal towns outvoted
-- it. And because the North-East region seed lists Sikkim (29) and not West Bengal (28),
-- GANGTOK WOULD HAVE DISAPPEARED FROM EVERY NORTH-EAST SEARCH — the very traveller this
-- sprint exists for would have lost Sikkim entirely.
--
-- A majority vote is exactly the wrong instrument at a thin-data border. The right one is
-- far simpler, and it was there all along: A TOWN'S OWN GAZETTEER ROW SITS AT ~0 KM. The
-- NEAREST row IS the town — under whatever spelling GeoNames happens to use. So we take
-- the single nearest gazetteer row within 25 km and believe it.
--
--   Gangtok    -> nearest row is Gangtok    (0 km) -> 29 Sikkim       CORRECT
--   Darjeeling -> nearest row is Darjiling  (0 km) -> 28 West Bengal  CORRECT, despite the spelling
--
-- Coordinates do not have spellings, and they do not need a quorum.
INSERT INTO stay_nodes (id, name, lat, lng, admin1_code, state_name, tour_count, source_kind, verified_at, verified_by)
SELECT
  c.id, c.name, c.latitude::double precision, c.longitude::double precision,
  near.admin1_code,
  NULLIF(c."stateName", ''),
  c."tourCount", 'wti_catalogue',
  -- Our own catalogue is verified BY CONSTRUCTION: we have sold trips to these towns.
  -- That is a stronger receipt than any web source could give us.
  now(), 'wti_catalogue'
FROM cities c
LEFT JOIN LATERAL (
  SELECT w."admin1Code" AS admin1_code,
         (6371 * acos(LEAST(1, GREATEST(-1,
             cos(radians(c.latitude::double precision)) * cos(radians(w.latitude::double precision))
           * cos(radians(w.longitude::double precision) - radians(c.longitude::double precision))
           + sin(radians(c.latitude::double precision)) * sin(radians(w.latitude::double precision)))))) AS km
  FROM world_cities w
  WHERE w."countryCode" = 'IN'
    AND w."admin1Code" ~ '^[0-9]{2}$'   -- the row holding the STRING 'Maharashtra' is junk; excluded
    AND w.latitude  BETWEEN c.latitude  - 0.4 AND c.latitude  + 0.4   -- a cheap box before the trig
    AND w.longitude BETWEEN c.longitude - 0.4 AND c.longitude + 0.4
  ORDER BY km ASC
  LIMIT 1
) near ON near.km <= 25
WHERE c."isActive" = true
  AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL;

CREATE INDEX stay_nodes_geo_idx    ON stay_nodes (lat, lng);
CREATE INDEX stay_nodes_state_idx  ON stay_nodes (admin1_code);
CREATE INDEX stay_nodes_name_idx   ON stay_nodes (lower(name));

-- ---- 2. THE GATEWAYS — how he actually gets there -------------------------------------

CREATE TABLE stay_node_gateways (
  stay_node_id    text        NOT NULL REFERENCES stay_nodes(id) ON DELETE CASCADE,
  kind            varchar(8)  NOT NULL,       -- 'rail' | 'air'
  rank            smallint    NOT NULL,       -- shortlist position on the provisional score
  -- Assigned by PASS 2, on the REAL road drive — never on a straight line.
  role            varchar(12),                -- 'primary' | 'nearest' | NULL (a candidate)
  code            text,                       -- station code; NULL for air
  gateway_name    text        NOT NULL,
  gateway_lat     double precision NOT NULL,
  gateway_lng     double precision NOT NULL,
  -- THE PROOF OF SERVICE. A station with 0 stops is not a railhead; an airport with 0
  -- sectors is not an airport. This column is the receipt, and it is NOT NULL.
  services        integer     NOT NULL,
  straight_line_km numeric(6,1) NOT NULL,     -- haversine. HONESTLY NAMED. Not a drive.
  road_km         numeric(6,1),               -- OSRM. The real thing. Filled by pass 2.
  road_min        integer,                    -- OSRM. The REAL drive. Filled by pass 2.
  computed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stay_node_id, kind, rank)
);

-- ---- THE TRADE-OFF, AND WHY A LEXICOGRAPHIC SORT IS NOT ENOUGH -----------------------
--
-- My first rule was "the most services within 200 km". It handed GUWAHATI a primary
-- railhead of NEW BONGAIGAON — 125 km away — over Guwahati's own station standing at
-- 0 km, because Bongaigaon has EIGHT more services. Nobody on earth sends a Guwahati
-- traveller to Bongaigaon. The rule was crude, and the data said so immediately.
--
-- A consultant weighs the trains against the drive, and the two do not scale alike:
--   * SERVICES have sharply DIMINISHING RETURNS. The step from 9 trains to 40 is the
--     difference between a halt and a railhead. The step from 146 to 154 is nothing.
--   * DRIVE TIME is a LINEAR COST, and by Law 2 it is the thing the traveller actually
--     feels. The ordeal is the point.
--
--   score = ln(services) - 0.5 * (km / 100)
--
-- Checked against the four North-East nodes, and it gets all four right:
--   Guwahati   GHY  ln(146)=4.98 - 0.00 = 4.98   >  NBQ ln(154)=5.04 - 0.62 = 4.42   OK
--   Gangtok    NJP  ln(180)=5.19 - 0.37 = 4.82   >  DJ  ln(25) =3.22 - 0.24 = 2.98   OK
--   Kaziranga  GHY  ln(146)=4.98 - 0.74 = 4.24   >  RPAN ln(42)=3.74 - 0.28 = 3.46   OK
--   Shillong   KYQ  ln(132)=4.88 - 0.34 = 4.54   >  NBQ ln(154)=5.04 - 0.84 = 4.20   OK
--
-- This score is only a SHORTLIST. It runs on haversine, and in the hills a straight line
-- lies about a drive. Pass 2 fetches the REAL road time from OSRM for every candidate and
-- re-ranks on that. The decision a traveller is shown is made on a real drive, always.

-- ---- 2a. RAILHEADS. Service first, distance second. (LAW B) ---------------------------

WITH station_service AS (
  SELECT ts.code, ts.name, ts.lat, ts.lng, count(st.*)::int AS services
  FROM train_stations ts
  JOIN train_stops st ON st.station_code = ts.code
  WHERE ts.lat IS NOT NULL AND ts.lng IS NOT NULL
  GROUP BY ts.code, ts.name, ts.lat, ts.lng
  -- 20 services is the floor between "a railhead" and "a halt". Jakhalabandha (9 trains)
  -- and Kamrup Khetri (8) are halts. They are not where you send a traveller with luggage,
  -- and they are certainly not where you send a man who asked to travel by train.
  HAVING count(st.*) >= 20
),
cand AS (
  SELECT n.id AS stay_node_id, s.code, s.name, s.lat, s.lng, s.services,
         (6371 * acos(LEAST(1, GREATEST(-1,
             cos(radians(n.lat)) * cos(radians(s.lat)) * cos(radians(s.lng) - radians(n.lng))
           + sin(radians(n.lat)) * sin(radians(s.lat)))))) AS km
  FROM stay_nodes n JOIN station_service s ON true
),
ranked AS (
  SELECT *, row_number() OVER (
    PARTITION BY stay_node_id
    ORDER BY (ln(GREATEST(services, 1)::numeric) - 0.5 * (km / 100)) DESC
  ) AS rk
  FROM cand WHERE km <= 200
)
INSERT INTO stay_node_gateways (stay_node_id, kind, rank, code, gateway_name, gateway_lat, gateway_lng, services, straight_line_km)
SELECT stay_node_id, 'rail', rk::smallint, code, name, lat, lng, services, round(km::numeric, 1)
FROM ranked WHERE rk <= 5;

-- ---- 2b. AIRPORTS. Only those an aeroplane actually visits. (LAW A) -------------------

WITH airport_service AS (
  SELECT ac.city, ac.lat, ac.lng,
         (SELECT count(*)::int FROM flight_sectors f
           WHERE lower(f.origin_city) = lower(ac.city) OR lower(f.dest_city) = lower(ac.city)) AS services
  FROM airport_cities ac
  WHERE ac.lat IS NOT NULL AND ac.lng IS NOT NULL
),
flying AS (
  -- THE LAW. Zero scheduled sectors = not an airport. This is what removes Tezpur, which
  -- sits in airport_cities with a runway, a name, coordinates — and no aeroplanes.
  SELECT * FROM airport_service WHERE services > 0
),
cand AS (
  SELECT n.id AS stay_node_id, a.city, a.lat, a.lng, a.services,
         (6371 * acos(LEAST(1, GREATEST(-1,
             cos(radians(n.lat)) * cos(radians(a.lat)) * cos(radians(a.lng) - radians(n.lng))
           + sin(radians(n.lat)) * sin(radians(a.lat)))))) AS km
  FROM stay_nodes n JOIN flying a ON true
),
ranked AS (
  SELECT *, row_number() OVER (
    PARTITION BY stay_node_id
    ORDER BY (ln(GREATEST(services, 1)::numeric) - 0.5 * (km / 100)) DESC
  ) AS rk
  FROM cand WHERE km <= 250
)
INSERT INTO stay_node_gateways (stay_node_id, kind, rank, code, gateway_name, gateway_lat, gateway_lng, services, straight_line_km)
SELECT stay_node_id, 'air', rk::smallint, NULL, city, lat, lng, services, round(km::numeric, 1)
FROM ranked WHERE rk <= 5;

-- ---- 3. THE ATTRACTION — a thing you go and SEE ---------------------------------------

CREATE TABLE attractions (
  id              bigserial PRIMARY KEY,
  name            text        NOT NULL,
  lat             double precision NOT NULL,
  lng             double precision NOT NULL,
  district        text,                      -- AN ATTRIBUTE (Amendment 2)
  state_name      text,
  -- THE PARENT. You sleep here; you come and see the attraction from here.
  stay_node_id    text        REFERENCES stay_nodes(id) ON DELETE SET NULL,
  straight_line_km numeric(6,1),             -- HONESTLY NAMED. Not a drive time.
  road_km         numeric(6,1),              -- OSRM. Filled by pass 2.
  road_min        integer,                   -- OSRM. The REAL drive (Amendment 1).
  -- EVERY ROW CARRIES ITS RECEIPT (spec 3.1). 'asi' = Archaeological Survey of India,
  -- government data, authoritative. 'own_guide' = our own written guides.
  source_kind     varchar(16) NOT NULL,
  source_url      text,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  verified_at     timestamptz,
  verified_by     text
);

-- 3a. ASI monuments. Government data. Only those we hold COORDINATES for — an attraction
-- we cannot locate cannot be attached to a StayNode by drive time, and Amendment 1 says
-- drive time is how it attaches. A monument with no coordinates is a name, not a place.
INSERT INTO attractions (name, lat, lng, district, state_name, source_kind, source_url, verified_at, verified_by)
SELECT DISTINCT ON (lower(a.name), a.lat, a.lng)
       a.name, a.lat, a.lng, a.district, a.state,
       'asi', 'https://asi.nic.in/', now(), 'asi_gov'
FROM asi_sites a
WHERE a.lat IS NOT NULL AND a.lng IS NOT NULL AND a.name IS NOT NULL AND btrim(a.name) <> '';

-- 3b. Attach each attraction to the NEAREST StayNode. Straight line for now — the second
-- pass replaces this with the real road drive, and only then is it a fact we may speak.
WITH nearest AS (
  SELECT a.id AS att_id, b.node_id, b.km
  FROM attractions a
  CROSS JOIN LATERAL (
    SELECT n.id AS node_id,
           (6371 * acos(LEAST(1, GREATEST(-1,
               cos(radians(a.lat)) * cos(radians(n.lat)) * cos(radians(n.lng) - radians(a.lng))
             + sin(radians(a.lat)) * sin(radians(n.lat)))))) AS km
    FROM stay_nodes n
    ORDER BY km ASC
    LIMIT 1
  ) b
)
UPDATE attractions att
SET stay_node_id = nearest.node_id,
    straight_line_km = round(nearest.km::numeric, 1)
FROM nearest
WHERE nearest.att_id = att.id
  AND nearest.km <= 150;   -- beyond 150 km it is not "a thing to see from here". It is another trip.

CREATE INDEX attractions_node_idx  ON attractions (stay_node_id);
CREATE INDEX attractions_geo_idx   ON attractions (lat, lng);
CREATE INDEX attractions_state_idx ON attractions (lower(state_name));

COMMIT;

-- ---- 4. PROVE IT ----------------------------------------------------------------------

\echo ''
\echo '=== the spine ==='
SELECT (SELECT count(*) FROM stay_nodes) AS stay_nodes,
       (SELECT count(*) FROM stay_nodes WHERE admin1_code IS NOT NULL) AS with_state,
       (SELECT count(*) FROM attractions) AS attractions,
       (SELECT count(*) FROM attractions WHERE stay_node_id IS NOT NULL) AS attached,
       (SELECT count(*) FROM stay_node_gateways) AS gateways;

\echo ''
\echo '=== THE STATE, BY GEOGRAPHY NOT SPELLING. Darjeeling must now have a state code. ==='
SELECT count(*) FILTER (WHERE admin1_code IS NOT NULL) AS with_state, count(*) AS total FROM stay_nodes;
SELECT name, admin1_code FROM stay_nodes
WHERE name IN ('Darjeeling','Gangtok','Guwahati','Shillong','Kaziranga','Kalimpong','Jorhat','Leh','Jaipur') ORDER BY name;

\echo ''
\echo '=== LAW B, PROVED: rank 1 for Gangtok must be New Jalpaiguri (180), NOT the toy train (25) ==='
\echo '=== ...and rank 1 for Guwahati must be GUWAHATI, not Bongaigaon 125 km away ==='
SELECT n.name AS stay_node, g.rank, g.gateway_name, g.services, g.straight_line_km AS sl_km
FROM stay_nodes n JOIN stay_node_gateways g ON g.stay_node_id = n.id
WHERE n.name IN ('Gangtok','Kaziranga','Shillong','Guwahati') AND g.kind = 'rail' AND g.rank <= 2
ORDER BY n.name, g.rank;

\echo ''
\echo '=== LAW A, PROVED: every air gateway has scheduled flights. Tezpur (0 sectors) is nowhere. ==='
SELECT n.name AS stay_node, g.rank, g.gateway_name AS airport, g.services AS sectors, g.straight_line_km AS sl_km
FROM stay_nodes n JOIN stay_node_gateways g ON g.stay_node_id = n.id
WHERE n.name IN ('Gangtok','Kaziranga','Shillong','Guwahati') AND g.kind = 'air' AND g.rank = 1
ORDER BY n.name;
SELECT 'Tezpur (a runway with no aeroplanes) appears as an air gateway?' AS check,
       count(*) AS must_be_zero FROM stay_node_gateways WHERE kind='air' AND lower(gateway_name)='tezpur';
SELECT 'Any air gateway with ZERO scheduled sectors?' AS check,
       count(*) AS must_be_zero FROM stay_node_gateways WHERE kind='air' AND services = 0;
SELECT 'Any railhead with fewer than 20 services?' AS check,
       count(*) AS must_be_zero FROM stay_node_gateways WHERE kind='rail' AND services < 20;

\echo ''
\echo '=== the North-East StayNodes we can actually plan with ==='
SELECT n.name, n.admin1_code AS state, n.tour_count AS sold,
       (SELECT count(*) FROM attractions a WHERE a.stay_node_id = n.id) AS attractions
FROM stay_nodes n
WHERE n.admin1_code IN ('03','18','29','20','17','31','26','30')
ORDER BY n.tour_count DESC, n.name;
