-- US-830 (4e) — SHEET 5: the 54 tours that had NEVER been given a theme.
-- The founder tagged 53 of them. Tag a TOUR and every TOWN inside it lights up.
-- The join nobody ever made: tour_stays.tourId -> tour, tour_stays.wtiCityId -> stay_nodes.id
BEGIN;

-- 12-jyotirlinga-tour-package-from-delhi -> Pilgrimage
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Pilgrimage', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || '12-jyotirlinga-tour-package-from-delhi', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = '12-jyotirlinga-tour-package-from-delhi' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'12-jyotirlinga-tour-package-from-delhi'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- 12-jyotirlinga-tour-package-from-mumbai -> Pilgrimage
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Pilgrimage', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || '12-jyotirlinga-tour-package-from-mumbai', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = '12-jyotirlinga-tour-package-from-mumbai' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'12-jyotirlinga-tour-package-from-mumbai'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- bandhavgarh-national-park-tour-packages -> Wildlife & Nature
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Wildlife & Nature', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'bandhavgarh-national-park-tour-packages', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'bandhavgarh-national-park-tour-packages' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'bandhavgarh-national-park-tour-packages'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- beach-honeymoon-tour-resort -> Beaches
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Beaches', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'beach-honeymoon-tour-resort', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'beach-honeymoon-tour-resort' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'beach-honeymoon-tour-resort'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- beach-honeymoon-tour-resort -> Honeymoon & Romance
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'beach-honeymoon-tour-resort', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'beach-honeymoon-tour-resort' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'beach-honeymoon-tour-resort'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- beaches-of-kerala -> Beaches
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Beaches', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'beaches-of-kerala', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'beaches-of-kerala' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'beaches-of-kerala'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- beaches-of-kerala -> Honeymoon & Romance
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'beaches-of-kerala', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'beaches-of-kerala' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'beaches-of-kerala'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- best-of-kerala -> Wildlife & Nature
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Wildlife & Nature', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'best-of-kerala', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'best-of-kerala' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'best-of-kerala'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- best-of-kerala -> Honeymoon & Romance
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'best-of-kerala', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'best-of-kerala' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'best-of-kerala'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- best-of-leh-ladakh -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'best-of-leh-ladakh', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'best-of-leh-ladakh' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'best-of-leh-ladakh'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- best-of-leh-ladakh -> Trekking & Adventure
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Trekking & Adventure', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'best-of-leh-ladakh', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'best-of-leh-ladakh' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'best-of-leh-ladakh'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- bird-watching-in-jim-corbett-park -> Wildlife & Nature
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Wildlife & Nature', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'bird-watching-in-jim-corbett-park', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'bird-watching-in-jim-corbett-park' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'bird-watching-in-jim-corbett-park'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- delhi-neemrana-tour-package -> Heritage & Forts
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Heritage & Forts', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'delhi-neemrana-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'delhi-neemrana-tour-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'delhi-neemrana-tour-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- dussehra-festival-kullu -> Culture & Festivals
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Culture & Festivals', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'dussehra-festival-kullu', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'dussehra-festival-kullu' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'dussehra-festival-kullu'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- gangaur-festival-jaipur -> Culture & Festivals
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Culture & Festivals', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'gangaur-festival-jaipur', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'gangaur-festival-jaipur' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'gangaur-festival-jaipur'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- golden-triangle-and-khajuraho-dance-festival-tour -> Heritage & Forts
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Heritage & Forts', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'golden-triangle-and-khajuraho-dance-festival-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'golden-triangle-and-khajuraho-dance-festival-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'golden-triangle-and-khajuraho-dance-festival-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- golden-triangle-and-khajuraho-dance-festival-tour -> Culture & Festivals
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Culture & Festivals', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'golden-triangle-and-khajuraho-dance-festival-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'golden-triangle-and-khajuraho-dance-festival-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'golden-triangle-and-khajuraho-dance-festival-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- golden-triangle-with-ranthambore-tour -> Wildlife & Nature
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Wildlife & Nature', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'golden-triangle-with-ranthambore-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'golden-triangle-with-ranthambore-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'golden-triangle-with-ranthambore-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- golden-triangle-with-ranthambore-tour -> Heritage & Forts
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Heritage & Forts', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'golden-triangle-with-ranthambore-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'golden-triangle-with-ranthambore-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'golden-triangle-with-ranthambore-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- honey-moon-in-kerala -> Honeymoon & Romance
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'honey-moon-in-kerala', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'honey-moon-in-kerala' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'honey-moon-in-kerala'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- honey-moon-in-kerala -> Beaches
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Beaches', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'honey-moon-in-kerala', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'honey-moon-in-kerala' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'honey-moon-in-kerala'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- jaisalmer-desert-festival -> Culture & Festivals
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Culture & Festivals', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'jaisalmer-desert-festival', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'jaisalmer-desert-festival' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'jaisalmer-desert-festival'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- jaisalmer-desert-festival -> Heritage & Forts
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Heritage & Forts', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'jaisalmer-desert-festival', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'jaisalmer-desert-festival' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'jaisalmer-desert-festival'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- jaisalmer-desert-festival-tour -> Culture & Festivals
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Culture & Festivals', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'jaisalmer-desert-festival-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'jaisalmer-desert-festival-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'jaisalmer-desert-festival-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- jaisalmer-desert-festival-tour -> Heritage & Forts
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Heritage & Forts', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'jaisalmer-desert-festival-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'jaisalmer-desert-festival-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'jaisalmer-desert-festival-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- jim-corbett-park-weekend-tour-package -> Wildlife & Nature
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Wildlife & Nature', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'jim-corbett-park-weekend-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'jim-corbett-park-weekend-tour-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'jim-corbett-park-weekend-tour-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- kagbhushudi-lake-trek -> Trekking & Adventure
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Trekking & Adventure', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'kagbhushudi-lake-trek', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'kagbhushudi-lake-trek' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'kagbhushudi-lake-trek'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- kagbhushudi-lake-trek -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'kagbhushudi-lake-trek', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'kagbhushudi-lake-trek' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'kagbhushudi-lake-trek'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- kailash-mansarovar-yatra-package -> Pilgrimage
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Pilgrimage', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'kailash-mansarovar-yatra-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'kailash-mansarovar-yatra-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'kailash-mansarovar-yatra-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- kailash-mansarovar-yatra-package -> Trekking & Adventure
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Trekking & Adventure', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'kailash-mansarovar-yatra-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'kailash-mansarovar-yatra-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'kailash-mansarovar-yatra-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- kashmir-ltc-tour -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'kashmir-ltc-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'kashmir-ltc-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'kashmir-ltc-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- kashmir-ltc-tour -> Honeymoon & Romance
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'kashmir-ltc-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'kashmir-ltc-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'kashmir-ltc-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- kaziranga-national-park-tour -> Wildlife & Nature
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Wildlife & Nature', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'kaziranga-national-park-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'kaziranga-national-park-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'kaziranga-national-park-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- kerala-nature-trails -> Wildlife & Nature
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Wildlife & Nature', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'kerala-nature-trails', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'kerala-nature-trails' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'kerala-nature-trails'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- kerala-nature-trails -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'kerala-nature-trails', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'kerala-nature-trails' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'kerala-nature-trails'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- konark-dance-festival -> Culture & Festivals
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Culture & Festivals', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'konark-dance-festival', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'konark-dance-festival' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'konark-dance-festival'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- konkan-holiday-package -> Beaches
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Beaches', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'konkan-holiday-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'konkan-holiday-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'konkan-holiday-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- konkan-holiday-package -> Honeymoon & Romance
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'konkan-holiday-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'konkan-holiday-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'konkan-holiday-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- ladakh-pangong-lake-tour -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'ladakh-pangong-lake-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'ladakh-pangong-lake-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'ladakh-pangong-lake-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- ladakh-pangong-lake-tour -> Trekking & Adventure
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Trekking & Adventure', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'ladakh-pangong-lake-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'ladakh-pangong-lake-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'ladakh-pangong-lake-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- latest-wildlife-tour -> Wildlife & Nature
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Wildlife & Nature', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'latest-wildlife-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'latest-wildlife-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'latest-wildlife-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- leh-ladakh-by-air -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'leh-ladakh-by-air', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'leh-ladakh-by-air' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'leh-ladakh-by-air'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- leh-ladakh-by-air -> Trekking & Adventure
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Trekking & Adventure', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'leh-ladakh-by-air', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'leh-ladakh-by-air' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'leh-ladakh-by-air'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- north-east-vacation -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'north-east-vacation', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'north-east-vacation' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'north-east-vacation'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- north-east-vacation -> Wildlife & Nature
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Wildlife & Nature', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'north-east-vacation', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'north-east-vacation' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'north-east-vacation'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- panna-national-park-tour -> Wildlife & Nature
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Wildlife & Nature', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'panna-national-park-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'panna-national-park-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'panna-national-park-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- pench-national-park-tour -> Wildlife & Nature
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Wildlife & Nature', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'pench-national-park-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'pench-national-park-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'pench-national-park-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- pushkar-camel-fair -> Culture & Festivals
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Culture & Festivals', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'pushkar-camel-fair', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'pushkar-camel-fair' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'pushkar-camel-fair'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- pushkar-camel-fair -> Pilgrimage
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Pilgrimage', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'pushkar-camel-fair', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'pushkar-camel-fair' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'pushkar-camel-fair'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- ranthambore-from-delhi -> Wildlife & Nature
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Wildlife & Nature', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'ranthambore-from-delhi', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'ranthambore-from-delhi' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'ranthambore-from-delhi'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- sikkim-tour-package -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'sikkim-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'sikkim-tour-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'sikkim-tour-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- sikkim-tour-package -> Trekking & Adventure
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Trekking & Adventure', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'sikkim-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'sikkim-tour-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'sikkim-tour-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- srinagar-to-amarnath-helicopter -> Pilgrimage
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Pilgrimage', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'srinagar-to-amarnath-helicopter', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'srinagar-to-amarnath-helicopter' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'srinagar-to-amarnath-helicopter'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- srinagar-to-amarnath-helicopter -> Trekking & Adventure
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Trekking & Adventure', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'srinagar-to-amarnath-helicopter', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'srinagar-to-amarnath-helicopter' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'srinagar-to-amarnath-helicopter'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- the-best-of-kashmir-holiday-package -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'the-best-of-kashmir-holiday-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'the-best-of-kashmir-holiday-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'the-best-of-kashmir-holiday-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- the-best-of-kashmir-holiday-package -> Honeymoon & Romance
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'the-best-of-kashmir-holiday-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'the-best-of-kashmir-holiday-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'the-best-of-kashmir-holiday-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- thrissur-elephant-festival-kerala -> Culture & Festivals
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Culture & Festivals', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'thrissur-elephant-festival-kerala', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'thrissur-elephant-festival-kerala' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'thrissur-elephant-festival-kerala'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- trimbakeshwar-grishneshwar-bhimashankar-jyotirlinga-tour -> Pilgrimage
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Pilgrimage', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'trimbakeshwar-grishneshwar-bhimashankar-jyotirlinga-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'trimbakeshwar-grishneshwar-bhimashankar-jyotirlinga-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'trimbakeshwar-grishneshwar-bhimashankar-jyotirlinga-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- trip-to-dalhousie-from-delhi -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'trip-to-dalhousie-from-delhi', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'trip-to-dalhousie-from-delhi' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'trip-to-dalhousie-from-delhi'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- trip-to-dalhousie-from-delhi -> Honeymoon & Romance
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'trip-to-dalhousie-from-delhi', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'trip-to-dalhousie-from-delhi' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'trip-to-dalhousie-from-delhi'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- trip-to-dehradun -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'trip-to-dehradun', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'trip-to-dehradun' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'trip-to-dehradun'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- trip-to-golden-temple -> Pilgrimage
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Pilgrimage', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'trip-to-golden-temple', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'trip-to-golden-temple' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'trip-to-golden-temple'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- trip-to-shimla -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'trip-to-shimla', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'trip-to-shimla' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'trip-to-shimla'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- trip-to-shimla -> Honeymoon & Romance
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'trip-to-shimla', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'trip-to-shimla' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'trip-to-shimla'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- udaipur-and-mount-abu-tour-package -> Heritage & Forts
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Heritage & Forts', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'udaipur-and-mount-abu-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'udaipur-and-mount-abu-tour-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'udaipur-and-mount-abu-tour-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- udaipur-and-mount-abu-tour-package -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'udaipur-and-mount-abu-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'udaipur-and-mount-abu-tour-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'udaipur-and-mount-abu-tour-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- udaipur-mount-abu-tour -> Heritage & Forts
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Heritage & Forts', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'udaipur-mount-abu-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'udaipur-mount-abu-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'udaipur-mount-abu-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- udaipur-mount-abu-tour -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'udaipur-mount-abu-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'udaipur-mount-abu-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'udaipur-mount-abu-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- udaipur-tour-package -> Heritage & Forts
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Heritage & Forts', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'udaipur-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'udaipur-tour-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'udaipur-tour-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- udaipur-tour-package -> Honeymoon & Romance
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Honeymoon & Romance', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'udaipur-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'udaipur-tour-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'udaipur-tour-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- udaipur-tour-package-for-couples -> Honeymoon & Romance
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Honeymoon & Romance', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'udaipur-tour-package-for-couples', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'udaipur-tour-package-for-couples' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'udaipur-tour-package-for-couples'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- uttarakhand-holidays -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'uttarakhand-holidays', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'uttarakhand-holidays' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'uttarakhand-holidays'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- uttarakhand-holidays -> Pilgrimage
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Pilgrimage', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'uttarakhand-holidays', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'uttarakhand-holidays' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'uttarakhand-holidays'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- uttarakhand-tour-package -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'uttarakhand-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'uttarakhand-tour-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'uttarakhand-tour-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- uttarakhand-tour-package -> Pilgrimage
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Pilgrimage', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'uttarakhand-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'uttarakhand-tour-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'uttarakhand-tour-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- vaishno-devi-yatra -> Pilgrimage
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Pilgrimage', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'vaishno-devi-yatra', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'vaishno-devi-yatra' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'vaishno-devi-yatra'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- valley-of-flowers-trekking-tour -> Trekking & Adventure
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Trekking & Adventure', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'valley-of-flowers-trekking-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'valley-of-flowers-trekking-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'valley-of-flowers-trekking-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- valley-of-flowers-trekking-tour -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'valley-of-flowers-trekking-tour', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'valley-of-flowers-trekking-tour' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'valley-of-flowers-trekking-tour'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- valley-of-uttarakhand-package -> Hill Stations & Mountains
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Hill Stations & Mountains', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'valley-of-uttarakhand-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'valley-of-uttarakhand-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'valley-of-uttarakhand-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- valley-of-uttarakhand-package -> Trekking & Adventure
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Trekking & Adventure', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'valley-of-uttarakhand-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'valley-of-uttarakhand-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'valley-of-uttarakhand-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- varanasi-ayodhya-tour-package -> Pilgrimage
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Pilgrimage', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'varanasi-ayodhya-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'varanasi-ayodhya-tour-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'varanasi-ayodhya-tour-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- varanasi-ayodhya-tour-package -> Culture & Festivals
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Culture & Festivals', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'varanasi-ayodhya-tour-package', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'varanasi-ayodhya-tour-package' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'varanasi-ayodhya-tour-package'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- varanasi-tour-by-air -> Pilgrimage
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Pilgrimage', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'varanasi-tour-by-air', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'varanasi-tour-by-air' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'varanasi-tour-by-air'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- varanasi-tour-by-air -> Culture & Festivals
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Culture & Festivals', 2, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'varanasi-tour-by-air', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'varanasi-tour-by-air' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'varanasi-tour-by-air'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

-- wildlife-safari-near-delhi -> Wildlife & Nature
INSERT INTO intent_place (city_id, chip, rank, role, source, evidence, tour_count, confidence, approved_by)
  SELECT ts."wtiCityId", 'Wildlife & Nature', 1, 'core', 'wti_tour_theme',
         'our own tour, tagged by the founder 14 Jul 2026: ' || 'wildlife-safari-near-delhi', 1, 'tier1_our_tours', 'founder'
    FROM tour_stays ts JOIN tours t ON t.id = ts."tourId"
   WHERE t.slug = 'wildlife-safari-near-delhi' AND ts."wtiCityId" IS NOT NULL
   GROUP BY ts."wtiCityId"
  ON CONFLICT (city_id, chip) DO UPDATE SET
    rank = LEAST(intent_place.rank, EXCLUDED.rank),
    role = 'core',
    evidence = CASE WHEN intent_place.evidence LIKE '%'||'wildlife-safari-near-delhi'||'%' THEN intent_place.evidence
                    ELSE intent_place.evidence || ' ;; ' || EXCLUDED.evidence END;

COMMIT;
