-- US-830 — the two towns the workbook had no coordinates for.
-- The founder supplied them by hand, 14 July 2026. Not derived. Not invented. Given.
BEGIN;

INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
VALUES ('wtiidx_' || md5('bellikkal'), 'Bellikkal', 11.4833, 76.7000, 'Tamil Nadu', '25', 0, 'wti_theme_index', now(), 'founder', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO stay_nodes (id, name, lat, lng, state_name, admin1_code, tour_count, source_kind, fetched_at, verified_by, verified_at)
VALUES ('wtiidx_' || md5('illithode'), 'Illithode', 10.20221, 76.52927, 'Kerala', '13', 0, 'wti_theme_index', now(), 'founder', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Hill Stations & Mountains', 1, 'core', 'wti_guide_page',
         'our own guide page: waytoindia.com/bellikkal ;; coordinates given by the founder by hand, 14 Jul 2026', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name)='bellikkal' ON CONFLICT (city_id, chip) DO NOTHING;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Trekking & Adventure', 2, 'core', 'wti_guide_page',
         'our own guide page: waytoindia.com/bellikkal ;; coordinates given by the founder by hand, 14 Jul 2026', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name)='bellikkal' ON CONFLICT (city_id, chip) DO NOTHING;
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT id, 'Wildlife & Nature', 1, 'core', 'wti_guide_page',
         'our own guide page: waytoindia.com/illithode ;; coordinates given by the founder by hand (Malayattoor forests), 14 Jul 2026', 0, 'tier3_our_guide', 'founder'
    FROM stay_nodes WHERE lower(name)='illithode' ON CONFLICT (city_id, chip) DO NOTHING;

COMMIT;
