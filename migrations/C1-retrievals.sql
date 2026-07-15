-- C1 — proof objects stored on every retrieval (§10.3). Additive, idempotent.
CREATE TABLE IF NOT EXISTS library_retrievals (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  request    text NOT NULL,
  alias_hit  text,
  served     text[] NOT NULL DEFAULT '{}',
  proof      jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS library_retrievals_created_idx ON library_retrievals(created_at);
