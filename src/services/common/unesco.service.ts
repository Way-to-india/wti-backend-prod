/**
 * UNESCO WORLD HERITAGE LAYER — public read service (U3).
 *
 * One home for every UNESCO read the site does: the "sites covered" block on a tour page,
 * the tour and collection JSON-LD, the /destinations collection landing, per-site tour lists.
 *
 * Rides on U1/U2 `unesco_sites` + U3 `tour_unesco` (populated by scripts/unesco-tour-map.ts).
 * Every function FAILS CLOSED and NON-FATAL — a missing table or a bad row returns an empty
 * result, never a 500, so the tour page keeps rendering exactly as it did before U3.
 *
 * Voice: honest by distance, WTI expert-guide easy English (see guardrails/wti-content-voice
 * -iron-law.md). We never say a monument is "inside" a town — only how far it is from the stay.
 * NO MODEL. Pure SQL + string building.
 */
import prisma from '@/config/db';

export const SITE_BASE_URL = 'https://waytoindia.com';
const COLLECTION_PATH = '/destinations/unesco-world-heritage-sites';

export type Tier = 'in_city' | 'short_drive' | 'day_trip';
const TIER_RANK: Record<Tier, number> = { in_city: 0, short_drive: 1, day_trip: 2 };
const TIER_LABEL: Record<Tier, string> = {
  in_city: 'In the city',
  short_drive: 'A short drive away',
  day_trip: 'A day trip away',
};

export interface TourUnescoSite {
  id: number;
  name: string;
  slug: string;
  state: string;
  category: 'Cultural' | 'Natural' | 'Mixed';
  yearInscribed: number;
  tier: Tier;
  tierLabel: string;
  viaCity: string;
  km: number;
  note: string;      // one honest, easy-English line for the traveller
  url: string;       // collection detail url for this site
}

/** deterministic, url-safe slug from a site name (no DB slug column needed). */
export function siteSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`.,()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** One honest, easy-English sentence, sized to the true distance from the traveller's stay. */
function noteFor(site: { name: string; category: string }, tier: Tier, viaCity: string, km: number): string {
  const kmInt = Math.round(km);
  if (tier === 'in_city') {
    return `While you stay at ${viaCity}, you can visit ${site.name}, a UNESCO World Heritage Site.`;
  }
  if (tier === 'short_drive') {
    return `${site.name} is a short drive from your stay at ${viaCity} (about ${kmInt} km). You can see it as a half-day trip.`;
  }
  return `${site.name} makes an easy day trip from your stay at ${viaCity} (about ${kmInt} km).`;
}

/** The UNESCO sites a single tour passes, closest/strongest first. Empty on any failure. */
export async function unescoForTour(tourId: string): Promise<TourUnescoSite[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT us.id, us.name, us.state, us.category, us.year_inscribed AS year,
              tu.tier, tu.via_city, tu.km
         FROM tour_unesco tu
         JOIN unesco_sites us ON us.id = tu.unesco_id
        WHERE tu.tour_id = $1`, tourId);
    return rows
      .map((r) => {
        const tier = String(r.tier) as Tier;
        const km = Number(r.km);
        const slug = siteSlug(String(r.name));
        return {
          id: Number(r.id),
          name: String(r.name),
          slug,
          state: String(r.state),
          category: String(r.category) as TourUnescoSite['category'],
          yearInscribed: Number(r.year),
          tier,
          tierLabel: TIER_LABEL[tier] ?? '',
          viaCity: String(r.via_city),
          km: Math.round(km * 10) / 10,
          note: noteFor({ name: String(r.name), category: String(r.category) }, tier, String(r.via_city), km),
          url: `${SITE_BASE_URL}${COLLECTION_PATH}/${slug}`,
        } as TourUnescoSite;
      })
      .sort((a, b) => (TIER_RANK[a.tier] - TIER_RANK[b.tier]) || (a.km - b.km) || (a.yearInscribed - b.yearInscribed));
  } catch (e) {
    console.error('unescoForTour failed (non-fatal):', e);
    return [];
  }
}

/** TouristTrip + referenced TouristAttraction JSON-LD for a tour. null when no sites. */
export function tourUnescoJsonLd(
  tour: { title: string; slug: string; overview?: string | null },
  sites: TourUnescoSite[],
): Record<string, any> | null {
  if (!sites.length) return null;
  const tourUrl = `${SITE_BASE_URL}/tour/${tour.slug}`;
  const names = sites.map((s) => s.name);
  const description =
    `${tour.title} passes ${sites.length} UNESCO World Heritage ` +
    `${sites.length === 1 ? 'Site' : 'Sites'} of India: ${names.join(', ')}.`;
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: tour.title,
    description,
    url: tourUrl,
    touristType: ['UNESCO World Heritage', 'Cultural tourism', 'Heritage tourism'],
    itinerary: {
      '@type': 'ItemList',
      numberOfItems: sites.length,
      itemListElement: sites.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'TouristAttraction',
          name: s.name,
          url: s.url,
          description:
            `UNESCO World Heritage Site (${s.category}, inscribed ${s.yearInscribed}) in ${s.state}, India.`,
          touristType: 'UNESCO World Heritage Site',
          address: { '@type': 'PostalAddress', addressRegion: s.state, addressCountry: 'IN' },
        },
      })),
    },
    provider: { '@type': 'TravelAgency', name: 'Way to India', url: SITE_BASE_URL },
  };
}

/** All sites for the collection landing, each with how many active tours reach it. */
export async function listUnescoSites(): Promise<any[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT us.id, us.name, us.state, us.category, us.year_inscribed AS year,
              us.nearest_town, us.lat, us.lng, us.blurb,
              COALESCE(c.n, 0)::int AS tour_count
         FROM unesco_sites us
         LEFT JOIN (
           SELECT tu.unesco_id, count(*) n
             FROM tour_unesco tu JOIN tours t ON t.id = tu.tour_id AND t."isActive" = true
            GROUP BY tu.unesco_id
         ) c ON c.unesco_id = us.id
        ORDER BY tour_count DESC, us.year_inscribed DESC, us.name`);
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      slug: siteSlug(String(r.name)),
      state: String(r.state),
      category: String(r.category),
      yearInscribed: Number(r.year),
      nearestTown: String(r.nearest_town),
      lat: r.lat == null ? null : Number(r.lat),
      lng: r.lng == null ? null : Number(r.lng),
      blurb: r.blurb == null ? null : String(r.blurb),
      tourCount: Number(r.tour_count),
      url: `${SITE_BASE_URL}${COLLECTION_PATH}/${siteSlug(String(r.name))}`,
    }));
  } catch (e) {
    console.error('listUnescoSites failed (non-fatal):', e);
    return [];
  }
}

/** ItemList / CollectionPage JSON-LD for the /destinations UNESCO landing. */
export function collectionJsonLd(sites: any[]): Record<string, any> {
  const withTours = sites.filter((s) => s.tourCount > 0);
  const list = withTours.length ? withTours : sites;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'UNESCO World Heritage Sites of India — Tours & Travel Guide',
    url: `${SITE_BASE_URL}${COLLECTION_PATH}`,
    description:
      'Every UNESCO World Heritage Site of India and the Way to India tours that take you to them.',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: list.length,
      itemListElement: list.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'TouristAttraction',
          name: s.name,
          url: s.url,
          description: `UNESCO World Heritage Site (${s.category}, inscribed ${s.yearInscribed}) in ${s.state}, India.`,
          touristType: 'UNESCO World Heritage Site',
          address: { '@type': 'PostalAddress', addressRegion: s.state, addressCountry: 'IN' },
        },
      })),
    },
  };
}

const TOUR_CARD_SELECT = {
  id: true, title: true, slug: true, overview: true,
  durationDays: true, durationNights: true, price: true, discountPrice: true,
  currency: true, rating: true, reviewCount: true, images: true,
  startCity: { select: { id: true, name: true, slug: true, imageUrl: true } },
} as const;

/** Collection: ALL active tours that reach at least one UNESCO site, richest first. */
export async function toursCoveringUnesco(page = 1, limit = 12): Promise<{ tours: any[]; total: number }> {
  try {
    const agg = await prisma.$queryRawUnsafe<any[]>(
      `SELECT tu.tour_id,
              count(*)::int AS n,
              json_agg(json_build_object('name', us.name, 'tier', tu.tier, 'km', tu.km,
                       'category', us.category)
                       ORDER BY CASE tu.tier WHEN 'in_city' THEN 0 WHEN 'short_drive' THEN 1 ELSE 2 END, tu.km) AS sites
         FROM tour_unesco tu
         JOIN unesco_sites us ON us.id = tu.unesco_id
         JOIN tours t ON t.id = tu.tour_id AND t."isActive" = true
        GROUP BY tu.tour_id
        ORDER BY n DESC, tu.tour_id`);
    const total = agg.length;
    const start = Math.max(0, (page - 1) * limit);
    const pageAgg = agg.slice(start, start + limit);
    if (!pageAgg.length) return { tours: [], total };
    const ids = pageAgg.map((a) => String(a.tour_id));
    const rows = await prisma.tour.findMany({ where: { id: { in: ids } }, select: TOUR_CARD_SELECT });
    const byId = new Map(rows.map((r: any) => [r.id, r]));
    const tours = pageAgg
      .map((a) => {
        const t = byId.get(String(a.tour_id));
        if (!t) return null;
        const sites = (Array.isArray(a.sites) ? a.sites : []).map((s: any) => ({
          name: String(s.name), tier: String(s.tier), tierLabel: TIER_LABEL[String(s.tier) as Tier] ?? '',
          km: Math.round(Number(s.km)), category: String(s.category), slug: siteSlug(String(s.name)),
        }));
        return { ...t, unescoCount: Number(a.n), unescoSites: sites };
      })
      .filter(Boolean);
    return { tours, total };
  } catch (e) {
    console.error('toursCoveringUnesco failed (non-fatal):', e);
    return { tours: [], total: 0 };
  }
}

/** Resolve a site by numeric id or slug. */
export async function getSite(idOrSlug: string): Promise<any | null> {
  try {
    const all = await listUnescoSites();
    if (!all.length) return null;
    if (/^\d+$/.test(idOrSlug)) return all.find((s) => s.id === Number(idOrSlug)) ?? null;
    const slug = siteSlug(idOrSlug);
    return all.find((s) => s.slug === slug) ?? null;
  } catch (e) {
    console.error('getSite failed (non-fatal):', e);
    return null;
  }
}

/** Per-site tour list: the active tours that reach one UNESCO site, closest first. */
export async function toursForSite(unescoId: number): Promise<any[]> {
  try {
    const agg = await prisma.$queryRawUnsafe<any[]>(
      `SELECT tu.tour_id, tu.tier, tu.km, tu.via_city
         FROM tour_unesco tu
         JOIN tours t ON t.id = tu.tour_id AND t."isActive" = true
        WHERE tu.unesco_id = $1
        ORDER BY CASE tu.tier WHEN 'in_city' THEN 0 WHEN 'short_drive' THEN 1 ELSE 2 END, tu.km`,
      unescoId);
    if (!agg.length) return [];
    const ids = agg.map((a) => String(a.tour_id));
    const rows = await prisma.tour.findMany({ where: { id: { in: ids } }, select: TOUR_CARD_SELECT });
    const byId = new Map(rows.map((r: any) => [r.id, r]));
    return agg
      .map((a) => {
        const t = byId.get(String(a.tour_id));
        if (!t) return null;
        const tier = String(a.tier) as Tier;
        return { ...t, tier, tierLabel: TIER_LABEL[tier] ?? '', km: Math.round(Number(a.km)), viaCity: String(a.via_city) };
      })
      .filter(Boolean);
  } catch (e) {
    console.error('toursForSite failed (non-fatal):', e);
    return [];
  }
}
