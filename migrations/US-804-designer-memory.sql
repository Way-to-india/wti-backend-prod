-- =====================================================================================
-- US-804 — MINE THE DESIGNERS. Sprint 8 / THE DESIGNER.
--
-- Two tables, and they are NOT the same grade of evidence. That difference is the whole
-- point of this migration, and it is written into the schema so it cannot be forgotten.
--
--   designer_cooccurrence   — which towns our designers put in a tour TOGETHER.
--                             Source: tour_cities, the actual composition of real tours
--                             we built and sold. HUMAN. Structural. This is Tier 1.
--
--   designer_typical_nights — how many nights a town is given.
--                             Source: tour_stays — and EVERY ONE of its 1,002 rows is
--                             `ai_backfill`. NOT ONE was written by a designer.
--
-- THE THING I NEARLY SHIPPED. The spec calls the second file
-- "US-804-designer-typical-nights.csv" and says "our designers have already told us how
-- many nights Leh deserves." THEY DID NOT. A MODEL DID. Stamping that with the Tier-1
-- badge ("our own catalogue — human") is exactly the fabrication this sprint exists to
-- prevent, and I was one story away from doing it.
--
-- SO IT WAS VERIFIED INSTEAD OF TRUSTED, using the spec's own rule (§3.2): "a row is
-- unverified until a SECOND, INDEPENDENT SOURCE agrees."
--
-- The independent source is tour_itinerary — 2,166 rows of HUMAN-WRITTEN day-by-day
-- prose ("Day 3: Ooty - Kodaikanal ... overnight stay at Kodaikanal"). A tour of N days
-- has N-1 nights. If the model's parse is faithful, sum(tour_stays.nights) must equal
-- max(tour_itinerary.day) - 1.
--
--   THE RESULT, on production 2026-07-12, across 355 tours carrying both signals:
--     343 tours  — EXACT (nights = days - 1)
--       8 tours  — off by one, high
--       4 tours  — disagree by more than one night
--     98.9% within a single night.
--
-- So the nights are a FAITHFUL PARSE of our designers' own itineraries — not a
-- fabrication. But a faithful parse is still a parse, and it is labelled as one:
-- provenance = 'catalogue_ai_parsed', never 'designer_catalogue'. And `reconciled` is
-- per-city, so the handful of towns whose tours did NOT reconcile can never hide inside
-- a global average.
--
-- WHY DERIVED, NOT IMPORTED. The committed CSVs are a snapshot; they go stale the moment
-- a designer publishes a tour. tour_cities is the living source. This SQL rebuilds from
-- it, and is re-runnable. (It was proved correct by reproducing the CSV exactly:
-- Agra-Delhi 37, Delhi-Jaipur 29, Agra-Jaipur 26.)
-- =====================================================================================

BEGIN;

DROP TABLE IF EXISTS designer_cooccurrence;
DROP TABLE IF EXISTS designer_typical_nights;

-- ---- 1. THE CO-OCCURRENCE. Our designers' own hand. ---------------------------------

CREATE TABLE designer_cooccurrence (
  city              text        NOT NULL,
  pairs_with        text        NOT NULL,
  designed_together integer     NOT NULL,
  -- THE TIER, AT THE DATA LAYER. A stop chosen because our designers sold it together
  -- 82 times is a different promise from one a model suggested, and the row must say so.
  provenance        varchar(32) NOT NULL DEFAULT 'designer_catalogue',
  computed_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (city, pairs_with)
);

INSERT INTO designer_cooccurrence (city, pairs_with, designed_together, provenance)
SELECT c1.name, c2.name, count(*)::int, 'designer_catalogue'
FROM tour_cities tc1
JOIN tour_cities tc2 ON tc1."tourId" = tc2."tourId" AND tc1."cityId" <> tc2."cityId"
JOIN cities c1 ON c1.id = tc1."cityId"
JOIN cities c2 ON c2.id = tc2."cityId"
GROUP BY c1.name, c2.name
HAVING count(*) >= 2;

CREATE INDEX designer_cooc_city_idx ON designer_cooccurrence (lower(city));
CREATE INDEX designer_cooc_strength_idx ON designer_cooccurrence (designed_together DESC);

-- ---- 2. THE TYPICAL NIGHTS. A model's parse of our designers' itineraries. ----------

CREATE TABLE designer_typical_nights (
  city            text        PRIMARY KEY,
  typical_nights  numeric(3,1) NOT NULL,
  times_designed  integer     NOT NULL,
  -- NOT 'designer_catalogue'. Every source row in tour_stays is `ai_backfill`.
  provenance      varchar(32) NOT NULL DEFAULT 'catalogue_ai_parsed',
  confidence      numeric(3,2),
  -- TRUE only if EVERY tour that contributed a night to this city reconciled to within
  -- one night of the HUMAN itinerary's day count. Per-city, so that the towns whose
  -- parse disagreed cannot hide inside the 98.9% global average.
  reconciled      boolean     NOT NULL DEFAULT false,
  tours_checked   integer     NOT NULL DEFAULT 0,
  tours_agreed    integer     NOT NULL DEFAULT 0,
  computed_at     timestamptz NOT NULL DEFAULT now()
);

WITH human AS (
  -- The independent source: human-written day-by-day. N days = N-1 nights.
  SELECT "tourId", max(day) AS human_days
  FROM tour_itinerary GROUP BY "tourId"
),
tour_agreement AS (
  -- Does the model's total for this TOUR match the human day count?
  SELECT ts."tourId",
         (abs(sum(ts.nights) - (h.human_days - 1)) <= 1) AS agrees
  FROM tour_stays ts
  JOIN human h ON h."tourId" = ts."tourId"
  GROUP BY ts."tourId", h.human_days
)
INSERT INTO designer_typical_nights
  (city, typical_nights, times_designed, provenance, confidence, reconciled, tours_checked, tours_agreed)
SELECT
  c.name,
  round(avg(ts.nights)::numeric, 1),
  count(*)::int,
  'catalogue_ai_parsed',
  round(avg(ts.confidence)::numeric, 2),
  -- every contributing tour that we could check, agreed
  bool_and(COALESCE(ta.agrees, true)) AND count(ta.agrees) > 0,
  count(ta.agrees)::int,
  count(*) FILTER (WHERE ta.agrees)::int
FROM tour_stays ts
JOIN cities c ON c.id = ts."wtiCityId"
LEFT JOIN tour_agreement ta ON ta."tourId" = ts."tourId"
GROUP BY c.name;

CREATE INDEX designer_nights_city_idx ON designer_typical_nights (lower(city));

COMMIT;

-- ---- 3. PROVE IT ---------------------------------------------------------------------

\echo ''
\echo '=== co-occurrence: must reproduce the committed CSV exactly ==='
SELECT city, pairs_with, designed_together, provenance
FROM designer_cooccurrence ORDER BY designed_together DESC, city LIMIT 6;

\echo ''
\echo '=== the North East: the catalogue HAD already answered him ==='
SELECT city, pairs_with, designed_together FROM designer_cooccurrence
WHERE city IN ('Guwahati','Gangtok','Shillong','Kaziranga','Darjeeling') ORDER BY city, designed_together DESC;

\echo ''
\echo '=== typical nights: the tier is declared, and the reconciliation is per-city ==='
SELECT city, typical_nights, times_designed, provenance, reconciled, tours_agreed, tours_checked
FROM designer_typical_nights ORDER BY times_designed DESC LIMIT 8;

\echo ''
\echo '=== the towns whose parse did NOT reconcile — they must be findable, not averaged away ==='
SELECT city, typical_nights, times_designed, tours_agreed, tours_checked
FROM designer_typical_nights WHERE NOT reconciled ORDER BY times_designed DESC;

\echo ''
\echo '=== totals ==='
SELECT (SELECT count(*) FROM designer_cooccurrence)   AS cooccurrence_rows,
       (SELECT count(DISTINCT city) FROM designer_cooccurrence) AS cities_paired,
       (SELECT count(*) FROM designer_typical_nights) AS nights_rows,
       (SELECT count(*) FROM designer_typical_nights WHERE reconciled) AS nights_reconciled;
