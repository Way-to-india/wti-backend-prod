/**
 * HERITAGE ADMIN — founder editing for the GOLD content layer.
 *
 * Covers three stores:
 *   legacy 'unesco'  -> unesco_sites  (44 pages)
 *   legacy 'sacred'  -> sacred_sites  (35 pages)
 *   legacy circuits  -> sacred_circuit_content (7 overviews)
 *   generic          -> heritage_collections / heritage_sites (founder-created)
 *
 * Every content write runs through the GOLD gate (contentGate). Drafts may carry
 * style issues as warnings, but a page can only be MARKED REVIEWED when the gate
 * is fully clean. Every successful write busts the public caches.
 */
import prisma from '@/config/db';
import cacheService from '@/services/common/cache.service';
import { contentGate, heritageSlug, type GateIssue } from '@/services/common/heritage.service';

export type LegacyLayer = 'unesco' | 'sacred';
const LEGACY_TABLE: Record<LegacyLayer, string> = { unesco: 'unesco_sites', sacred: 'sacred_sites' };

export async function bustHeritageCaches(): Promise<void> {
  try {
    await Promise.all([
      cacheService.deletePattern('unesco:*'),
      cacheService.deletePattern('sacred:*'),
      cacheService.deletePattern('heritage:*'),
    ]);
  } catch (e) {
    console.error('bustHeritageCaches failed (non-fatal):', e);
  }
}

// ---------------------------------------------------------------------------
// Legacy layers (unesco_sites / sacred_sites)
// ---------------------------------------------------------------------------
export async function listLegacySites(layer: LegacyLayer): Promise<any[]> {
  const extra = layer === 'sacred' ? 'circuits, deity, slug,' : 'category, year_inscribed,';
  const mapTable = layer === 'sacred' ? 'tour_sacred' : 'tour_unesco';
  const fk = layer === 'sacred' ? 'sacred_id' : 'unesco_id';
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT s.id, s.name, s.state, s.nearest_town, s.lat, s.lng, s.blurb, ${extra}
            s.content, s.content_reviewed, s.content_updated_at,
            COALESCE(t.n, 0)::int AS tour_count
       FROM ${LEGACY_TABLE[layer]} s
       LEFT JOIN (
         SELECT m.${fk} AS sid, count(*) n
           FROM ${mapTable} m JOIN tours tr ON tr.id = m.tour_id AND tr."isActive" = true
          GROUP BY 1
       ) t ON t.sid = s.id
      ORDER BY s.name`);
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    state: String(r.state),
    nearestTown: String(r.nearest_town),
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    blurb: r.blurb == null ? null : String(r.blurb),
    ...(layer === 'sacred'
      ? {
          circuits: Array.isArray(r.circuits) ? r.circuits.map(String) : [],
          deity: r.deity == null ? null : String(r.deity),
          slug: r.slug == null ? null : String(r.slug),
        }
      : {
          category: String(r.category),
          yearInscribed: Number(r.year_inscribed),
        }),
    content: r.content ?? null,
    contentReviewed: r.content_reviewed === true,
    contentUpdatedAt: r.content_updated_at ?? null,
    tourCount: Number(r.tour_count),
  }));
}

export interface SaveResult { ok: boolean; issues: GateIssue[] }

export interface LegacyPatch {
  content?: any;
  contentReviewed?: boolean;
  blurb?: string | null;
  // sacred-only meta (ignored for unesco)
  circuits?: string[];
  deity?: string | null;
  state?: string;
  nearestTown?: string;
  lat?: number | null;
  lng?: number | null;
  geocodedFrom?: string | null;
}

export async function saveLegacyContent(
  layer: LegacyLayer, id: number,
  patch: LegacyPatch,
): Promise<SaveResult> {
  const forReview = patch.contentReviewed === true;
  const issues = patch.content !== undefined || forReview
    ? contentGate(patch.content ?? (await currentContent(LEGACY_TABLE[layer], id)), forReview)
    : [];
  if (forReview && issues.length) return { ok: false, issues };
  const hard = issues.filter((i) => i.kind === 'banned-character');
  if (hard.length) return { ok: false, issues: hard }; // em dashes never enter the DB, even in drafts

  const sets: string[] = [];
  const args: any[] = [id];
  const set = (col: string, val: any) => { args.push(val); sets.push(`${col} = $${args.length}`); };
  if (patch.content !== undefined) { args.push(JSON.stringify(patch.content)); sets.push(`content = $${args.length}::jsonb`); }
  if (patch.contentReviewed !== undefined) { args.push(patch.contentReviewed === true); sets.push(`content_reviewed = $${args.length}`); }
  if (patch.blurb !== undefined) set('blurb', patch.blurb);
  // sacred temples can also edit their place/circuit meta from the editor
  if (layer === 'sacred') {
    if (patch.circuits !== undefined) { args.push(patch.circuits); sets.push(`circuits = $${args.length}::text[]`); }
    if (patch.deity !== undefined) set('deity', patch.deity);
    if (patch.state !== undefined) set('state', String(patch.state));
    if (patch.nearestTown !== undefined) set('nearest_town', String(patch.nearestTown));
    if (patch.lat !== undefined) set('lat', patch.lat);
    if (patch.lng !== undefined) set('lng', patch.lng);
    if (patch.geocodedFrom !== undefined) set('geocoded_from', patch.geocodedFrom);
  }
  if (!sets.length) return { ok: true, issues };
  sets.push('content_updated_at = now()');
  await prisma.$executeRawUnsafe(
    `UPDATE ${LEGACY_TABLE[layer]} SET ${sets.join(', ')} WHERE id = $1`, ...args);
  await bustHeritageCaches();
  return { ok: true, issues };
}

// ---------------------------------------------------------------------------
// Sacred temples are additive from admin: create a new temple, delete an
// un-reviewed one, and rebuild the whole tour_sacred map on demand.
// ---------------------------------------------------------------------------
async function uniqueSacredSlug(name: string): Promise<string> {
  const base = heritageSlug(name) || 'temple';
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT slug FROM sacred_sites WHERE slug LIKE $1`, `${base}%`);
  const taken = new Set(rows.map((r) => String(r.slug)));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 999; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export async function createSacredSite(input: {
  name: string; circuits?: string[]; deity?: string | null; state?: string;
  nearestTown?: string; lat?: number | null; lng?: number | null; geocodedFrom?: string | null;
}): Promise<{ id: number; slug: string }> {
  const slug = await uniqueSacredSlug(input.name);
  const circuits = Array.isArray(input.circuits)
    ? input.circuits.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO sacred_sites
       (name, slug, circuits, deity, state, nearest_town, lat, lng, geocoded_from, verified, content_reviewed)
     VALUES ($1,$2,$3::text[],$4,$5,$6,$7,$8,$9,$10,false)
     RETURNING id, slug`,
    input.name, slug, circuits, input.deity ?? null,
    input.state ?? '', input.nearestTown ?? '',
    input.lat ?? null, input.lng ?? null, input.geocodedFrom ?? null,
    input.lat != null && input.lng != null);
  await bustHeritageCaches();
  return { id: Number(rows[0].id), slug: String(rows[0].slug) };
}

export async function deleteSacredSite(id: number): Promise<{ ok: boolean; reason?: string }> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT content_reviewed FROM sacred_sites WHERE id = $1`, id);
  if (!rows.length) return { ok: false, reason: 'Temple not found.' };
  if (rows[0].content_reviewed === true) {
    return { ok: false, reason: 'This temple is marked reviewed. Un-review it first, then delete.' };
  }
  await prisma.$executeRawUnsafe(`DELETE FROM tour_sacred WHERE sacred_id = $1`, id);
  await prisma.$executeRawUnsafe(`DELETE FROM sacred_sites WHERE id = $1`, id);
  await bustHeritageCaches();
  return { ok: true };
}

async function currentContent(table: string, id: number): Promise<any> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT content FROM ${table} WHERE id = $1`, id);
  return rows[0]?.content ?? null;
}

export async function listCircuitContent(): Promise<any[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT c.circuit, c.content, c.content_reviewed, c.content_updated_at
       FROM sacred_circuit_content c ORDER BY c.circuit`);
  return rows.map((r) => ({
    circuit: String(r.circuit),
    content: r.content ?? null,
    contentReviewed: r.content_reviewed === true,
    contentUpdatedAt: r.content_updated_at ?? null,
  }));
}

export async function saveCircuitContent(
  circuit: string, patch: { content?: any; contentReviewed?: boolean },
): Promise<SaveResult> {
  const issues: GateIssue[] = [];
  if (patch.content !== undefined) {
    for (const s of walk(patch.content)) {
      if (/[—–“”‘’]/.test(s)) issues.push({ kind: 'banned-character', detail: s.slice(0, 70) });
    }
    if (patch.contentReviewed === true) {
      if (!patch.content?.overview) issues.push({ kind: 'structure', detail: 'missing overview' });
      if (!Array.isArray(patch.content?.sources) || patch.content.sources.length < 3)
        issues.push({ kind: 'structure', detail: 'needs 3+ sources' });
    }
  }
  if (issues.length) return { ok: false, issues };
  await prisma.$executeRawUnsafe(
    `INSERT INTO sacred_circuit_content (circuit, content, content_reviewed, content_updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (circuit) DO UPDATE
        SET content = COALESCE(EXCLUDED.content, sacred_circuit_content.content),
            content_reviewed = EXCLUDED.content_reviewed,
            content_updated_at = now()`,
    circuit,
    patch.content !== undefined ? JSON.stringify(patch.content) : null,
    patch.contentReviewed === true);
  await bustHeritageCaches();
  return { ok: true, issues: [] };
}

function walk(v: any, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => walk(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => walk(x, out));
  return out;
}

// ---------------------------------------------------------------------------
// Generic collections CRUD
// ---------------------------------------------------------------------------
export async function createCollection(input: { name: string; slug?: string; kind?: string; eyebrow?: string; heroIntro?: string }): Promise<any> {
  const slug = heritageSlug(input.slug || input.name);
  const kind = ['monument', 'temple', 'nature', 'mixed'].includes(String(input.kind)) ? String(input.kind) : 'monument';
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO heritage_collections (slug, name, kind, eyebrow, hero_intro)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, slug`,
    slug, input.name, kind, input.eyebrow ?? null, input.heroIntro ?? null);
  await bustHeritageCaches();
  return { id: Number(rows[0].id), slug: String(rows[0].slug) };
}

export async function updateCollection(id: number, patch: any): Promise<void> {
  const sets: string[] = [];
  const args: any[] = [id];
  const set = (col: string, val: any) => { args.push(val); sets.push(`${col} = $${args.length}`); };
  if (patch.name !== undefined) set('name', String(patch.name));
  if (patch.slug !== undefined) set('slug', heritageSlug(String(patch.slug)));
  if (patch.kind !== undefined && ['monument', 'temple', 'nature', 'mixed'].includes(String(patch.kind))) set('kind', String(patch.kind));
  if (patch.eyebrow !== undefined) set('eyebrow', patch.eyebrow);
  if (patch.heroIntro !== undefined) set('hero_intro', patch.heroIntro);
  if (patch.isActive !== undefined) set('is_active', patch.isActive === true);
  if (!sets.length) return;
  sets.push('updated_at = now()');
  await prisma.$executeRawUnsafe(`UPDATE heritage_collections SET ${sets.join(', ')} WHERE id = $1`, ...args);
  await bustHeritageCaches();
}

export async function deleteCollection(id: number): Promise<{ ok: boolean; reason?: string }> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(*)::int n FROM heritage_sites WHERE collection_id = $1`, id);
  if (Number(rows[0].n) > 0) return { ok: false, reason: 'Collection still has sites. Delete or move them first.' };
  await prisma.$executeRawUnsafe(`DELETE FROM heritage_collections WHERE id = $1`, id);
  await bustHeritageCaches();
  return { ok: true };
}

export async function createSite(collectionId: number, input: {
  name: string; slug?: string; state?: string; nearestTown?: string;
  lat?: number | null; lng?: number | null; geocodedFrom?: string | null;
}): Promise<any> {
  const slug = heritageSlug(input.slug || input.name);
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO heritage_sites (collection_id, name, slug, state, nearest_town, lat, lng, geocoded_from)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, slug`,
    collectionId, input.name, slug, input.state ?? '', input.nearestTown ?? '',
    input.lat ?? null, input.lng ?? null, input.geocodedFrom ?? null);
  await bustHeritageCaches();
  return { id: Number(rows[0].id), slug: String(rows[0].slug) };
}

export async function updateSite(id: number, patch: any): Promise<SaveResult> {
  const forReview = patch.contentReviewed === true;
  let issues: GateIssue[] = [];
  if (patch.content !== undefined || forReview) {
    const content = patch.content !== undefined ? patch.content : await currentContent('heritage_sites', id);
    issues = contentGate(content, forReview);
    if (forReview && issues.length) return { ok: false, issues };
    const hard = issues.filter((i) => i.kind === 'banned-character');
    if (hard.length) return { ok: false, issues: hard };
  }
  const sets: string[] = [];
  const args: any[] = [id];
  const set = (col: string, val: any) => { args.push(val); sets.push(`${col} = $${args.length}`); };
  if (patch.name !== undefined) set('name', String(patch.name));
  if (patch.slug !== undefined) set('slug', heritageSlug(String(patch.slug)));
  if (patch.state !== undefined) set('state', String(patch.state));
  if (patch.nearestTown !== undefined) set('nearest_town', String(patch.nearestTown));
  if (patch.lat !== undefined) set('lat', patch.lat);
  if (patch.lng !== undefined) set('lng', patch.lng);
  if (patch.geocodedFrom !== undefined) set('geocoded_from', patch.geocodedFrom);
  if (patch.blurb !== undefined) set('blurb', patch.blurb);
  if (patch.content !== undefined) { args.push(JSON.stringify(patch.content)); sets.push(`content = $${args.length}::jsonb`); }
  if (patch.contentReviewed !== undefined) set('content_reviewed', patch.contentReviewed === true);
  if (patch.isActive !== undefined) set('is_active', patch.isActive === true);
  if (!sets.length) return { ok: true, issues };
  sets.push('updated_at = now()');
  await prisma.$executeRawUnsafe(`UPDATE heritage_sites SET ${sets.join(', ')} WHERE id = $1`, ...args);
  await bustHeritageCaches();
  return { ok: true, issues };
}

export async function deleteSite(id: number): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM heritage_sites WHERE id = $1`, id);
  await bustHeritageCaches();
}

/** Tours currently attached to one site (admin preview after a remap). */
export async function siteTourPreview(id: number): Promise<any[]> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT th.tour_id, th.tier, th.km, th.via_city, t.title, t.slug
       FROM tour_heritage th
       JOIN tours t ON t.id = th.tour_id AND t."isActive" = true
      WHERE th.site_id = $1
      ORDER BY CASE th.tier WHEN 'in_city' THEN 0 WHEN 'short_drive' THEN 1 ELSE 2 END, th.km`, id);
  return rows.map((r) => ({
    tourId: String(r.tour_id), title: String(r.title), slug: String(r.slug),
    tier: String(r.tier), km: Number(r.km), viaCity: String(r.via_city),
  }));
}
