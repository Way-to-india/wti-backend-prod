/**
 * SPRINT C1 — INGESTION: our own tours → canonical BRANCHES (deterministic, no LLM).
 *
 * Ruling doc: THE-LIBRARY-ARCHITECTURE-2026-07-15.md §8 (C1) + §10.4 (structural hash,
 * ltree variants, sleep-event correction). Run on the box:  bun run scripts/c1-ingest.ts
 *
 *   SKELETON  — from tour_stays (already gazetteer-resolved to stay_node ids; US-871
 *               proved this is servable). ADMIN rows are verified; ai_backfill branches
 *               carry needs_review = true until the founder ticks them (the ours-only law).
 *   HASH      — ordered stay_node ids + entry_region + exit_region ONLY. Same hash ⇒
 *               evidence++. A strict-prefix superset becomes an ltree CHILD variant.
 *   CHIPS     — union of stops' anchor themes from intent_place (the 504-row founder index).
 *   ROLES     — deterministic defaults (library.assignRoles), founder-reviewable.
 *   REVIEW    — the sleep-event parser reconstructs the night timeline from tour_itinerary
 *               and files a PROPOSAL into tour_stays_review where it disagrees with
 *               tour_stays. Nothing is silently applied — the founder ticks each row.
 *
 * Idempotent: truncates the library tables and rebuilds. NO model call anywhere.
 */
import prisma from '@/config/db';
import { REGIONS } from '@/services/route-optimizer/regions';
import {
  structHash, normAlias, seasonMaskFromBestTime, bodyClassFor, assignRoles,
  deriveBranchChips, type RawStop, type ThemeTag,
} from '@/services/route-optimizer/library';
import { resolveNamedCircuit, NAMED_CIRCUITS } from '@/services/route-optimizer/namedCircuits';

// ---- state name → most-specific region key -------------------------------------------
const stateToRegion = new Map<string, string>();
{
  const byState: Record<string, { key: string; size: number }[]> = {};
  for (const r of REGIONS) for (const s of r.states) {
    (byState[s.name] ||= []).push({ key: r.key, size: r.states.length });
  }
  for (const [name, opts] of Object.entries(byState)) {
    opts.sort((a, b) => a.size - b.size);              // smallest region wins (most specific)
    stateToRegion.set(name, opts[0].key);
  }
}
const regionOf = (stateName: string | null): string | null =>
  stateName ? (stateToRegion.get(stateName) ?? null) : null;

// ---- sleep-event parser (verification only; feeds the founder review queue) -----------
function buildNameMatcher(nodes: { id: string; name: string }[]) {
  const name2node = new Map<string, { id: string; name: string }>();
  const normMap = new Map<string, { id: string; name: string }>();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').replace(/h/g, '');
  const names: string[] = [];
  for (const n of nodes) {
    const nm = n.name.trim();
    if (nm.length < 4) continue;
    name2node.set(nm.toLowerCase(), n);
    normMap.set(norm(nm), n);
    names.push(nm);
  }
  names.sort((a, b) => b.length - a.length);
  const BIG = new RegExp('\\b(' + names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i');
  const BIG_G = new RegExp(BIG.source, 'ig');
  const AMBIG = new Set('along daman diu mori morni puri mahad leh una beas dam pin sonipat'.split(' '));
  const townsIn = (text: string, allowAmbig = true) => {
    const out: { pos: number; node: { id: string; name: string } }[] = [];
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    BIG_G.lastIndex = 0;
    while ((m = BIG_G.exec(text))) {
      const key = m[1].trim().toLowerCase();
      const nd = name2node.get(key);
      if (!nd) continue;
      if (!allowAmbig && AMBIG.has(key)) continue;
      if (seen.has(nd.id)) continue;
      seen.add(nd.id); out.push({ pos: m.index, node: nd });
    }
    return out;
  };
  return { townsIn, norm };
}
const DEPART = /\b(depart|departure|dropp?ed?|transfer(?:red)? to (?:the )?(?:airport|railway|station)|onward|fly back|drive back|board (?:your |the )?(?:flight|train)|journey ends|end of (?:the )?(?:tour|trip))\b/i;
const CHECKIN = /\b(check[\s-]*in|checkin|overnight|night stay|stay overnight|halt (?:at|for)|dinner and (?:overnight|stay))\b/i;

function parseSleepEvents(
  days: { day: number; title: string; description: string | null }[],
  mx: ReturnType<typeof buildNameMatcher>,
): { name: string; nights: number }[] {
  const sorted = [...days].sort((a, b) => a.day - b.day);
  const stops: { node: { id: string; name: string }; nights: number }[] = [];
  let last: { id: string; name: string } | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i];
    const title = d.title || '';
    const desc = (d.description || '').replace(/\s+/g, ' ');
    const isLast = i === sorted.length - 1;
    let node: { id: string; name: string } | null = null;
    if (isLast && DEPART.test(title + ' . ' + desc) && !CHECKIN.test(desc)) {
      node = null;                                        // departure day, no night
    } else {
      const cues = [...desc.matchAll(new RegExp(CHECKIN.source, 'ig'))];
      if (cues.length) {
        const cue = cues[cues.length - 1].index ?? 0;
        const before = mx.townsIn(desc).filter((t) => t.pos <= cue);
        if (before.length) node = before[before.length - 1].node;
      }
      if (!node) {                                        // title destination
        const parts = title.split(/\s*[–—:|]\s*|\s+-\s+/);
        for (const p of parts) { const t = mx.townsIn(p); if (t.length) node = t[t.length - 1].node; }
      }
      if (!node) { const t = mx.townsIn(desc, false); if (t.length) node = t[t.length - 1].node; }
    }
    if (!node) { if (last) stops[stops.length - 1].nights += 1; continue; }
    if (last && node.id === last.id) stops[stops.length - 1].nights += 1;
    else { stops.push({ node, nights: 1 }); last = node; }
  }
  return stops.map((s) => ({ name: s.node.name, nights: s.nights }));
}

// ======================================================================================
async function main() {
  const dry = process.argv.includes('--dry');
  console.log(`C1 ingestion ${dry ? '(DRY RUN — no writes)' : '(LIVE)'} ...`);

  const tours = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, slug, title, "durationDays", "durationNights", "bestTime", "isActive" FROM tours`);
  const stays = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ts."tourId", ts."order", ts."wtiCityId", ts.nights, ts.source,
            sn.id AS node_id, sn.name, sn.state_name, sn.elevation_m
       FROM tour_stays ts LEFT JOIN stay_nodes sn ON sn.id = ts."wtiCityId"
      ORDER BY ts."tourId", ts."order"`);
  const itin = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "tourId", day, title, description FROM tour_itinerary ORDER BY "tourId", day`);
  const intent = await prisma.$queryRawUnsafe<any[]>(
    `SELECT city_id, chip, rank FROM intent_place`);
  const nodes = await prisma.$queryRawUnsafe<any[]>(`SELECT id, name FROM stay_nodes`);

  const tourById = new Map(tours.map((t) => [t.id, t]));
  const staysByTour = new Map<string, any[]>();
  for (const s of stays) { (staysByTour.get(s.tourId) ?? staysByTour.set(s.tourId, []).get(s.tourId)!).push(s); }
  const itinByTour = new Map<string, any[]>();
  for (const r of itin) { (itinByTour.get(r.tourId) ?? itinByTour.set(r.tourId, []).get(r.tourId)!).push(r); }
  const themesByNode = new Map<string, ThemeTag[]>();
  for (const r of intent) {
    const arr = themesByNode.get(r.city_id) ?? themesByNode.set(r.city_id, []).get(r.city_id)!;
    arr.push({ chip: r.chip, strength: Number(r.rank) === 1 ? 'anchor' : 'incidental' });
  }
  const mx = buildNameMatcher(nodes);

  // ---- build a branch-shape per tour ---------------------------------------------------
  interface TourBranch {
    tourId: string; slug: string; title: string;
    nodeIds: string[]; stops: RawStop[]; states: string[];
    entryRegion: string | null; exitRegion: string | null;
    seasonMask: number; bodyClass: string; chips: string[];
    totalNights: number; allAdmin: boolean; hash: string;
  }
  const built: TourBranch[] = [];
  let skippedUnresolved = 0, skippedNoStays = 0, skippedInactive = 0;
  for (const t of tours) {
    if (!t.isActive) { skippedInactive++; continue; }
    const rows = (staysByTour.get(t.id) ?? []).sort((a, b) => a.order - b.order);
    if (!rows.length) { skippedNoStays++; continue; }
    if (rows.some((r) => !r.node_id)) { skippedUnresolved++; continue; } // an unresolved stop → skip (flagged below)
    const stops: RawStop[] = rows.map((r) => ({
      nodeId: r.node_id, name: r.name, nights: Math.max(1, Number(r.nights) || 1),
      elevationM: r.elevation_m == null ? null : Number(r.elevation_m),
      themes: themesByNode.get(r.node_id) ?? [],
    }));
    const states = [...new Set(rows.map((r) => r.state_name).filter(Boolean))] as string[];
    const entryRegion = regionOf(rows[0].state_name);
    const exitRegion = regionOf(rows[rows.length - 1].state_name);
    const chips = deriveBranchChips(stops);
    const maxElev = Math.max(0, ...stops.map((s) => s.elevationM ?? 0));
    built.push({
      tourId: t.id, slug: t.slug, title: t.title,
      nodeIds: stops.map((s) => s.nodeId), stops, states,
      entryRegion, exitRegion,
      seasonMask: seasonMaskFromBestTime(t.bestTime),
      bodyClass: bodyClassFor(maxElev), chips,
      totalNights: stops.reduce((a, s) => a + s.nights, 0),
      allAdmin: rows.every((r) => r.source === 'admin'),
      hash: structHash(stops.map((s) => s.nodeId), entryRegion, exitRegion),
    });
  }

  // ---- dedup by structural hash → canonical branches -----------------------------------
  const groups = new Map<string, TourBranch[]>();
  for (const b of built) (groups.get(b.hash) ?? groups.set(b.hash, []).get(b.hash)!).push(b);

  interface Canonical {
    hash: string; rep: TourBranch; evidence: TourBranch[];
    nightsMin: number; nightsMax: number;
    perStopNights: { min: number; max: number }[];
    allAdmin: boolean; path: string | null;
  }
  const canon: Canonical[] = [];
  for (const [hash, ev] of groups) {
    // representative: prefer an admin-verified tour, else the shortest slug (the plainest name)
    const rep = ev.find((e) => e.allAdmin) ?? [...ev].sort((a, b) => a.slug.length - b.slug.length)[0];
    const nightsList = ev.map((e) => e.totalNights);
    const perStopNights = rep.stops.map((_, i) => {
      const ns = ev.map((e) => e.stops[i]?.nights ?? 1);
      return { min: Math.min(...ns), max: Math.max(...ns) };
    });
    canon.push({
      hash, rep, evidence: ev,
      nightsMin: Math.min(...nightsList), nightsMax: Math.max(...nightsList),
      perStopNights, allAdmin: ev.every((e) => e.allAdmin), path: null,
    });
  }

  // ---- ltree variant trees: a strict-prefix superset is a CHILD (§10.4) ----------------
  // label = a stable, ltree-safe token from the hash. parent = the longest other branch
  // whose full node sequence is a strict prefix of this one's.
  const labelOf = (c: Canonical) => 'b' + c.hash.slice(0, 16);
  const byLen = [...canon].sort((a, b) => a.rep.nodeIds.length - b.rep.nodeIds.length);
  const isPrefix = (p: string[], q: string[]) =>
    p.length < q.length && p.every((x, i) => x === q[i]);
  for (const c of canon) {
    let parent: Canonical | null = null;
    for (const other of byLen) {
      if (other === c) continue;
      if (isPrefix(other.rep.nodeIds, c.rep.nodeIds)) {
        if (!parent || other.rep.nodeIds.length > parent.rep.nodeIds.length) parent = other;
      }
    }
    c.path = parent ? `${labelOf(parent)}.${labelOf(c)}` : labelOf(c);
  }

  console.log(`built ${built.length} tour-branches → ${canon.length} canonical branches`);
  console.log(`  skipped: inactive=${skippedInactive} no_stays=${skippedNoStays} unresolved_stop=${skippedUnresolved}`);
  const variants = canon.filter((c) => c.path && c.path.includes('.')).length;
  console.log(`  variant (child) branches: ${variants}`);

  if (dry) {
    // show the acceptance branches
    for (const key of ['nau-devi-yatra', 'kerala', 'karnataka-heritage', 'bandhavgarh']) {
      const c = canon.find((x) => x.rep.slug.includes(key) || x.evidence.some((e) => e.slug.includes(key)));
      if (c) console.log(`  [${key}] ${c.rep.slug}: chips=${c.rep.chips.join('/')} region=${c.rep.entryRegion} nights=${c.nightsMin}-${c.nightsMax} states=${c.rep.states.join(',')} ev=${c.evidence.length}`);
    }
    await prisma.$disconnect(); return;
  }

  // ---- WRITE ---------------------------------------------------------------------------
  console.log('truncating library tables and rebuilding ...');
  await prisma.$executeRawUnsafe(`TRUNCATE branches CASCADE`);          // cascades stops/evidence/aliases
  await prisma.$executeRawUnsafe(`TRUNCATE itinerary_sources CASCADE`);
  await prisma.$executeRawUnsafe(`TRUNCATE tour_stays_review`);

  // sources (one per evidence tour)
  for (const b of built) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO itinerary_sources (operator, url, title, our_tour_id, license_class)
       VALUES ('WayToIndia', $1, $2, $3, 'ours')`,
      `waytoindia.com/${b.slug}`, b.title, b.tourId);
  }

  const circuitTourIds = new Set(NAMED_CIRCUITS.map((c) => c.tourId));
  let branchN = 0, stopN = 0, aliasN = 0, evN = 0;
  for (const c of canon) {
    const rep = c.rep;
    const needsReview = !c.allAdmin;
    const branchRows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO branches (label, struct_hash, entry_region, exit_region, states,
          nights_min, nights_max, chips, season_mask, body_class, evidence_count,
          our_tour_id, path, needs_review, verified_at, verified_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::ltree,$14,$15,$16)
       RETURNING id`,
      rep.title, c.hash, rep.entryRegion, rep.exitRegion, rep.states,
      c.nightsMin, c.nightsMax, rep.chips, rep.seasonMask, rep.bodyClass, c.evidence.length,
      rep.tourId, c.path, needsReview,
      c.allAdmin ? new Date() : null, c.allAdmin ? 'founder' : null);
    const branchId = String(branchRows[0].id);
    branchN++;

    const assigned = assignRoles(rep.stops, rep.chips);
    for (let i = 0; i < rep.stops.length; i++) {
      const s = rep.stops[i]; const a = assigned[i]; const ps = c.perStopNights[i];
      await prisma.$executeRawUnsafe(
        `INSERT INTO branch_stops (branch_id, ord, stay_node_id, nights_min, nights_max,
            role, night_class, themes, needs_review)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        branchId, i + 1, s.nodeId, ps.min, ps.max, a.role, a.nightClass,
        JSON.stringify(s.themes), needsReview);
      stopN++;
    }
    for (const e of c.evidence) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO branch_evidence (branch_id, our_tour_id, structural_similarity)
         VALUES ($1,$2,1.0) ON CONFLICT (branch_id, our_tour_id) DO NOTHING`, branchId, e.tourId);
      evN++;
    }
    // aliases from the title of each evidence tour (source='title'), plus the famous-circuit
    // keys where our_tour_id is one we sell (source='founder', approved — absorbs the registry).
    const aliasSeen = new Set<string>();
    for (const e of c.evidence) {
      const na = normAlias(e.title);
      if (na && !aliasSeen.has(na)) {
        aliasSeen.add(na);
        await prisma.$executeRawUnsafe(
          `INSERT INTO branch_aliases (alias, norm_alias, branch_id, source, approved)
           VALUES ($1,$2,$3,'title',false) ON CONFLICT (norm_alias, branch_id) DO NOTHING`,
          e.title, na, branchId);
        aliasN++;
      }
      if (circuitTourIds.has(e.tourId)) {
        const circ = NAMED_CIRCUITS.find((x) => x.tourId === e.tourId)!;
        const na2 = normAlias(circ.label);
        if (na2 && !aliasSeen.has(na2)) {
          aliasSeen.add(na2);
          await prisma.$executeRawUnsafe(
            `INSERT INTO branch_aliases (alias, norm_alias, branch_id, source, approved)
             VALUES ($1,$2,$3,'founder',true) ON CONFLICT (norm_alias, branch_id) DO NOTHING`,
            circ.label, na2, branchId);
          aliasN++;
        }
      }
    }
  }

  // ---- tour_stays_review — the sleep-event correction proposals -------------------------
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').replace(/h/g, '');
  let reviewN = 0, agreeN = 0;
  for (const b of built) {
    const days = itinByTour.get(b.tourId) ?? [];
    const cur = b.stops.map((s) => ({ name: s.name, nights: s.nights }));
    if (!days.length) continue;
    const parsed = parseSleepEvents(days, mx);
    const pT = parsed.map((p) => norm(p.name));
    const sT = cur.map((s) => norm(s.name));
    let delta: string; let conf: number;
    if (!parsed.length) { delta = 'unparsed'; conf = 0.2; }
    else if (pT.join('>') === sT.join('>')) {
      const nightsSame = parsed.map((p) => p.nights).join(',') === cur.map((s) => s.nights).join(',');
      if (nightsSame) { agreeN++; continue; }             // parse agrees fully — nothing to review
      delta = 'nights'; conf = 0.7;
    } else if (new Set(pT).size === new Set(sT).size && pT.every((x) => sT.includes(x))) {
      delta = 'order'; conf = 0.55;
    } else { delta = 'town_set'; conf = 0.6; }
    await prisma.$executeRawUnsafe(
      `INSERT INTO tour_stays_review (tour_id, proposed, current_stays, delta_kind, confidence, parser_note)
       VALUES ($1,$2::jsonb,$3::jsonb,$4,$5,$6)
       ON CONFLICT (tour_id) DO UPDATE SET proposed=EXCLUDED.proposed, current_stays=EXCLUDED.current_stays,
         delta_kind=EXCLUDED.delta_kind, confidence=EXCLUDED.confidence, parser_note=EXCLUDED.parser_note`,
      b.tourId, JSON.stringify(parsed), JSON.stringify(cur), delta, conf,
      `sleep-event parse of tour_itinerary; ${delta} differs from ai_backfill tour_stays`);
    reviewN++;
  }

  console.log(`WROTE: branches=${branchN} stops=${stopN} evidence=${evN} aliases=${aliasN}`);
  console.log(`REVIEW QUEUE: ${reviewN} proposals filed (${agreeN} tours already agree with tour_stays)`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
