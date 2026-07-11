-- =============================================================================
-- RETENTION SWEEP — the honest answer to "we are paying for storage for people we
-- do not know."  We are, and it is right that we do — but only for as long as the
-- row can still do some good.
--
-- We KEEP a plan for ever if it earned its keep:
--   • someone gave a contact (owner_email / owner_phone), or
--   • it was actually shared (shared_at), or
--   • it turned into an enquiry (lead_id), or
--   • it was named (title), or a family member joined it (plan_members).
--
-- We DROP the heavy part of a plan that did none of those things after 90 days.
-- Note we do NOT delete the row: we blank the big `payload` snapshot and keep the
-- small `input`, so the plan can still be RE-SOLVED if he ever comes back with the
-- link. The demand row (route_demand) is never touched — it is a few hundred bytes
-- and it is the whole reason the anonymous visitor was worth serving.
--
-- Run it monthly:  psql "$DATABASE_URL" -f sweep.sql
-- =============================================================================

UPDATE saved_plans p
   SET payload = NULL,
       updated_at = now()
 WHERE p.payload IS NOT NULL
   AND p.created_at < now() - interval '90 days'
   AND p.lead_id     IS NULL
   AND p.owner_email IS NULL
   AND p.owner_phone IS NULL
   AND p.shared_at   IS NULL
   AND p.title       IS NULL
   AND NOT EXISTS (SELECT 1 FROM plan_members m WHERE m.plan_id = p.id);

-- what it costs us today, in plain numbers
SELECT count(*)                                                   AS plans,
       pg_size_pretty(sum(pg_column_size(payload))::bigint)       AS payload_bytes,
       pg_size_pretty(pg_total_relation_size('saved_plans'))      AS table_on_disk
  FROM saved_plans;
