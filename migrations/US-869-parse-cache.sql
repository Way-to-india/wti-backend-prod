-- US-869 — THE PERMANENT PARSE CACHE (additive DDL only).
-- One traveller's sentence is paid for once, EVER. Key = sha256 of the normalised
-- sentence (trim, lowercase, collapse whitespace, first 1000 chars — the same
-- normalisation as the in-memory L1). Value = the parsed {trip, raw} JSON.
-- Write-on-success only (US-861 doctrine): failed/empty parses are never stored.
-- Only MODEL parses are stored — deterministic readings cost nothing to recompute.

CREATE TABLE IF NOT EXISTS planner_parse_cache (
  sentence_hash text PRIMARY KEY,
  sentence      text        NOT NULL,
  parsed        jsonb       NOT NULL,
  hits          integer     NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_hit_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE planner_parse_cache IS
  'US-869: permanent Haiku parse cache for the public planner. Read-through under the in-memory L1; write-on-success only.';
