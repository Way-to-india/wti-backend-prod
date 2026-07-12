-- REBUILD cities.tourCount FROM THE TRUTH. (See US-802f note in the commit.)
BEGIN;
CREATE TEMP TABLE tc_before AS SELECT id, name, "tourCount" AS old FROM cities WHERE "isActive";

WITH truth AS (
  SELECT c.id, (SELECT count(*)::int FROM tour_cities tc WHERE tc."cityId" = c.id) AS n
  FROM cities c
)
UPDATE cities c SET "tourCount" = truth.n
FROM truth WHERE truth.id = c.id AND c."tourCount" <> truth.n;
COMMIT;

\echo '=== the biggest corrections ==='
SELECT b.name, b.old AS was, c."tourCount" AS now_is, (b.old - c."tourCount") AS overstated_by
FROM tc_before b JOIN cities c ON c.id=b.id WHERE b.old <> c."tourCount"
ORDER BY abs(b.old - c."tourCount") DESC LIMIT 8;

\echo ''
\echo '=== is the counter now telling the truth? ==='
SELECT count(*) AS cities,
       count(*) FILTER (WHERE c."tourCount" = l.n) AS counter_correct,
       count(*) FILTER (WHERE c."tourCount" <> l.n) AS still_wrong
FROM cities c JOIN LATERAL (SELECT count(*)::int AS n FROM tour_cities tc WHERE tc."cityId"=c.id) l ON true
WHERE c."isActive";

\echo ''
\echo '=== the planner was OVER-VALUING these as en-route stops (anchors.ts: 0.2 * tourCount = DAYS) ==='
SELECT b.name, b.old AS claimed, c."tourCount" AS truth,
       round((0.2*b.old)::numeric,2) AS days_claimed, round((0.2*c."tourCount")::numeric,2) AS days_deserved
FROM tc_before b JOIN cities c ON c.id=b.id
WHERE b.old > c."tourCount" ORDER BY (b.old - c."tourCount") DESC LIMIT 6;
