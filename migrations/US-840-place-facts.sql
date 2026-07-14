-- US-840 — curated place facts for the proposal gates. ADDITIVE ONLY.
-- Seeds carry evidence; approved_by is NULL until the founder ticks a row.
-- The gates err in the SAFE direction while unticked: a closure/trek row can only
-- protect a traveller, never invent a trip.

CREATE TABLE IF NOT EXISTS place_seasons (
  id bigserial PRIMARY KEY,
  place_name text NOT NULL,
  kind varchar(16) NOT NULL CHECK (kind IN ('closed','yatra_window','advisory')),
  months int[] NOT NULL,
  note text NOT NULL,
  evidence text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS place_seasons_name_idx ON place_seasons (lower(place_name));

CREATE TABLE IF NOT EXISTS place_access (
  id bigserial PRIMARY KEY,
  place_name text NOT NULL,
  access varchar(16) NOT NULL CHECK (access IN ('road','steps','trek','climb','ropeway')),
  magnitude text,
  note text NOT NULL,
  evidence text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS place_access_name_idx ON place_access (lower(place_name));

-- ---- SEASON SEEDS (the facts nobody disputes) ------------------------------------------
INSERT INTO place_seasons (place_name, kind, months, note, evidence)
SELECT * FROM (VALUES
  ('Kedarnath',  'closed', ARRAY[11,12,1,2,3,4], 'the Kedarnath temple closes for the winter, from around Diwali to Akshaya Tritiya', 'Shri Badarinath–Kedarnath Temple Committee annual schedule'),
  ('Badrinath',  'closed', ARRAY[11,12,1,2,3,4], 'the Badrinath temple closes for the winter, from around Diwali to late April',      'Shri Badarinath–Kedarnath Temple Committee annual schedule'),
  ('Gangotri',   'closed', ARRAY[11,12,1,2,3,4], 'the Gangotri temple closes for the winter, from around Diwali to Akshaya Tritiya',  'Uttarakhand Char Dham yatra calendar'),
  ('Yamunotri',  'closed', ARRAY[11,12,1,2,3,4], 'the Yamunotri temple closes for the winter, from around Diwali to Akshaya Tritiya', 'Uttarakhand Char Dham yatra calendar'),
  ('Guptkashi',  'advisory', ARRAY[11,12,1,2,3,4], 'Guptkashi stays open, but it is the base for Kedarnath, whose temple is closed in these months', 'Char Dham yatra calendar'),
  ('Amarnath',   'yatra_window', ARRAY[7,8], 'the Amarnath yatra runs only in its July–August window, weather permitting', 'Shri Amarnathji Shrine Board yatra notifications'),
  ('Leh',        'advisory', ARRAY[11,12,1,2,3], 'in these months the Srinagar–Leh and Manali–Leh highways are closed by snow — Leh is reached by air only', 'BRO road-status notifications, annual pattern')
) AS s(place_name, kind, months, note, evidence)
WHERE NOT EXISTS (SELECT 1 FROM place_seasons);

-- ---- ACCESS SEEDS (the body gate's evidence) --------------------------------------------
INSERT INTO place_access (place_name, access, magnitude, note, evidence)
SELECT * FROM (VALUES
  ('Kedarnath',     'trek',  'about 16 km mountain trek from Gaurikund',      'the temple is reached on foot, by pony or palki; a helicopter service exists and must be verified separately', 'Uttarakhand tourism / temple committee route facts'),
  ('Yamunotri',     'trek',  'about 6 km mountain trek from Janki Chatti',    'reached on foot, by pony or palki', 'Uttarakhand tourism route facts'),
  ('Vaishno Devi',  'trek',  'about 13 km uphill walk from Katra',            'walked, or by pony/palki; a helicopter service exists and must be verified separately', 'Shri Mata Vaishno Devi Shrine Board route facts'),
  ('Amarnath',      'trek',  'a multi-day high-altitude yatra trek',          'a demanding high-altitude route with medical-certificate requirements', 'Shri Amarnathji Shrine Board yatra rules'),
  ('Hemkund Sahib', 'trek',  'about 19 km trek from Govindghat via Ghangaria','a steep high-altitude trek', 'Uttarakhand tourism route facts'),
  ('Tungnath',      'climb', 'about 3.5 km steep climb from Chopta',          'short but steep, at altitude', 'Uttarakhand tourism route facts'),
  ('Girnar',        'steps', 'about 10,000 stone steps to the summit shrines','climbed before dawn by most pilgrims; a ropeway covers the first stretch to Ambaji', 'Gujarat tourism / Junagadh route facts'),
  ('Palitana',      'steps', 'about 3,800 stone steps up Shatrunjaya hill',   'climbed on foot or by doli', 'Gujarat tourism route facts'),
  ('Sabarimala',    'trek',  'about 4–5 km forest trek from Pamba',           'walked; traditional route restrictions apply', 'Travancore Devaswom Board route facts')
) AS a(place_name, access, magnitude, note, evidence)
WHERE NOT EXISTS (SELECT 1 FROM place_access);
