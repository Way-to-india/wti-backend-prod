-- US-830 — LOAD THE APPROVED THEME INDEX.
-- Source: WTI-THEME-INDEX-UPDATED-APPROVED.xlsx, ticked by the founder, 14 July 2026.
-- NOTHING HERE WAS INVENTED. Every row carries its RECEIPT.
BEGIN;

-- ============ 1. THE VOCABULARY IS LOCKED IN THE DATABASE ============
-- A model may PROPOSE a chip. It may never REGISTER one. The CHECK constraint is the tick.
CREATE TABLE IF NOT EXISTS intent_place (
  id          bigserial PRIMARY KEY,
  city_id     text        NOT NULL REFERENCES stay_nodes(id) ON DELETE CASCADE,
  chip        varchar(48) NOT NULL,
  rank        smallint    NOT NULL DEFAULT 1,
  role        varchar(24) NOT NULL DEFAULT 'core',
  source      varchar(32) NOT NULL,
  evidence    text        NOT NULL,
  tour_count  integer     NOT NULL DEFAULT 0,
  confidence  varchar(24) NOT NULL,
  approved_by text        NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intent_place_chip_ck CHECK (chip IN ('Pilgrimage', 'Beaches', 'Honeymoon & Romance', 'Culture & Festivals', 'Heritage & Forts', 'Hill Stations & Mountains', 'Trekking & Adventure', 'Wildlife & Nature')),
  CONSTRAINT intent_place_role_ck CHECK (role IN ('core','gateway')),
  CONSTRAINT intent_place_rank_ck CHECK (rank IN (1,2)),
  CONSTRAINT intent_place_uniq UNIQUE (city_id, chip)
);
CREATE INDEX IF NOT EXISTS intent_place_chip_idx ON intent_place (chip, role);
CREATE INDEX IF NOT EXISTS intent_place_city_idx ON intent_place (city_id);

-- A NAME IS NOT A KEY. Fifth time. This table is the answer.
CREATE TABLE IF NOT EXISTS city_alias (
  alias     text PRIMARY KEY,
  city_id   text NOT NULL REFERENCES stay_nodes(id) ON DELETE CASCADE,
  reason    text NOT NULL,
  added_at  timestamptz NOT NULL DEFAULT now()
);

DELETE FROM intent_place;  -- idempotent reload

-- ============ 2. THE TOWNS THE FOUNDER ADDED ============
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('abbott mount'), 'Abbott Mount', 29.62, 80.03, 'Uttarakhand', '39', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('agumbe'), 'Agumbe', 13.5028, 75.0925, 'Karnataka', '19', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('amarnath'), 'Amarnath', 34.215, 75.5, 'Jammu And Kashmir', NULL, 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('amboli'), 'Amboli', 15.95, 74, 'Maharashtra', '16', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('araku valley'), 'Araku Valley', 18.33, 82.87, 'Andhra Pradesh', '02', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('arupadai veedu temple circuit'), 'Arupadai Veedu Temple Circuit', 10.45, 77.521, 'Tamil Nadu', '25', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('auli'), 'Auli', 30.53, 79.57, 'Uttarakhand', '39', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('auroville'), 'Auroville', 12.0052, 79.81, 'Puducherry', '22', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('avantipur'), 'Avantipur', 33.92, 75.01, 'Jammu And Kashmir', NULL, 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('badami aihole pattadakal'), 'Badami Aihole Pattadakal', 15.9149, 75.685, 'Karnataka', '19', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('bhalukpong'), 'Bhalukpong', 27.01, 92.64, 'Arunachal Pradesh', '30', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('billing'), 'Billing', 32.05, 76.72, 'Himachal Pradesh', '11', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('champhai'), 'Champhai', 23.47, 93.33, 'Mizoram', '31', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('chikhaldara'), 'Chikhaldara', 21.4, 77.36, 'Maharashtra', '16', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('chitharal'), 'Chitharal', 8.26, 77.26, 'Tamil Nadu', '25', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('chitrakoot'), 'Chitrakoot', 25.2, 80.86, 'Madhya Pradesh', '35', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('chopta valley'), 'Chopta Valley', 27.9, 88.75, 'Sikkim', '29', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('daman'), 'Daman', 20.3974, 72.8328, 'Dadra and Nagar Haveli and Daman and Diu', NULL, 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('dantewada'), 'Dantewada', 18.9, 81.35, 'Chhattisgarh', '37', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('devikulam'), 'Devikulam', 10.05, 77.1, 'Kerala', '13', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('dhauli'), 'Dhauli', 20.19, 85.84, 'Odisha', '21', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('girnar'), 'Girnar', 21.5, 70.5, 'Gujarat', '09', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('gushaini village'), 'Gushaini Village', 31.8, 77.35, 'Himachal Pradesh', '11', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('halebid'), 'Halebid', 13.213, 75.995, 'Karnataka', '19', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('harsil'), 'Harsil', 31.03, 78.74, 'Uttarakhand', '39', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('kalady'), 'Kalady', 10.17, 76.44, 'Kerala', '13', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('kamshet'), 'Kamshet', 18.78, 73.55, 'Maharashtra', '16', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('kasauli'), 'Kasauli', 30.899, 76.965, 'Himachal Pradesh', '11', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('khimsar'), 'Khimsar', 27.07, 73.5, 'Rajasthan', '24', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('khodala'), 'Khodala', 19.8, 73.3, 'Maharashtra', '16', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('kotgarh'), 'Kotgarh', 31.32, 77.48, 'Himachal Pradesh', '11', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('kurukshetra'), 'Kurukshetra', 29.9695, 76.8783, 'Haryana', '10', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('kutch'), 'Kutch', 23.7337, 69.8597, 'Gujarat', '09', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('lachung'), 'Lachung', 27.69, 88.74, 'Sikkim', '29', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('lakkidi'), 'Lakkidi', 11.54, 76.03, 'Kerala', '13', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('lansdowne'), 'Lansdowne', 29.8377, 78.682, 'Uttarakhand', '39', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('majuli'), 'Majuli', 26.95, 94.17, 'Assam', '03', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('malampuzha'), 'Malampuzha', 10.83, 76.69, 'Kerala', '13', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('mamit'), 'Mamit', 23.93, 92.49, 'Mizoram', '31', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('marigaon'), 'Marigaon', 26.25, 92.34, 'Assam', '03', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('mashobra'), 'Mashobra', 31.12, 77.23, 'Himachal Pradesh', '11', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('matheran'), 'Matheran', 18.9866, 73.2707, 'Maharashtra', '16', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('mirik'), 'Mirik', 26.888, 88.189, 'West Bengal', '28', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('mori'), 'Mori', 31, 78.05, 'Uttarakhand', '39', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('morni'), 'Morni', 30.69, 77, 'Haryana', '10', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('mukteshwar'), 'Mukteshwar', 29.47, 79.65, 'Uttarakhand', '39', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('munsiyari'), 'Munsiyari', 30.07, 80.24, 'Uttarakhand', '39', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('nalanda'), 'Nalanda', 25.1358, 85.4436, 'Bihar', '34', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('nalgonda'), 'Nalgonda', 17.0575, 79.2684, 'Telangana', '40', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('navagraha temple circuit'), 'Navagraha Temple Circuit', 10.9601, 79.3845, 'Tamil Nadu', '25', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('nelliyampathy'), 'Nelliyampathy', 10.53, 76.69, 'Kerala', '13', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('nersa'), 'Nersa', 15.63, 74.28, 'Karnataka', '19', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('netrani island'), 'Netrani Island', 14.02, 74.33, 'Karnataka', '19', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('palampur'), 'Palampur', 32.11, 76.54, 'Himachal Pradesh', '11', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('panhala'), 'Panhala', 16.8127, 74.11, 'Maharashtra', '16', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('patnitop'), 'Patnitop', 33.08, 75.33, 'Jammu And Kashmir', NULL, 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('pattadakal'), 'Pattadakal', 15.948, 75.816, 'Karnataka', '19', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('pavagarh'), 'Pavagarh', 22.46, 73.51, 'Gujarat', '09', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('pawapuri'), 'Pawapuri', 25.08, 85.51, 'Bihar', '34', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('payyoli'), 'Payyoli', 11.53, 75.66, 'Kerala', '13', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('pelling'), 'Pelling', 27.3, 88.24, 'Sikkim', '29', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('periyar'), 'Periyar', 9.46, 77.24, 'Kerala', '13', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('phawngpui'), 'Phawngpui', 22.66, 93.03, 'Mizoram', '31', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('pondicherry'), 'Pondicherry', 11.9416, 79.8083, 'Puducherry', '22', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('ponmudi'), 'Ponmudi', 8.76, 77.12, 'Kerala', '13', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('ramgarh'), 'Ramgarh', 29.4, 79.58, 'Uttarakhand', '39', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('rayadurg'), 'Rayadurg', 14.7, 76.85, 'Andhra Pradesh', '02', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('sangla'), 'Sangla', 31.42, 78.26, 'Himachal Pradesh', '11', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('saputara'), 'Saputara', 20.57, 73.75, 'Gujarat', '09', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('sariska'), 'Sariska', 27.33, 76.42, 'Rajasthan', '24', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('shoghi'), 'Shoghi', 31.07, 77.12, 'Himachal Pradesh', '11', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('somnath'), 'Somnath', 20.888, 70.401, 'Gujarat', '09', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('srirangapatna'), 'Srirangapatna', 12.41, 76.69, 'Karnataka', '19', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('tawang'), 'Tawang', 27.586, 91.859, 'Arunachal Pradesh', '30', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('thanedar'), 'Thanedar', 31.3, 77.5, 'Himachal Pradesh', '11', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('thiruvilwamala'), 'Thiruvilwamala', 10.65, 76.35, 'Kerala', '13', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('toranmal'), 'Toranmal', 21.9, 74.47, 'Maharashtra', '16', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('trichy'), 'Trichy', 10.7905, 78.7047, 'Tamil Nadu', '25', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('vagamon'), 'Vagamon', 9.69, 76.9, 'Kerala', '13', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('vaishali'), 'Vaishali', 25.99, 85.13, 'Bihar', '34', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('warangal'), 'Warangal', 17.9689, 79.5941, 'Telangana', '40', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('yelagiri'), 'Yelagiri', 12.58, 78.64, 'Tamil Nadu', '25', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('yercaud'), 'Yercaud', 11.775, 78.2095, 'Tamil Nadu', '25', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('yumthang'), 'Yumthang', 27.8, 88.7, 'Sikkim', '29', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('zanskar'), 'Zanskar', 33.47, 76.89, 'Ladakh', '41', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('ziro'), 'Ziro', 27.59, 93.83, 'Arunachal Pradesh', '30', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('naimisharanya'), 'Naimisharanya', 27.35, 80.49, 'Uttar Pradesh', '36', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('vindhyachal'), 'Vindhyachal', 25.16, 82.5, 'Uttar Pradesh', '36', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;
INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
  VALUES ('wtiidx_' || md5('shringverpur'), 'Shringverpur', 25.63, 81.63, 'Uttar Pradesh', '36', 0, 'wti_theme_index', now(), 'founder', now())
  ON CONFLICT (id) DO NOTHING;

-- 91 towns added.

-- ============ 3. PRAYAGRAJ IS NOT ALLAHABAD'S NICKNAME. IT IS ITS NAME. ============
UPDATE stay_nodes SET name = 'Prayagraj', state_name = 'Uttar Pradesh', admin1_code = '36'
 WHERE lower(name) = 'allahabad';
INSERT INTO city_alias (alias, city_id, reason)
  SELECT 'allahabad', id, 'Renamed Prayagraj in 2018. We held it under the old name and the planner could not find it when a traveller typed the new one.'
    FROM stay_nodes WHERE lower(name) = 'prayagraj'
  ON CONFLICT (alias) DO NOTHING;

-- ============ 4a. SHEET 3 — OUR OWN TAGGED TOURS. TIER 1. FACT, NOT A GUESS. ============
-- The 53 Gateway/Transit rows are NOT dropped. Their receipts are the only routing signal
-- in this file: each one proves those towns are sequenced together in a tour we have SOLD.
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: delhi-agra-jaipur-udaipur-tour-package | golden-triangle-and-gangaur-festival-tour | golden-triangle-khajuraho-dance-festival-tour | golden-triangle-tour | golden-triangle-tour-5-days | golden-triangle-tour-by-car | golden-triangle-tour-by-train | go', 22, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'delhi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: delhi-agra-jaipur-udaipur-tour-package | golden-triangle-and-gangaur-festival-tour | golden-triangle-khajuraho-dance-festival-tour | golden-triangle-tour | golden-triangle-tour-5-days | golden-triangle-tour-by-car | golden-triangle-tour-by-train | go', 22, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'delhi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: delhi-agra-jaipur-udaipur-tour-package | golden-triangle-and-gangaur-festival-tour | golden-triangle-khajuraho-dance-festival-tour | golden-triangle-tour | golden-triangle-tour-5-days | golden-triangle-tour-by-car | golden-triangle-tour-by-train | go', 22, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jaipur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: delhi-agra-jaipur-udaipur-tour-package | golden-triangle-and-gangaur-festival-tour | golden-triangle-khajuraho-dance-festival-tour | golden-triangle-tour | golden-triangle-tour-5-days | golden-triangle-tour-by-car | golden-triangle-tour-by-train | go', 22, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jaipur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: delhi-agra-jaipur-udaipur-tour-package | golden-triangle-and-gangaur-festival-tour | golden-triangle-khajuraho-dance-festival-tour | golden-triangle-tour | golden-triangle-tour-5-days | golden-triangle-tour-by-car | golden-triangle-tour-with-goa | go', 20, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'agra'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: himachal-holiday-tour-package | himachal-pradesh-honeymoon-package | himachal-tour-package | kullu-manali-tour | kullu-manali-tour-package-from-ahmedabad | kullu-manali-tour-package-from-chennai | kullu-manali-tour-package-from-delhi | kullu-manali-t', 13, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'manali'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: himachal-holiday-tour-package | himachal-pradesh-honeymoon-package | himachal-tour-package | kullu-manali-tour | kullu-manali-tour-package-from-ahmedabad | kullu-manali-tour-package-from-chennai | kullu-manali-tour-package-from-delhi | kullu-manali-t', 13, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'manali'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: delhi-to-shimla-tour-package | himachal-holiday-tour-package | himachal-pradesh-honeymoon-package | himachal-tour-package | kullu-manali-tour-package-from-ahmedabad | kullu-manali-tour-package-from-chennai | kullu-manali-tour-package-from-delhi | kul', 12, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'shimla'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: delhi-to-shimla-tour-package | himachal-holiday-tour-package | himachal-pradesh-honeymoon-package | himachal-tour-package | kullu-manali-tour-package-from-ahmedabad | kullu-manali-tour-package-from-chennai | kullu-manali-tour-package-from-delhi | kul', 12, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'shimla'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: dalhousie-khajjiar-dharamshala-tour | dharamshala-tour | himachal-holiday-tour-package | himachal-tour-package | kullu-manali-tour-package-from-ahmedabad | kullu-manali-tour-package-from-chennai | kullu-manali-tour-package-from-delhi | kullu-manali-t', 11, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chandigarh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: badrinath-kedarnath-yatra | badrinath-yatra | chardham-yatra-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | haridwar-mussoorie-tour-package | haridwar-rishikesh-tour | haridwar-rishikesh-varanasi-tour-package-from-delhi | hari', 11, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'haridwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: badrinath-kedarnath-yatra | badrinath-yatra | chardham-yatra-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | haridwar-mussoorie-tour-package | haridwar-rishikesh-tour | haridwar-rishikesh-varanasi-tour-package-from-delhi | hari', 11, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'haridwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: buddha-tour | char-dham-yatra-in-india | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | delhi-agra-varanasi-tour-package | delhi-to-haridwar-rishikesh-tour-package | golden-temple-tour-amritsar | gurudwara-in-punjab-tour | haridwar-rishikesh', 10, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'delhi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: bangalore-mysore-ooty-coorg-tour-package | bangalore-mysore-ooty-tour-package | bangalore-to-ooty-package | munnar-ooty-kodaikanal-tour-package | ooty-kodaikanal-munnar-tour-package | ooty-kodaikanal-tour-package | ooty-tour-package | ooty-tour-packa', 9, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ooty'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: bangalore-mysore-ooty-coorg-tour-package | bangalore-mysore-ooty-tour-package | bangalore-to-ooty-package | munnar-ooty-kodaikanal-tour-package | ooty-kodaikanal-munnar-tour-package | ooty-kodaikanal-tour-package | ooty-tour-package | ooty-tour-packa', 9, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ooty'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: corbett-dhikala-tour-package | corbett-elephant-safari-tour | corbett-nainital-package | corbett-national-park-tour | corbett-weekend-tour | india-wildlife-tour | jim-corbett-park-weekend-tour-package-by-rail | jim-corbett-park-with-nainital-tour', 8, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'corbett'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: bandhavgarh-national-park-tour | bandhavgarh-national-park-tour-package | bandhavgarh-safari | bandhavgarh-tour-from-mumbai | bandhavgarh-wildlife-safari-tour-from-ahmedabad | bandhavgarh-wildlife-safari-tour-from-bangalore | bandhavgarh-wildlife-saf', 8, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'umaria'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: buddha-tour | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | cmq0siymm00g5nrpujtwpr6d4 | delhi-agra-varanasi-tour-package | haridwar-rishikesh-varanasi-tour-package-from-delhi | kashi-vishwanath-jyotirlinga-tour-package | sapta-puri-yatra', 8, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'varanasi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: buddha-tour | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | cmq0siymm00g5nrpujtwpr6d4 | delhi-agra-varanasi-tour-package | haridwar-rishikesh-varanasi-tour-package-from-delhi | kashi-vishwanath-jyotirlinga-tour-package | sapta-puri-yatra', 8, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'varanasi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: arupadai-veedu-tour | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | madurai-rameshwaram-kanyakumari-tour-package | rameshwaram-jyotirlinga-tour-package | south-india-temple-tour | tamil-nadu-temples-tour', 7, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'madurai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kerala-hill-station-tour-package | munnar-hill-station-tour | munnar-hill-tour | munnar-ooty-kodaikanal-tour-package | munnar-tour | ooty-kodaikanal-munnar-tour-package | south-india-hill-station-tour', 7, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'munnar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: kerala-hill-station-tour-package | munnar-hill-station-tour | munnar-hill-tour | munnar-ooty-kodaikanal-tour-package | munnar-tour | ooty-kodaikanal-munnar-tour-package | south-india-hill-station-tour', 7, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'munnar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'wti_tour_theme', 'our tours: goa-houseboat-tour-package | goa-trip-package-from-delhi | golden-goa-tour | mumbai-goa-beach-tour | mumbai-goa-tour | mumbai-goa-tour-packages', 6, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'goa'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: goa-houseboat-tour-package | goa-trip-package-from-delhi | golden-goa-tour | mumbai-goa-beach-tour | mumbai-goa-tour | mumbai-goa-tour-packages', 6, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'goa'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: best-of-western-hill-tour | khandala-tour | lonavala-khandala-tour-package | lonavala-tour | mahabaleshwar-tour | maharashtra-tour', 6, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mumbai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: best-of-kumaon-hill-tour | kumaon-tour | nainital-almora-kausani-tour | nainital-hill-tour | nainital-ranikhet-tour | nainital-tour-package', 6, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nainital'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: best-of-kumaon-hill-tour | kumaon-tour | nainital-almora-kausani-tour | nainital-hill-tour | nainital-ranikhet-tour | nainital-tour-package', 6, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nainital'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: char-dham-yatra-in-india | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | madurai-rameshwaram-kanyakumari-tour-package | rameshwaram-jyotirlinga-tour-package | south-india-temple-tour', 6, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'rameshwaram'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: badrinath-kedarnath-yatra | badrinath-yatra | badrinath-yatra-by-helicopter | char-dham-yatra-in-india | chardham-yatra-tour-package', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'badrinath'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: arupadai-veedu-tour | sapta-puri-yatra | south-india-temple-tour | tirupati-package-tour | tirupati-tour-package-from-chennai', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chennai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: dalhousie-dharamshala-package | dalhousie-khajjiar-dharamshala-tour | dalhousie-tour | himachal-pradesh-honeymoon-package | himachal-tour-package', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dalhousie'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: dalhousie-dharamshala-package | dalhousie-khajjiar-dharamshala-tour | dalhousie-tour | himachal-pradesh-honeymoon-package | himachal-tour-package', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dalhousie'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: char-dham-yatra-in-india | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | dwarka-somnath-package-from-delhi | sapta-puri-yatra', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dwarka'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'wti_tour_theme', 'our tours: char-dham-yatra-in-india | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | dwarka-somnath-package-from-delhi | sapta-puri-yatra', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dwarka'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: badrinath-kedarnath-yatra | chardham-yatra-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | kedarnath-jyotirlinga-tour-package', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'guptkashi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kodaikanal-holidays | munnar-ooty-kodaikanal-tour-package | ooty-kodaikanal-munnar-tour-package | ooty-kodaikanal-tour-package | south-india-hill-station-tour', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kodaikanal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: kodaikanal-holidays | munnar-ooty-kodaikanal-tour-package | ooty-kodaikanal-munnar-tour-package | ooty-kodaikanal-tour-package | south-india-hill-station-tour', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kodaikanal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: incredible-ladakh-holiday | ladakh-tour | leh-ladakh-road-trip-by-car | manali-leh-tour | srinagar-to-leh-tour-package', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'leh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: incredible-ladakh-holiday | ladakh-tour | leh-ladakh-road-trip-by-car | manali-leh-tour | srinagar-to-leh-tour-package', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'leh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kashmir-ladakh-tour-package | leh-ladakh-road-trip | majestic-ladakh-tour | manali-to-leh-tour | srinagar-leh-ladakh-tour-package', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'leh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: kashmir-ladakh-tour-package | leh-ladakh-road-trip | majestic-ladakh-tour | manali-to-leh-tour | srinagar-leh-ladakh-tour-package', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'leh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kashmir-tour | kashmir-tour-package | leh-ladakh-road-trip-by-car | srinagar-houseboat-packages | srinagar-to-leh-tour-package', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srinagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: kashmir-tour | kashmir-tour-package | leh-ladakh-road-trip-by-car | srinagar-houseboat-packages | srinagar-to-leh-tour-package', 5, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srinagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: amritsar-dalhousie-dharamshala-tour | himachal-tour-package-for-couple | kullu-manali-tour-package-from-mumbai | shimla-tour-package-from-delhi-for-couples', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chandigarh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'gateway', 'wti_tour_theme', 'our tours: bandhavgarh-national-park-tour-package | india-wildlife-tour | rajaji-national-park-tour | sariska-tour', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'delhi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | nageshwar-somnath-jyotirlinga-tour-package', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dwarka'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | nageshwar-somnath-jyotirlinga-tour-package', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dwarka'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: darjeeling-gangtok-kalimpong-tour-package | darjeeling-gangtok-pelling-tour-package | darjeeling-sikkim-tour-package | north-sikkim-tour', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gangtok'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: darjeeling-gangtok-kalimpong-tour-package | darjeeling-gangtok-pelling-tour-package | darjeeling-sikkim-tour-package | north-sikkim-tour', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gangtok'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | mahakaleshwar-omkareshwar-jyotirlinga-tour-package', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'indore'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: best-of-western-hill-tour | lonavala-khandala-tour-package | lonavala-tour | maharashtra-tour', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'lonavala'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: best-of-western-hill-tour | lonavala-khandala-tour-package | lonavala-tour | maharashtra-tour', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'lonavala'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: char-dham-yatra-in-india | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | shirdi-tour-package', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mumbai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: badrinath-kedarnath-yatra | badrinath-yatra | delhi-to-haridwar-rishikesh-tour-package | nau-devi-yatra', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'rishikesh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: badrinath-kedarnath-yatra | badrinath-yatra | delhi-to-haridwar-rishikesh-tour-package | nau-devi-yatra', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'rishikesh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_tour_theme', 'our tours: brahmpuri-river-rafting-package | kaudiyala-river-rafting-package | marine-drive-river-rafting-package | shivpuri-river-rafting-package', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'rishikesh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: himachal-tour-package-for-couple | kullu-manali-tour-package-from-mumbai | oberoi-cecil-shimla-packages | shimla-tour-package-from-delhi-for-couples', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'shimla'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: himachal-tour-package-for-couple | kullu-manali-tour-package-from-mumbai | oberoi-cecil-shimla-packages | shimla-tour-package-from-delhi-for-couples', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'shimla'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: charismatic-kashmir-tour | kashmir-tour-package-from-ahmedabad | kashmir-tour-package-from-kolkata | kashmir-tour-packages-from-mumbai', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srinagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: charismatic-kashmir-tour | kashmir-tour-package-from-ahmedabad | kashmir-tour-package-from-kolkata | kashmir-tour-packages-from-mumbai', 4, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srinagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: kerala-honeymoon-holidays | kerala-honeymoon-tour | kerala-honeymoon-tour-packages', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'alleppey'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'wti_tour_theme', 'our tours: kerala-honeymoon-holidays | kerala-honeymoon-tour | kerala-honeymoon-tour-packages', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'alleppey'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: golden-temple-tour | golden-temple-tour-amritsar | gurudwara-in-punjab-tour', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'amritsar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: golden-temple-tour | golden-temple-tour-amritsar | gurudwara-in-punjab-tour', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'amritsar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: ayodhya-tour-package | cmq0siymm00g5nrpujtwpr6d4 | sapta-puri-yatra', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ayodhya'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: bangalore-mysore-coorg-tour-package | bangalore-mysore-ooty-coorg-tour-package | bangalore-mysore-ooty-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bangalore'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: golden-temple-tour-amritsar | gurudwara-in-punjab-tour | nau-devi-yatra', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chandigarh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: kerala-honeymoon-holidays | kerala-honeymoon-tour | kerala-honeymoon-tour-packages', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'cochin'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'wti_tour_theme', 'our tours: kerala-honeymoon-holidays | kerala-honeymoon-tour | kerala-honeymoon-tour-packages', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'cochin'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: darjeeling-gangtok-kalimpong-tour-package | darjeeling-gangtok-pelling-tour-package | darjeeling-sikkim-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'darjeeling'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: darjeeling-gangtok-kalimpong-tour-package | darjeeling-gangtok-pelling-tour-package | darjeeling-sikkim-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'darjeeling'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: dalhousie-khajjiar-dharamshala-tour | kumaon-tour | ranikhet-hill-tour', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'delhi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'delhi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'deoghar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: baidyanath-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'deoghar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kashmir-tour-package-from-ahmedabad | kashmir-tour-package-from-kolkata | kashmir-tour-packages-from-mumbai', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gulmarg'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: kashmir-tour-package-from-ahmedabad | kashmir-tour-package-from-kolkata | kashmir-tour-packages-from-mumbai', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gulmarg'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'guptkashi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'haridwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'haridwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'hyderabad'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | sapta-puri-yatra', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'indore'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'gateway', 'wti_tour_theme', 'our tours: jaipur-sariska-jungle-tour | rajasthan-wildlife-tour | ranthambore-jaipur-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jaipur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kashmir-ladakh-tour-package | leh-ladakh-road-trip | srinagar-leh-ladakh-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kargil'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: golden-triangle-khajuraho-dance-festival-tour | golden-triangle-tour-with-khajuraho | golden-triangle-tour-with-varanasi-and-khajuraho', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'khajuraho'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: golden-triangle-khajuraho-dance-festival-tour | golden-triangle-tour-with-khajuraho | golden-triangle-tour-with-varanasi-and-khajuraho', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'khajuraho'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: kerala-honeymoon-holidays | kerala-honeymoon-tour | kerala-honeymoon-tour-packages', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kumarakom'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'wti_tour_theme', 'our tours: kerala-honeymoon-holidays | kerala-honeymoon-tour | kerala-honeymoon-tour-packages', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kumarakom'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'madurai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: best-of-western-hill-tour | mahabaleshwar-tour | maharashtra-tour', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mahabaleshwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: best-of-western-hill-tour | mahabaleshwar-tour | maharashtra-tour', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mahabaleshwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: himachal-tour-package-for-couple | kullu-manali-tour-package-from-mumbai | shimla-tour-package-from-delhi-for-couples', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'manali'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: himachal-tour-package-for-couple | kullu-manali-tour-package-from-mumbai | shimla-tour-package-from-delhi-for-couples', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'manali'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'gateway', 'wti_tour_theme', 'our tours: mumbai-goa-beach-tour | mumbai-goa-tour | mumbai-goa-tour-packages', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mumbai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: kerala-honeymoon-holidays | kerala-honeymoon-tour | kerala-honeymoon-tour-packages', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'munnar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: bangalore-mysore-coorg-tour-package | bangalore-mysore-ooty-coorg-tour-package | bangalore-mysore-ooty-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mysore'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: bangalore-mysore-coorg-tour-package | bangalore-mysore-ooty-coorg-tour-package | bangalore-mysore-ooty-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mysore'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: leh-ladakh-road-trip | manali-to-leh-tour | srinagar-leh-ladakh-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nubra valley'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: leh-ladakh-road-trip | manali-to-leh-tour | srinagar-leh-ladakh-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nubra valley'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kashmir-tour-package-from-ahmedabad | kashmir-tour-package-from-kolkata | kashmir-tour-packages-from-mumbai', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pahalgam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: kashmir-tour-package-from-ahmedabad | kashmir-tour-package-from-kolkata | kashmir-tour-packages-from-mumbai', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pahalgam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: char-dham-yatra-in-india | orissa-golden-triangle-tour | orissa-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'puri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'wti_tour_theme', 'our tours: char-dham-yatra-in-india | orissa-golden-triangle-tour | orissa-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'puri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: delhi-agra-jaipur-udaipur-tour-package | golden-triangle-tour-with-pushkar | golden-triangle-tour-with-udaipur', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pushkar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: delhi-agra-jaipur-udaipur-tour-package | golden-triangle-tour-with-pushkar | golden-triangle-tour-with-udaipur', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pushkar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'rameshwaram'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: ranthambore-jaipur-package | ranthambore-package | ranthambore-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'sawai madhopur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kashmir-ladakh-tour-package | leh-ladakh-road-trip | srinagar-leh-ladakh-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srinagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: kashmir-ladakh-tour-package | leh-ladakh-road-trip | srinagar-leh-ladakh-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srinagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: amarnath-yatra | amarnath-yatra-helicopter-services | chardham-yatra-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srinagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: amarnath-yatra | amarnath-yatra-helicopter-services | chardham-yatra-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srinagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srisailam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g | mallikarjuna-jyotirlinga-tour-package', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srisailam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'varanasi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package | cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 3, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'varanasi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'gateway', 'wti_tour_theme', 'our tours: india-wildlife-tour | rajasthan-wildlife-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'agra'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: best-of-kumaon-hill-tour | ranikhet-hill-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'almora'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_tour_theme', 'our tours: neelkanth-base-camp-trek | satopanth-trek', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'badrinath'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: banerghatta-national-park-tour | karnataka-heritage-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bangalore'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: bharatpur-bird-sanctuary-tour | rajasthan-wildlife-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bharatpur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: orissa-golden-triangle-tour | orissa-tour-package', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bhubaneshwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'wti_tour_theme', 'our tours: rann-of-kutch-festival-packages | rann-of-kutch-tour-package', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bhuj'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_tour_theme', 'our tours: chopta-chandrashila-trek | panch-kedar-trek', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chopta'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: munnar-ooty-kodaikanal-tour-package | ooty-kodaikanal-munnar-tour-package', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'cochin'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: bangalore-mysore-coorg-tour-package | bangalore-mysore-ooty-coorg-tour-package', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'coorg'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 2, 'core', 'wti_tour_theme', 'our tours: bangalore-mysore-coorg-tour-package | bangalore-mysore-ooty-coorg-tour-package', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'coorg'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dehradun'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_tour_theme', 'our tours: har-ki-doon-trek | kedarkantha-trek', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dehradun'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dehradun'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: dalhousie-dharamshala-package | dharamshala-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dharamsala'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 2, 'core', 'wti_tour_theme', 'our tours: dalhousie-dharamshala-package | dharamshala-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dharamsala'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: char-dham-yatra-by-helicopter-from-dehradun | chardham-yatra-tour-package', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gangotri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: golden-triangle-tour-with-goa | golden-triangle-tour-with-goa-beach', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'goa'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: golden-triangle-tour-with-goa | golden-triangle-tour-with-goa-beach', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'goa'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_tour_theme', 'our tours: chanap-valley-trek | kagbhusandi-lake-trek', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'govindghat'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kashmir-ladakh-tour-package | srinagar-leh-ladakh-tour-package', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gulmarg'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: kashmir-ladakh-tour-package | srinagar-leh-ladakh-tour-package', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gulmarg'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_tour_theme', 'our tours: kedarnath-and-vasuki-taal-trek | panch-kedar-trek', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'guptkashi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: assam-tour-package | guwahati-shillong-cherrapunjee-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'guwahati'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'hyderabad'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'gateway', 'wti_tour_theme', 'our tours: bandhavgarh-wildlife-safari-tour-from-bangalore | bandhavgarh-wildlife-safari-tour-from-pune', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'indore'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_tour_theme', 'our tours: kuari-pass-trekking | panch-kedar-trek', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'joshimath'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: coorg-kabini-tour-package | karnataka-heritage-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kabini'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: darjeeling-gangtok-kalimpong-tour-package | darjeeling-sikkim-tour-package', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kalimpong'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: sapta-puri-yatra | tirupati-tour-package-from-chennai', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kanchipuram'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'wti_tour_theme', 'our tours: sapta-puri-yatra | tirupati-tour-package-from-chennai', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kanchipuram'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: india-wildlife-tour | kanha-national-park-tour-package', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kanha'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: madurai-rameshwaram-kanyakumari-tour-package | south-india-temple-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kanyakumari'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'wti_tour_theme', 'our tours: madurai-rameshwaram-kanyakumari-tour-package | south-india-temple-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kanyakumari'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: leh-ladakh-road-trip-by-car | srinagar-to-leh-tour-package', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kargil'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_tour_theme', 'our tours: kedarnath-and-vasuki-taal-trek | panch-kedar-trek', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kedarnath'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: kerala-honeymoon-holidays | kerala-honeymoon-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kovalam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: buddha-tour | cmlt9zi3m0001nrrni0ji4ow9', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'lucknow'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'wti_tour_theme', 'our tours: rann-of-kutch-festival-packages | rann-of-kutch-tour-package', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mandvi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'wti_tour_theme', 'our tours: rann-of-kutch-festival-packages | rann-of-kutch-tour-package', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mandvi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'gateway', 'wti_tour_theme', 'our tours: golden-triangle-tour-with-mumbai | golden-triangle-with-mumbai-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mumbai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mumbai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: hills-of-uttarakhand-package | mussoorie-hill-station-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mussoorie'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'gateway', 'wti_tour_theme', 'our tours: coorg-kabini-tour-package | karnataka-heritage-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mysore'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'gateway', 'wti_tour_theme', 'our tours: corbett-nainital-package | jim-corbett-park-with-nainital-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nainital'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: ladakh-tour | leh-ladakh-road-trip-by-car', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nubra valley'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: ladakh-tour | leh-ladakh-road-trip-by-car', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nubra valley'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: amarnath-yatra | amarnath-yatra-by-helicopter', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pahalgam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: amarnath-yatra | amarnath-yatra-by-helicopter', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pahalgam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pune'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: lonavala-khandala-tour-package | maharashtra-tour', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pune'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: cmpnsn47y00aunrpupvn4459c | cmpnzeuyx00bknrpu2c14qx6g', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pune'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: badrinath-kedarnath-yatra | char-dham-yatra-in-india', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'rudraprayag'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: kerala-honeymoon-holidays | kerala-honeymoon-tour-packages', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'thekkady'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: tirupati-package-tour | tirupati-tour-package-from-chennai', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'tirupati'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'wti_tour_theme', 'our tours: tirupati-package-tour | tirupati-tour-package-from-chennai', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'tirupati'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: delhi-agra-jaipur-udaipur-tour-package | golden-triangle-tour-with-udaipur', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'udaipur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: delhi-agra-jaipur-udaipur-tour-package | golden-triangle-tour-with-udaipur', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'udaipur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_tour_theme', 'our tours: chopta-chandrashila-trek | panch-kedar-trek', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ukhimath'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: golden-triangle-tour-with-varanasi | golden-triangle-tour-with-varanasi-and-khajuraho', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'varanasi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: golden-triangle-tour-with-varanasi | golden-triangle-tour-with-varanasi-and-khajuraho', 2, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'varanasi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'wti_tour_theme', 'our tours: lakshadweep-island-trip', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'agatti island'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'gateway', 'wti_tour_theme', 'our tours: classic-india-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'agra'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'gateway', 'wti_tour_theme', 'our tours: elephant-festival-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'agra'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: north-india-heritage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'agra'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: muslim-pilgrimage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'agra'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: rann-of-kutch-festival-packages', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ahmedabad'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: char-dham-yatra-in-india', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ahmedabad'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: incredible-ladakh-holiday', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'alchi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: majestic-ladakh-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'alchi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: kerala-hill-station-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'alleppey'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: amritsar-dalhousie-dharamshala-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'amritsar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'aurangabad'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: maharashtra-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'aurangabad'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: karnataka-temple-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bangalore'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'wti_tour_theme', 'our tours: lakshadweep-island-trip', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bangaram island'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: golden-triangle-tour-with-tiger-safari', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bharatpur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: mani-mahesh-yatra-by-helicopter', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bharmour'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: gujarat-wildlife-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bhavnagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: bhopal-sanchi-bhimbetka-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bhimbetka'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: bhopal-sanchi-bhimbetka-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bhopal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'gateway', 'wti_tour_theme', 'our tours: bandhavgarh-wildlife-safari-tour-from-ahmedabad', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bhopal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'gateway', 'wti_tour_theme', 'our tours: orissa-trip', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bhubaneshwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kumaon-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'binsar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 2, 'core', 'wti_tour_theme', 'our tours: kumaon-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'binsar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: buddha-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bodh gaya'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'wti_tour_theme', 'our tours: buddha-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bodh gaya'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: hills-of-uttarakhand-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chamba'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: navagraha-temple-tour-package-from-chennai', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chidambaram'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'wti_tour_theme', 'our tours: navagraha-temple-tour-package-from-chennai', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chidambaram'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: north-sikkim-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chopta valley'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'gateway', 'wti_tour_theme', 'our tours: thattekad-thekkady-sanctuary-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'cochin'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: bangalore-mysore-ooty-coorg-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'coonoor'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: coorg-kabini-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'coorg'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'gateway', 'wti_tour_theme', 'our tours: golden-triangle-tour-with-jim-corbett-national-park', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'corbett'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: corbett-jeep-safari-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'corbett'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: amritsar-dalhousie-dharamshala-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dalhousie'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: amritsar-dalhousie-dharamshala-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dalhousie'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: mani-mahesh-yatra-by-helicopter', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dalhousie'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: eastern-triangle-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'darjeeling'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: hills-of-uttarakhand-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dehradun'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'gateway', 'wti_tour_theme', 'our tours: elephant-festival-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'delhi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'gateway', 'wti_tour_theme', 'our tours: classic-india-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'delhi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: north-india-heritage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'delhi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: north-india-heritage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'delhi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_tour_theme', 'our tours: gangotri-gaumukh-tapovan-trek', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gangotri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: eastern-triangle-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gangtok'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: eastern-triangle-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gangtok'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: gujarat-wildlife-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gir'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'wti_tour_theme', 'our tours: goa-carnival-festival-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'goa'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: goa-carnival-festival-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'goa'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: karnataka-temple-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gokarna'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: dwarka-somnath-package-from-delhi', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gondal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kashmir-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gulmarg'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: kashmir-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gulmarg'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'gateway', 'wti_tour_theme', 'our tours: kaziranga-wildlife-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'guwahati'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: golden-triangle-tour-with-varanasi-and-khajuraho', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gwalior'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: golden-triangle-tour-with-varanasi-and-khajuraho', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gwalior'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'gateway', 'wti_tour_theme', 'our tours: golden-triangle-tour-with-haridwar', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'haridwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'gateway', 'wti_tour_theme', 'our tours: dodital-darwa-pass-trek', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'haridwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: karnataka-heritage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'hassan'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: muslim-pilgrimage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jaipur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: jaipur-tour-package-for-couples', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jaipur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: jaipur-tour-package-for-couples', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jaipur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'wti_tour_theme', 'our tours: classic-india-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jaipur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'wti_tour_theme', 'our tours: elephant-festival-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jaipur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: north-india-heritage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jaipur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: north-india-heritage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jaipur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: nageshwar-somnath-jyotirlinga-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jamnagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: dwarka-somnath-package-from-delhi', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jamnagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: jhansi-orchha-khajuraho-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jhansi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'wti_tour_theme', 'our tours: assam-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'jorhat'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: badrinath-yatra', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'joshimath'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: eastern-triangle-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kalimpong'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 2, 'core', 'wti_tour_theme', 'our tours: eastern-triangle-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kalimpong'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'gateway', 'wti_tour_theme', 'our tours: golden-triangle-with-tiger-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kanha'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: kerala-honeymoon-holidays', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kanyakumari'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'wti_tour_theme', 'our tours: kerala-honeymoon-holidays', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kanyakumari'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: nainital-almora-kausani-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kasauni'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: nainital-almora-kausani-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kasauni'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: muktinath-yatra', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kathmandu'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: nau-devi-yatra', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'katra'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: assam-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kaziranga'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: kaziranga-wildlife-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kaziranga'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: chardham-yatra-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kedarnath'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'wti_tour_theme', 'our tours: classic-india-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'khajuraho'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: north-india-heritage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'khajuraho'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: north-india-heritage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'khajuraho'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: jhansi-orchha-khajuraho-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'khajuraho'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: jhansi-orchha-khajuraho-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'khajuraho'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: khandala-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'khandala'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: buddha-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kolkata'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: sundarbans-national-park-tour-packages', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kolkata'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kullu-manali-tour-package-from-mumbai', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kullu'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: kullu-manali-tour-package-from-mumbai', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kullu'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: navagraha-temple-tour-package-from-chennai', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kumbakonam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'wti_tour_theme', 'our tours: navagraha-temple-tour-package-from-chennai', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kumbakonam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: ladakh-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ladakh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: ladakh-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ladakh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: leh-ladakh-tour-package-for-couples', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'leh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: leh-ladakh-tour-package-for-couples', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'leh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_tour_theme', 'our tours: markha-valley-trek', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'leh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: cmlt9zi3m0001nrrni0ji4ow9', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'lucknow'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: south-india-hill-station-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'madurai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: tamil-nadu-temples-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mahabalipuram'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'wti_tour_theme', 'our tours: tamil-nadu-temples-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mahabalipuram'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: manali-tour-package-for-couples-from-delhi', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'manali'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: manali-to-leh-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'manali'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: manali-to-leh-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'manali'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: sapta-puri-yatra', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mathura'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: sapta-puri-yatra', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mathura'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'gateway', 'wti_tour_theme', 'our tours: goa-carnival-festival-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mumbai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: eravikulam-national-park-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'munnar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme', 'our tours: eravikulam-national-park-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'munnar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'gateway', 'wti_tour_theme', 'our tours: haridwar-mussoorie-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mussoorie'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: mussoorie-tour-package-for-couples', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mussoorie'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'wti_tour_theme', 'our tours: rann-of-kutch-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nakhtrana'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: maharashtra-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nasik'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nasik'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: north-india-heritage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'orchha'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: north-india-heritage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'orchha'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kashmir-ladakh-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pahalgam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: kashmir-ladakh-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pahalgam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: kashmir-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pahalgam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: kashmir-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pahalgam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: ladakh-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pangong tso'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: dalhousie-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pathankot'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: 12-jyotirlinga-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'patna'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: buddha-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'patna'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: dwarka-somnath-package-from-delhi', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'porbandar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: andaman-nicobar-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'port blair'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: andaman-tour-package-for-couples', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'port blair'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'wti_tour_theme', 'our tours: puri-holiday-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'puri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'gateway', 'wti_tour_theme', 'our tours: golden-triangle-tour-with-haridwar', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'rishikesh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'gateway', 'wti_tour_theme', 'our tours: hills-of-uttarakhand-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'rishikesh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: bhopal-sanchi-bhimbetka-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'sanchi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 2, 'core', 'wti_tour_theme', 'our tours: bhopal-sanchi-bhimbetka-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'sanchi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: guwahati-shillong-cherrapunjee-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'shillong'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme', 'our tours: manali-tour-package-for-couples-from-delhi', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'shimla'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: srisailam-wildlife-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srisailam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: arupadai-veedu-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'swamimalai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_tour_theme', 'our tours: thattekad-thekkady-sanctuary-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'thekkady'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: karnataka-temple-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'udupi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'wti_tour_theme', 'our tours: karnataka-temple-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'udupi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'gateway', 'wti_tour_theme', 'our tours: golden-triangle-with-tiger-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'umaria'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: chardham-yatra-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'uttarkashi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_tour_theme', 'our tours: dodital-darwa-pass-trek', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'uttarkashi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'wti_tour_theme', 'our tours: classic-india-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'varanasi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_tour_theme', 'our tours: north-india-heritage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'varanasi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_tour_theme', 'our tours: north-india-heritage-tour', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'varanasi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_tour_theme', 'our tours: chardham-yatra-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'yamunotri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme', 'our tours: darjeeling-sikkim-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'yuksom'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_tour_theme', 'our tours: darjeeling-sikkim-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM stay_nodes WHERE lower(name) = 'yuksom'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;

-- ============ 4b. SHEET 4 — TOWNS IN OUR TOURS THAT HAD NO THEME. FOUNDER-TICKED. ============
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'founder_edit', 'founder tick (YES); PROPOSED from the town name. NOT from our data. Please check.', 15, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'fatehpur sikri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'founder_edit', 'founder tick (YES); PROPOSED from the town name. NOT from our data. Please check.', 15, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'fatehpur sikri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_edit', 'founder tick (YES); PROPOSED from the town name. NOT from our data. Please check.', 10, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ajmer'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'founder_edit', 'founder tick (YES); PROPOSED from the town name. NOT from our data. Please check.', 10, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ajmer'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 9, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'trivandrum'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 9, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'trivandrum'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'founder_edit', 'founder tick (EDIT); PROPOSED from the town name. NOT from our data. Please check.', 8, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bandavgarh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 7, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'khardung la'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 7, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ram nagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (YES); PROPOSED from the town name. NOT from our data. Please check.', 5, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kufri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 4, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ahmadnagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (YES); PROPOSED from the town name. NOT from our data. Please check.', 3, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chail'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'founder_edit', 'founder tick (EDIT); PROPOSED from the town name. NOT from our data. Please check.', 3, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ranthambhore'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'founder_edit', 'founder tick (YES); PROPOSED from the town name. NOT from our data. Please check.', 2, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ellora'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'founder_edit', 'founder tick (YES); PROPOSED from the town name. NOT from our data. Please check.', 2, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ellora'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 2, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'golaghat'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 2, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'shey'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'agatti'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'alibag'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'alibag'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'alwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'alwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'amarkantak'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'amarkantak'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); PROPOSED from the town name. NOT from our data. Please check.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'araku valley hill station'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 2, 'core', 'founder_edit', 'founder tick (EDIT); PROPOSED from the town name. NOT from our data. Please check.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'araku valley hill station'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'aritar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bekal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bekal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chikmangalur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'hemis'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'karla caves'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mcleodganj'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mcleodganj'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'murudeshwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'murudeshwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'omkareshwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'omkareshwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'palani'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'palani'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'puttaparthy'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'sarnath'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'sarnath'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'shiridi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'sibsagar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'sundarbans'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'thattekad'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'thiruvannamalai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'thiruvannamalai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 1, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'tiruchendur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bhandardara'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dapoli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dapoli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'haflong'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); CHIP CORRECTED to the verified fact recorded in the workbook: Maharashtra (Nashik dist.) · Hill Stations & Mountains (primary); Spiritual/Vipassana secondary', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'igatpuri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'founder_edit', 'founder tick (EDIT); CHIP CORRECTED to the verified fact recorded in the workbook: Maharashtra (Nashik dist.) · Hill Stations & Mountains (primary); Spiritual/Vipassana secondary', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'igatpuri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'founder_edit', 'founder tick (EDIT); CHIP CORRECTED to the verified fact recorded in the workbook: Chhattisgarh · Heritage & Forts / Pilgrimage (NOT Wildlife)', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'janjgir'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 2, 'core', 'founder_edit', 'founder tick (EDIT); CHIP CORRECTED to the verified fact recorded in the workbook: Chhattisgarh · Heritage & Forts / Pilgrimage (NOT Wildlife)', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'janjgir'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'junagadh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'junagadh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kohima'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kollam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kollam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'konark'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'konark'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kotagiri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kotagiri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kurseong'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Honeymoon & Romance', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kurseong'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'malvan'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'malvan'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pauri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pithoragarh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pithoragarh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ranikhet'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ranikhet'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srikalahasti'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'tarkarli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'tarkarli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'thanjavur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'thanjavur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'thrissur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'thrissur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'veraval'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'founder_edit', 'founder tick (EDIT); NO PROPOSAL — I do not know this town. Please tell me.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'veraval'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;

-- ============ 4c. SHEET 6 — 89 TOWNS WE HAVE A GUIDE PAGE FOR. ============
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/abbott-mount', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'abbott mount'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/agumbe', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'agumbe'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/amarnath', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'amarnath'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/amarnath', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'amarnath'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/amboli', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'amboli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/amboli', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'amboli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/araku-valley', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'araku valley'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/araku-valley', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'araku valley'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/circuit-arupadai-veedu', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'arupadai veedu temple circuit'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/auli', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'auli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/auli', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'auli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/auroville', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'auroville'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/auroville', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'auroville'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/avantipur', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'avantipur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/badami-aihole-pattadakal', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'badami aihole pattadakal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/badami-aihole-pattadakal', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'badami aihole pattadakal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/bellikkal', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bellikkal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/bellikkal', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bellikkal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/bhalukpong', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'bhalukpong'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/billing', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'billing'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/billing', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'billing'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/champhai', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'champhai'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/chikhaldara', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chikhaldara'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/chitharal', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chitharal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/chitharal', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chitharal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/chitrakoot', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chitrakoot'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/chopta-valley', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chopta valley'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/daman', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'daman'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/dantewada', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dantewada'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/devikulam', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'devikulam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/devikulam', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'devikulam'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/dhauli', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dhauli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/dhauli', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'dhauli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/girnar', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'girnar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/girnar', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'girnar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/gushaini-village', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'gushaini village'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/halebid', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'halebid'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/harsil', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'harsil'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/illithode', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'illithode'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/kalady', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kalady'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/kamshet', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kamshet'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/kamshet', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kamshet'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/kasauli', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kasauli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/khimsar', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'khimsar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/khodala', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'khodala'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/kotgarh', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kotgarh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/kurukshetra', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kurukshetra'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/kurukshetra', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kurukshetra'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/kutch', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kutch'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/kutch', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'kutch'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/lachung', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'lachung'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/lakkidi', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'lakkidi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/lansdowne', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'lansdowne'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/majuli', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'majuli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/majuli', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'majuli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/malampuzha', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'malampuzha'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/mamit', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mamit'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/marigaon', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'marigaon'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/mashobra', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mashobra'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/matheran', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'matheran'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/matheran', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'matheran'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/mirik', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mirik'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/mori', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mori'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/mori', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mori'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/morni', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'morni'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/mukteshwar', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'mukteshwar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/munsiyari', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'munsiyari'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/munsiyari', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'munsiyari'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/nalanda', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nalanda'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/nalanda', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nalanda'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/nalgonda', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nalgonda'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/circuit-navagraha', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'navagraha temple circuit'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/nelliyampathy', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'nelliyampathy'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/netrani-island', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'netrani island'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/palampur', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'palampur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/panhala', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'panhala'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/panhala', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'panhala'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/patnitop', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'patnitop'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/pattadakal', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pattadakal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/pavagarh', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pavagarh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/pavagarh', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pavagarh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/pawapuri', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pawapuri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/payyoli', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'payyoli'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/pelling', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pelling'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/pelling', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pelling'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/periyar', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'periyar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/periyar', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'periyar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/phawngpui', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'phawngpui'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/pondicherry', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pondicherry'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/pondicherry', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'pondicherry'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/ponmudi', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ponmudi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/ramgarh', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ramgarh'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/rayadurg', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'rayadurg'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/sangla', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'sangla'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/sangla', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'sangla'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/saputara', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'saputara'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/sariska', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'sariska'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/sariska', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'sariska'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/shoghi', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'shoghi'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/somnath', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'somnath'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Beaches', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/somnath', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'somnath'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/srirangapatna', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srirangapatna'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/srirangapatna', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'srirangapatna'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/tawang', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'tawang'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/tawang', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'tawang'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/thanedar', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'thanedar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/thiruvilwamala', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'thiruvilwamala'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/toranmal', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'toranmal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/trichy', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'trichy'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/trichy', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'trichy'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/vagamon', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'vagamon'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/vaishali', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'vaishali'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/vaishali', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'vaishali'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Heritage & Forts', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/warangal', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'warangal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/yelagiri', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'yelagiri'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/yercaud', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'yercaud'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/yumthang', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'yumthang'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/zanskar', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'zanskar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/zanskar', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'zanskar'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 1, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/ziro', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ziro'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_guide_page', 'our own guide page: waytoindia.com/ziro', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name) = 'ziro'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;

-- ============ 4d. SHEET 7 — THE TOWNS THAT WERE IN NO TABLE AT ALL. ============
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_added', 'founder named it: Not in our system AT ALL — no node, no guide page. You named it.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'naimisharanya'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_added', 'founder named it: We hold it under the OLD NAME "Allahabad". Needs renaming + an alias.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'prayagraj'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Culture & Festivals', 2, 'core', 'founder_added', 'founder named it: We hold it under the OLD NAME "Allahabad". Needs renaming + an alias.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'prayagraj'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_added', 'founder named it: Guide page exists (sheet 6) but the planner cannot use it.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'chitrakoot'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_added', 'founder named it: Not in our system. Shakti Peeth near Mirzapur.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'vindhyachal'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Pilgrimage', 1, 'core', 'founder_added', 'founder named it: Appears in our ROAD CACHE but is not a node. Ramayana site.', 0, 'tier2_founder', 'founder'
    FROM stay_nodes WHERE lower(name) = 'shringverpur'
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = CASE WHEN intent_place.role = 'core' OR EXCLUDED.role = 'core' THEN 'core' ELSE 'gateway' END,
    tour_count = GREATEST(intent_place.tour_count, EXCLUDED.tour_count),
    evidence = intent_place.evidence || ' ;; ' || EXCLUDED.evidence;

-- SKIPPED, AND NOT INVENTED: Bellikkal, Illithode -- the workbook carries no coordinates for these two.
-- A town we cannot place on the map cannot be put in a route. Reported to the founder.

COMMIT;
