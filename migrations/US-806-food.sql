-- US-806 — THE FOOD GATE. Sprint 8.
--
-- "We are vegetarians and do not consume even eggs." A CONSTRAINT, NOT A PREFERENCE.
--
-- THIS TABLE IS CREATED EMPTY, AND THAT IS THE POINT.
--
-- Our own guides carry food text for 220 cities; 92 mention "vegetarian"; NINE mention
-- pure-veg or Jain. And for GUWAHATI, SHILLONG and KAZIRANGA — the three towns the Designer
-- proposes to this very traveller — they say NOTHING ABOUT FOOD AT ALL.
--
-- So we do not know whether he can eat there. A row invented to fill that silence would put
-- a man of 56 and his wife in front of a plate they cannot touch, in a town they cannot
-- leave, on a holiday we sold them. EMPTY UNTIL FILLED, NEVER GUESSED.
--
-- pure_veg_kitchen / jain_kitchen are DELIBERATELY THREE-STATE:
--   true  = we found one          false = we looked and there is none      NULL = WE HAVE NOT LOOKED
-- Collapsing NULL into false is exactly how the lie gets told.
--
-- verified_at NULL => the row waits for a human and is NEVER shown to a traveller (spec 3.2).

CREATE TABLE IF NOT EXISTS food_options (
  stay_node_id      text PRIMARY KEY REFERENCES stay_nodes(id) ON DELETE CASCADE,
  pure_veg_kitchen  boolean,                 -- three-state ON PURPOSE. NULL = not checked.
  jain_kitchen      boolean,                 -- three-state ON PURPOSE. NULL = not checked.
  places            jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{name, note}] we can VOUCH for
  source            text NOT NULL CHECK (source IN ('own_guide','own_executive','osm','web')),
  source_url        text,
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  verified_at       timestamptz,             -- NULL => waits for a human. Never shown.
  verified_by       text
);

COMMENT ON TABLE food_options IS
  'US-806 food gate. Empty until a human fills it. NULL kitchen = NOT CHECKED, never "no".';
COMMENT ON COLUMN food_options.pure_veg_kitchen IS
  'true = found. false = looked, none. NULL = WE HAVE NOT LOOKED. Do not collapse to boolean.';

CREATE INDEX IF NOT EXISTS food_options_verified_idx ON food_options (verified_at);
