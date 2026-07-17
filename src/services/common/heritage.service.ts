/**
 * HERITAGE COLLECTIONS ENGINE — founder-created collections of places
 * ("Forts of India", "Ramayana Sites", ...) with GOLD content per site and
 * tours attached automatically by geography.
 *
 * The engine is the SAME deterministic traversal as the UNESCO and Sacred layers
 * (scripts/sacred-seed.ts): a tour reaches a site when a stop it sleeps at is
 * within a distance tier of the site. in_city <= 12 km, short_drive <= 35 km,
 * day_trip <= 65 km. NO MODEL, pure SQL + haversine. A site without verified
 * coordinates attaches nothing (fail closed).
 *
 * Geocoding iron law: A NAME IS NOT A KEY. Towns resolve from OUR gazetteer
 * (stay_nodes first, then world_cities, India first) and the admin eye-verifies.
 *
 * Public reads FAIL CLOSED and NON-FATAL: a missing table or bad row returns an
 * empty result, never a 500.
 */
import prisma from '@/config/db';
import { haversineKm } from '@/services/route-optimizer/geo';

export const SITE_BASE_URL = 'https://waytoindia.com';

const IN_CITY_KM = 12, SHORT_DRIVE_KM = 35, DAY_TRIP_KM = 65;
export type Tier = 'in_city' | 'short_drive' | 'day_trip';
const TIER_RANK: Record<Tier, number> = { in_city: 0, short_drive: 1, day_trip: 2 };
const TIER_LABEL: Record<Tier, string> = {
  in_city: 'Where you stay',
  short_drive: 'A short drive away',
  day_trip: 'A day trip away',
};
function tierFor(km: number): Tier | null {
  if (km <= IN_CITY_KM) return 'in_city';
  if (km <= SHORT_DRIVE_KM) return 'short_drive';
  if (km <= DAY_TRIP_KM) return 'day_trip';
  return null;
}

/** deterministic, url-safe slug (same derivation as the UNESCO layer). */
export function heritageSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`.,()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// The GOLD content gate (same law the loader enforces). Drafts may be partial;
// a page can only be MARKED REVIEWED when it fully passes.
// ---------------------------------------------------------------------------
const BAD_CHARS = /[—–“”‘’]/;
const BANNED_PHRASES = [
  'nestled', 'boasts', 'in the heart of', 'a testament to', 'tapestry', 'vibrant',
  'bustling', 'hidden gem', 'stands as', 'whether you are', 'look no further',
  'unleash', 'delve', 'embark', 'treasure trove', 'must visit', 'must-visit',
  'breathtaking', 'stunning', 'awe-inspiring', 'moreover', 'furthermore',
  'in conclusion', 'spellbound', 'feast for the senses', 'something for everyone',
];
const PRICE_PATTERN = /(₹|Rs\.?\s?\d|INR\s?\d)/;

function walkStrings(v: any, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => walkStrings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => walkStrings(x, out));
  return out;
}

export interface GateIssue { kind: string; detail: string }

/** Style gate for any draft; structural minimums only enforced for review. */
export function contentGate(content: any, forReview: boolean): GateIssue[] {
  const issues: GateIssue[] = [];
  if (!content || typeof content !== 'object') {
    return forReview ? [{ kind: 'structure', detail: 'no content' }] : [];
  }
  const sources: string[] = Array.isArray(content.sources) ? content.sources : [];
  for (const s of walkStrings(content)) {
    const m = s.match(BAD_CHARS);
    if (m) issues.push({ kind: 'banned-character', detail: `"${m[0]}" in: ${s.slice(0, 70)}` });
    const low = s.toLowerCase();
    for (const w of BANNED_PHRASES) {
      if (low.includes(w)) issues.push({ kind: 'banned-phrase', detail: `"${w}" in: ${s.slice(0, 70)}` });
    }
    if (PRICE_PATTERN.test(s) && !sources.includes(s)) {
      issues.push({ kind: 'price', detail: `price-like text in: ${s.slice(0, 70)}` });
    }
  }
  if (forReview) {
    if (!content.heroIntro) issues.push({ kind: 'structure', detail: 'missing heroIntro' });
    if (!Array.isArray(content.sections) || content.sections.length < 3)
      issues.push({ kind: 'structure', detail: 'needs 3+ sections' });
    if (!Array.isArray(content.faqs) || content.faqs.length < 4)
      issues.push({ kind: 'structure', detail: 'needs 4+ faqs' });
    if (sources.length < 3)
      issues.push({ kind: 'structure', detail: 'needs 3+ sources' });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Gazetteer geocoding (stay_nodes first, then world_cities, India first)
// ---------------------------------------------------------------------------
export async function geocodeCandidates(town: string): Promise<any[]> {
  const out: any[] = [];
  try {
    const sn = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name, lat, lng FROM stay_nodes WHERE lower(name) = lower($1) LIMIT 3`, town);
    for (const r of sn) out.push({ source: 'stay_nodes', name: String(r.name), lat: Number(r.lat), lng: Number(r.lng) });
    const wc = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name, latitude, longitude, "countryCode", population
         FROM world_cities WHERE lower(name) = lower($1)
        ORDER BY ("countryCode" = 'IN') DESC, population DESC NULLS LAST LIMIT 5`, town);
    for (const r of wc) out.push({
      source: 'world_cities', name: String(r.name), lat: Number(r.latitude), lng: Number(r.longitude),
      countryCode: r.countryCode == null ? null : String(r.countryCode),
      population: r.population == null ? null : Number(r.population),
    });
  } catch (e) { console.error('geocodeCandidates failed (non-fatal):', e); }
  return out;
}

// ---------------------------------------------------------------------------
// The engine: rebuild tour_heritage for ONE collection
// ---------------------------------------------------------------------------
export async function remapCollection(collectionId: number): Promise<{ sites: number; unmapped: string[]; links: number; tiers: Record<Tier, number> }> {
  const sites = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, lat, lng FROM heritage_sites
      WHERE collection_id = $1 AND is_active = true`, collectionId);
  const mappable = sites.filter((s) => s.lat != null && s.lng != null);
  const unmapped = sites.filter((s) => s.lat == null || s.lng == null).map((s) => String(s.name));
  const stops = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ts."tourId" AS tour_id, c.name AS city, c.latitude AS lat, c.longitude AS lng
       FROM tour_stays ts JOIN cities c ON c.id = ts."wtiCityId"
      WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL`);
  type Best = { km: number; city: string };
  const best = new Map<string, Best>();
  for (const st of stops) {
    const p: [number, number] = [Number(st.lat), Number(st.lng)];
    for (const site of mappable) {
      const km = haversineKm(p, [Number(site.lat), Number(site.lng)]);
      if (km > DAY_TRIP_KM) continue;
      const key = `${st.tour_id}|${site.id}`;
      const cur = best.get(key);
      if (!cur || km < cur.km) best.set(key, { km, city: String(st.city) });
    }
  }
  await prisma.$executeRawUnsafe(
    `DELETE FROM tour_heritage WHERE site_id IN (SELECT id FROM heritage_sites WHERE collection_id = $1)`,
    collectionId);
  let links = 0;
  const tiers: Record<Tier, number> = { in_city: 0, short_drive: 0, day_trip: 0 };
  for (const [key, b] of best) {
    const [tourId, siteId] = key.split('|');
    const tier = tierFor(b.km);
    if (!tier) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO tour_heritage (tour_id, site_id, tier, via_city, km) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tour_id, site_id) DO UPDATE SET tier=EXCLUDED.tier, via_city=EXCLUDED.via_city, km=EXCLUDED.km`,
      tourId, Number(siteId), tier, b.city, Math.round(b.km * 10) / 10);
    links++;
    tiers[tier]++;
  }
  return { sites: mappable.length, unmapped, links, tiers };
}

// ---------------------------------------------------------------------------
// PUBLIC reads (fail closed)
// ---------------------------------------------------------------------------
export async function listCollections(activeOnly = true): Promise<any[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT hc.id, hc.slug, hc.name, hc.kind, hc.eyebrow, hc.hero_intro, hc.is_active,
              COALESCE(s.n, 0)::int AS site_count,
              COALESCE(t.n, 0)::int AS tour_count
         FROM heritage_collections hc
         LEFT JOIN (SELECT collection_id, count(*) n FROM heritage_sites WHERE is_active = true GROUP BY 1) s
                ON s.collection_id = hc.id
         LEFT JOIN (
           SELECT hs.collection_id, count(DISTINCT th.tour_id) n
             FROM tour_heritage th
             JOIN heritage_sites hs ON hs.id = th.site_id AND hs.is_active = true
             JOIN tours tr ON tr.id = th.tour_id AND tr."isActive" = true
            GROUP BY 1
         ) t ON t.collection_id = hc.id
        ${activeOnly ? 'WHERE hc.is_active = true' : ''}
        ORDER BY hc.name`);
    return rows.map((r) => ({
      id: Number(r.id), slug: String(r.slug), name: String(r.name), kind: String(r.kind),
      eyebrow: r.eyebrow == null ? null : String(r.eyebrow),
      heroIntro: r.hero_intro == null ? null : String(r.hero_intro),
      isActive: r.is_active === true,
      siteCount: Number(r.site_count), tourCount: Number(r.tour_count),
      url: `${SITE_BASE_URL}/destinations/${String(r.slug)}`,
    }));
  } catch (e) {
    console.error('listCollections failed (non-fatal):', e);
    return [];
  }
}

export async function getCollection(slug: string, activeOnly = true): Promise<any | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, slug, name, kind, eyebrow, hero_intro, content, is_active
         FROM heritage_collections WHERE slug = $1 ${activeOnly ? 'AND is_active = true' : ''} LIMIT 1`,
      slug.toLowerCase());
    if (!rows.length) return null;
    const c = rows[0];
    const sites = await prisma.$queryRawUnsafe<any[]>(
      `SELECT hs.id, hs.name, hs.slug, hs.state, hs.nearest_town, hs.lat, hs.lng, hs.blurb,
              hs.content_reviewed, hs.is_active,
              COALESCE(t.n, 0)::int AS tour_count
         FROM heritage_sites hs
         LEFT JOIN (
           SELECT th.site_id, count(*) n
             FROM tour_heritage th JOIN tours tr ON tr.id = th.tour_id AND tr."isActive" = true
            GROUP BY 1
         ) t ON t.site_id = hs.id
        WHERE hs.collection_id = $1 ${activeOnly ? 'AND hs.is_active = true' : ''}
        ORDER BY tour_count DESC, hs.name`, Number(c.id));
    return {
      id: Number(c.id), slug: String(c.slug), name: String(c.name), kind: String(c.kind),
      eyebrow: c.eyebrow == null ? null : String(c.eyebrow),
      heroIntro: c.hero_intro == null ? null : String(c.hero_intro),
      content: c.content ?? null,
      isActive: c.is_active === true,
      sites: sites.map((s) => ({
        id: Number(s.id), name: String(s.name), slug: String(s.slug), state: String(s.state),
        nearestTown: String(s.nearest_town),
        lat: s.lat == null ? null : Number(s.lat), lng: s.lng == null ? null : Number(s.lng),
        blurb: s.blurb == null ? null : String(s.blurb),
        contentReviewed: s.content_reviewed === true,
        isActive: s.is_active === true,
        tourCount: Number(s.tour_count),
        url: `${SITE_BASE_URL}/destinations/${String(c.slug)}/${String(s.slug)}`,
      })),
    };
  } catch (e) {
    console.error('getCollection failed (non-fatal):', e);
    return null;
  }
}

const TOUR_CARD_SELECT = {
  id: true, title: true, slug: true, overview: true,
  durationDays: true, durationNights: true, price: true, discountPrice: true,
  currency: true, rating: true, reviewCount: true, images: true,
  startCity: { select: { id: true, name: true, slug: true, imageUrl: true } },
} as const;

/** One site (with its GOLD content) + the tours that reach it, closest first. */
export async function getCollectionSiteTours(collectionSlug: string, siteSlug: string): Promise<any | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT hs.id, hs.name, hs.slug, hs.state, hs.nearest_town, hs.lat, hs.lng, hs.blurb,
              hs.content, hs.content_reviewed,
              hc.slug AS collection_slug, hc.name AS collection_name, hc.kind AS collection_kind
         FROM heritage_sites hs
         JOIN heritage_collections hc ON hc.id = hs.collection_id AND hc.is_active = true
        WHERE hc.slug = $1 AND hs.slug = $2 AND hs.is_active = true LIMIT 1`,
      collectionSlug.toLowerCase(), siteSlug.toLowerCase());
    if (!rows.length) return null;
    const s = rows[0];
    const agg = await prisma.$queryRawUnsafe<any[]>(
      `SELECT th.tour_id, th.tier, th.km, th.via_city
         FROM tour_heritage th
         JOIN tours t ON t.id = th.tour_id AND t."isActive" = true
        WHERE th.site_id = $1
        ORDER BY CASE th.tier WHEN 'in_city' THEN 0 WHEN 'short_drive' THEN 1 ELSE 2 END, th.km`,
      Number(s.id));
    let tours: any[] = [];
    if (agg.length) {
      const ids = agg.map((a) => String(a.tour_id));
      const cards = await prisma.tour.findMany({ where: { id: { in: ids } }, select: TOUR_CARD_SELECT });
      const byId = new Map(cards.map((r: any) => [r.id, r]));
      tours = agg
        .map((a) => {
          const t = byId.get(String(a.tour_id));
          if (!t) return null;
          const tier = String(a.tier) as Tier;
          return { ...t, tier, tierLabel: TIER_LABEL[tier] ?? '', km: Math.round(Number(a.km)), viaCity: String(a.via_city) };
        })
        .filter(Boolean);
    }
    return {
      site: {
        id: Number(s.id), name: String(s.name), slug: String(s.slug), state: String(s.state),
        nearestTown: String(s.nearest_town),
        lat: s.lat == null ? null : Number(s.lat), lng: s.lng == null ? null : Number(s.lng),
        blurb: s.blurb == null ? null : String(s.blurb),
        content: s.content ?? null,
        contentReviewed: s.content_reviewed === true,
        collection: { slug: String(s.collection_slug), name: String(s.collection_name), kind: String(s.collection_kind) },
      },
      tours,
      total: tours.length,
    };
  } catch (e) {
    console.error('getCollectionSiteTours failed (non-fatal):', e);
    return null;
  }
}
