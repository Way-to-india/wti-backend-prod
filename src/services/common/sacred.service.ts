/**
 * SACRED TEMPLE CIRCUITS — public read service (S1).
 *
 * The same shape as unesco.service.ts, over the pilgrimage circuits (Jyotirlinga, Char Dham,
 * Chota Char Dham, Arupadai Veedu, Navagraha, Shakti Peetha, Divya Desam). Rides on
 * sacred_sites + tour_sacred (scripts/sacred-seed.ts). Fails CLOSED and NON-FATAL — a missing
 * table returns empty, never a 500.
 *
 * Voice: devotional but EASY English, honest by distance, for Hindu Indian + NRI travellers
 * (guardrails/wti-content-voice-iron-law.md). We speak of darshan naturally and never over-claim
 * that a temple is "inside" a town — only how far it is from where you stay. NO MODEL.
 */
import prisma from '@/config/db';

export const SITE_BASE_URL = 'https://waytoindia.com';

export type Tier = 'in_city' | 'short_drive' | 'day_trip';
const TIER_RANK: Record<Tier, number> = { in_city: 0, short_drive: 1, day_trip: 2 };
const TIER_LABEL: Record<Tier, string> = {
  in_city: 'Where you stay',
  short_drive: 'A short drive away',
  day_trip: 'A day trip away',
};

export interface TourSacredSite {
  id: number;
  name: string;
  circuits: string[];
  deity: string | null;
  state: string;
  tier: Tier;
  tierLabel: string;
  viaCity: string;
  km: number;
  note: string;
}

function noteFor(name: string, tier: Tier, viaCity: string, km: number): string {
  const kmInt = Math.round(km);
  if (tier === 'in_city') return `While you stay at ${viaCity}, you can have darshan at ${name}.`;
  if (tier === 'short_drive')
    return `${name} is a short drive from your stay at ${viaCity} (about ${kmInt} km). You can go for darshan and come back the same day.`;
  return `${name} is an easy day trip from your stay at ${viaCity} (about ${kmInt} km).`;
}

/** The temples a single tour reaches, closest/strongest first. Empty on any failure. */
export async function sacredForTour(tourId: string): Promise<TourSacredSite[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT ss.id, ss.name, ss.circuits, ss.deity, ss.state, tsr.tier, tsr.via_city, tsr.km
         FROM tour_sacred tsr
         JOIN sacred_sites ss ON ss.id = tsr.sacred_id
        WHERE tsr.tour_id = $1`, tourId);
    return rows
      .map((r) => {
        const tier = String(r.tier) as Tier;
        const km = Number(r.km);
        return {
          id: Number(r.id),
          name: String(r.name),
          circuits: Array.isArray(r.circuits) ? r.circuits.map(String) : [],
          deity: r.deity == null ? null : String(r.deity),
          state: String(r.state),
          tier,
          tierLabel: TIER_LABEL[tier] ?? '',
          viaCity: String(r.via_city),
          km: Math.round(km * 10) / 10,
          note: noteFor(String(r.name), tier, String(r.via_city), km),
        } as TourSacredSite;
      })
      .sort((a, b) => (TIER_RANK[a.tier] - TIER_RANK[b.tier]) || (a.km - b.km));
  } catch (e) {
    console.error('sacredForTour failed (non-fatal):', e);
    return [];
  }
}

/** TouristTrip + referenced TouristAttraction JSON-LD for a tour's temples. null when none. */
export function tourSacredJsonLd(
  tour: { title: string; slug: string },
  sites: TourSacredSite[],
): Record<string, any> | null {
  if (!sites.length) return null;
  const names = sites.map((s) => s.name);
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: tour.title,
    description: `${tour.title} takes you to ${sites.length} sacred ${sites.length === 1 ? 'temple' : 'temples'} of India: ${names.join(', ')}.`,
    url: `${SITE_BASE_URL}/tour/${tour.slug}`,
    touristType: ['Pilgrimage', 'Temple tour', 'Spiritual tourism'],
    itinerary: {
      '@type': 'ItemList',
      numberOfItems: sites.length,
      itemListElement: sites.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'PlaceOfWorship',
          name: s.name,
          description: `${s.circuits.join(', ')} temple of ${s.deity ?? 'the deity'} in ${s.state}, India.`,
          address: { '@type': 'PostalAddress', addressRegion: s.state, addressCountry: 'IN' },
        },
      })),
    },
    provider: { '@type': 'TravelAgency', name: 'Way to India', url: SITE_BASE_URL },
  };
}

const CIRCUIT_ORDER = [
  'Jyotirlinga', 'Char Dham', 'Chota Char Dham', 'Arupadai Veedu',
  'Navagraha', 'Shakti Peetha', 'Divya Desam',
];

/** Circuit summary for a future collection landing: each circuit + member/tour counts. */
export async function listSacredCircuits(): Promise<any[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT circuit,
              count(*)::int AS sites,
              count(*) FILTER (WHERE lat IS NOT NULL)::int AS geocoded
         FROM (SELECT unnest(circuits) AS circuit, lat FROM sacred_sites) x
        GROUP BY circuit`);
    const tours = await prisma.$queryRawUnsafe<any[]>(
      `SELECT circuit, count(DISTINCT tour_id)::int AS tour_count
         FROM (
           SELECT unnest(ss.circuits) AS circuit, ts.tour_id
             FROM tour_sacred ts JOIN sacred_sites ss ON ss.id = ts.sacred_id
             JOIN tours t ON t.id = ts.tour_id AND t."isActive" = true
         ) y GROUP BY circuit`);
    const tourMap = new Map(tours.map((r) => [String(r.circuit), Number(r.tour_count)]));
    const byName = new Map(rows.map((r) => [String(r.circuit), r]));
    const ordered = [...CIRCUIT_ORDER.filter((c) => byName.has(c)),
      ...rows.map((r) => String(r.circuit)).filter((c) => !CIRCUIT_ORDER.includes(c))];
    return ordered.map((c) => {
      const r: any = byName.get(c);
      return { circuit: c, sites: Number(r.sites), geocoded: Number(r.geocoded), tourCount: tourMap.get(c) ?? 0 };
    });
  } catch (e) {
    console.error('listSacredCircuits failed (non-fatal):', e);
    return [];
  }
}

const TOUR_CARD_SELECT = {
  id: true, title: true, slug: true, overview: true,
  durationDays: true, durationNights: true, price: true, discountPrice: true,
  currency: true, rating: true, reviewCount: true, images: true,
  startCity: { select: { id: true, name: true, slug: true, imageUrl: true } },
} as const;

/** Active tours that reach a temple; optionally filtered to one circuit. Richest first. */
export async function toursCoveringSacred(circuit: string | null, page = 1, limit = 12): Promise<{ tours: any[]; total: number }> {
  try {
    const filter = circuit ? `AND ss.circuits @> ARRAY[$1]::text[]` : '';
    const params: any[] = circuit ? [circuit] : [];
    const agg = await prisma.$queryRawUnsafe<any[]>(
      `SELECT ts.tour_id,
              count(*)::int AS n,
              json_agg(json_build_object('name', ss.name, 'tier', ts.tier, 'km', ts.km,
                       'circuits', ss.circuits, 'deity', ss.deity)
                       ORDER BY CASE ts.tier WHEN 'in_city' THEN 0 WHEN 'short_drive' THEN 1 ELSE 2 END, ts.km) AS sites
         FROM tour_sacred ts
         JOIN sacred_sites ss ON ss.id = ts.sacred_id
         JOIN tours t ON t.id = ts.tour_id AND t."isActive" = true
        WHERE 1=1 ${filter}
        GROUP BY ts.tour_id
        ORDER BY n DESC, ts.tour_id`, ...params);
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
          km: Math.round(Number(s.km)), circuits: Array.isArray(s.circuits) ? s.circuits.map(String) : [],
          deity: s.deity == null ? null : String(s.deity),
        }));
        return { ...t, sacredCount: Number(a.n), sacredSites: sites };
      })
      .filter(Boolean);
    return { tours, total };
  } catch (e) {
    console.error('toursCoveringSacred failed (non-fatal):', e);
    return { tours: [], total: 0 };
  }
}
