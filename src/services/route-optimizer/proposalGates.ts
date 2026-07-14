/**
 * US-840 — THE FOUR GATES. A cluster is not valid because it is popular; it is valid
 * because HE can do it: in his days, from his door, in his month, with his body.
 *
 *   1. DAYS    — does it fit the days he has? A 12-day Char Dham shown to a man with
 *                5 days is an insult.
 *   2. ORIGIN  — is it honestly reachable from where he starts, in his days?
 *   3. SEASON  — Char Dham is SHUT in winter. We hold the month and we never used it here.
 *   4. BODY    — Kedarnath is a 16 km mountain trek. Offering it to a 68-year-old who
 *                wrote "cannot walk very far" is a SAFETY defect, not a UX one.
 *
 * PURE. No DB, no network, no clock. The controller injects every fact (season rows,
 * access rows, entry estimates, elevations) — same doctrine as designer.ts. Every fact a
 * gate speaks carries its receipt; a fact we do not hold gates NOTHING (an honest silence,
 * never an invented season).
 *
 * DIRECTION-OF-ERROR DOCTRINE (lesson 3, paid for at Gangotri): the DAYS gate uses a LOWER
 * bound on travel time, so it can only be too LENIENT — it may pass a circuit the real
 * sequencer later refuses, but it can never kill a feasible trip. Too-hard is survivable;
 * too-easy is not — and here "too easy" would mean refusing him a holiday he could have had,
 * which is the survivable direction for a SHORTLIST (step 5 remains the final proof).
 */
import type { Proposal, Rejection } from './designer';
import { haversineKm } from './geo';

export type LatLng = [number, number];

export interface SeasonFact {
  place: string;                                   // matches a stop name, case-insensitive
  kind: 'closed' | 'yatra_window' | 'advisory';
  months: number[];                                // the months the KIND applies to
  note: string;                                    // the sentence he reads
}

export interface AccessFact {
  place: string;
  access: 'road' | 'steps' | 'trek' | 'climb' | 'ropeway';
  magnitude: string | null;                        // "16 km trek from Gaurikund"
  note: string;
}

export interface EntryFact {
  hours: number;                                   // honest ESTIMATE, one way
  how: 'AIR' | 'RAIL' | 'ROAD';
  basis: string;                                   // the receipt ("scheduled sector Lucknow → Dehradun exists")
}

export interface GateFacts {
  nightsCeiling: number;
  month: number | null;
  profile: 'standard' | 'family' | 'senior';
  coords: Map<string, LatLng>;                     // lower(stop name) → coord
  elevations: Record<string, number>;              // lower(name) → metres
  seasons: SeasonFact[];
  access: AccessFact[];
  /** entry from HIS origin, keyed by lower(first-stop name). Absent = unknown = no gate. */
  entry: Map<string, EntryFact | null>;
  originName: string | null;
}

export interface GateVerdict {
  days: 'pass' | 'fail';
  origin: 'pass' | 'fail' | 'unknown';
  season: 'pass' | 'advisory' | 'fail' | 'unknown';
  body: 'pass' | 'advisory';
}

export interface GatedProposal {
  proposal: Proposal;
  gates: GateVerdict;
  gateNotes: string[];
}

export interface RefusedProposal {
  proposal: Proposal;
  gate: keyof GateVerdict;
  reason: string;
}

/** Upper honest speed for the LOWER-bound travel estimate. Any real journey is slower door
 *  to door, so hours computed at this speed UNDERSTATE the journey — the only direction a
 *  shortlist gate is allowed to be wrong in. */
const LB_SPEED_KMH = 70;
/** A comfortable travelling day, hours. Generous for the same reason. */
const LB_DAY_HRS = 8;
/** Entry + exit may not eat more than this share of his trip. A judgement, written down. */
const ENTRY_SHARE_MAX = 0.4;
/** Above this, a senior party gets an altitude advisory with the metres named. */
const SENIOR_ALTITUDE_ADVISORY_M = 2700;

const low = (s: string) => s.trim().toLowerCase();

/** Greedy nearest-neighbour chain over the stops — a LOWER bound on internal road time. */
export function internalTravelDaysLowerBound(stopNames: string[], coords: Map<string, LatLng>): number {
  const pts = stopNames.map((n) => coords.get(low(n))).filter((c): c is LatLng => !!c);
  if (pts.length < 2) return 0;
  const left = pts.slice(1);
  let cur = pts[0], km = 0;
  while (left.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d = haversineKm(cur, left[i]);
      if (d < bd) { bd = d; bi = i; }
    }
    km += bd; cur = left.splice(bi, 1)[0];
  }
  return Math.floor(km / LB_SPEED_KMH / LB_DAY_HRS);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Run the four gates over the Designer's proposals. Order preserved for those that pass;
 * every refusal carries the finding, the reason and (where one exists) the alternative —
 * Law 4, all three, every time. The BODY gate may REMOVE a stop (and say so) rather than
 * kill a circuit that survives without it.
 */
export function gateProposals(proposals: Proposal[], facts: GateFacts, opts: { bodyEdits?: boolean } = {}): { offered: GatedProposal[]; refused: RefusedProposal[] } {
  const offered: GatedProposal[] = [];
  const refused: RefusedProposal[] = [];
  // US-853 — a NAMED, SOLD tour is advised, never silently edited: with bodyEdits false
  // the body gate speaks (advisory, magnitude named, alternatives offered) but does not
  // remove a stop from a product our designers built.
  const mayEdit = opts.bodyEdits !== false;

  for (const original of proposals) {
    // work on a copy — the body gate may edit the stops, and the caller's array is not ours.
    const p: Proposal = { ...original, stops: original.stops.map((s) => ({ ...s })), rejected: [...original.rejected] };
    const notes: string[] = [];
    const verdict: GateVerdict = { days: 'pass', origin: 'unknown', season: 'unknown', body: 'pass' };
    let refusal: RefusedProposal | null = null;

    // ---- GATE 4 FIRST IN CODE (it edits the stops the other gates then measure) --------
    // BODY — the safety gate. A senior (or a party that told us walking is hard — which
    // compiles to profile 'senior') is never offered a trek/climb shrine as a stop.
    if (facts.profile === 'senior') {
      for (const stop of [...p.stops]) {
        const acc = facts.access.find((a) => low(a.place) === low(stop.name));
        if (acc && (acc.access === 'trek' || acc.access === 'climb')) {
          if (!mayEdit) {
            // Advise, do not edit: the stop stays, the truth is said, and the choice is his.
            verdict.body = 'advisory';
            notes.push(`${stop.name} is reached by ${acc.magnitude ?? 'a long mountain trek'} — ${acc.note} `
              + 'Tell me plainly if walking far is hard, and I will re-plan this part rather than put you on that path.');
          } else if (p.stops.length >= 2) {
            p.stops = p.stops.filter((s) => s !== stop);
            const rej: Rejection = {
              name: stop.name, state: stop.state,
              reason: `${stop.name} is reached by a ${acc.magnitude ?? 'long mountain trek'} — ${acc.note} `
                + 'I have taken it out and built the trip around what your body will thank you for. '
                + 'If you have something like the helicopter service in mind, tell me and I will check it properly rather than promise it here.',
            };
            p.rejected = [rej, ...p.rejected];
            verdict.body = 'advisory';
            notes.push(`We left out ${stop.name}: ${acc.magnitude ?? 'a hard trek'} is not a journey we would put you on.`);
          } else {
            refusal = {
              proposal: original, gate: 'body',
              reason: `${stop.name} is reached by a ${acc.magnitude ?? 'long mountain trek'} — ${acc.note} `
                + 'That is the whole of this trip, so I will not offer it to you. Tell me and I will find you a journey your body will enjoy.',
            };
          }
        } else if (acc && acc.access === 'steps' && !refusal) {
          verdict.body = 'advisory';
          notes.push(`${stop.name} is climbed by ${acc.magnitude ?? 'a long stairway'} — ${acc.note}`);
        }
      }
      if (!refusal) {
        for (const stop of p.stops) {
          const elev = facts.elevations[low(stop.name)];
          if (elev != null && elev >= SENIOR_ALTITUDE_ADVISORY_M) {
            verdict.body = 'advisory';
            notes.push(`${stop.name} sits at about ${Math.round(elev)} m. We plan gentle days and a proper night's rest on the way up — altitude is respected, never raced.`);
          }
        }
      }
    }
    if (refusal) { refused.push(refusal); continue; }

    // recompute nights after any body-gate removal
    p.totalNights = p.stops.reduce((s, x) => s + x.nights, 0);

    // ---- GATE 1 — DAYS ------------------------------------------------------------------
    const travelDays = internalTravelDaysLowerBound(p.stops.map((s) => s.name), facts.coords);
    const need = p.totalNights + travelDays;
    if (need > facts.nightsCeiling) {
      refused.push({
        proposal: original, gate: 'days',
        reason: `This circuit needs at least ${need} nights even moving briskly — `
          + `${p.totalNights} nights of stay and the road between the towns. You have ${facts.nightsCeiling}. `
          + 'I will not compress it and call that a holiday. Say the word and I will build the shorter, honest version instead.',
      });
      continue;
    }
    verdict.days = 'pass';

    // ---- GATE 2 — ORIGIN ----------------------------------------------------------------
    const anchorName = p.stops[0]?.name ?? null;
    const entry = anchorName ? facts.entry.get(low(anchorName)) ?? null : null;
    if (entry) {
      const tripHours = facts.nightsCeiling * LB_DAY_HRS;
      if (2 * entry.hours > ENTRY_SHARE_MAX * tripHours) {
        refused.push({
          proposal: original, gate: 'origin',
          reason: `From ${facts.originName ?? 'where you start'}, just getting to ${anchorName} and back would take `
            + `about ${Math.round(2 * entry.hours)} hours of travel — too big a bite out of the ${facts.nightsCeiling} `
            + 'days you have. I would rather give you a trip you can actually enjoy than one you spend in transit.',
        });
        continue;
      }
      verdict.origin = 'pass';
    }

    // ---- GATE 3 — SEASON ----------------------------------------------------------------
    if (facts.month != null) {
      let seasonFail: string | null = null;
      for (const stop of p.stops) {
        const rows = facts.seasons.filter((s) => low(s.place) === low(stop.name));
        for (const s of rows) {
          const inMonths = s.months.includes(facts.month);
          if (s.kind === 'closed' && inMonths) {
            seasonFail = `${stop.name} is closed in ${MONTHS[facts.month - 1]} — ${s.note}`;
          } else if (s.kind === 'yatra_window' && !inMonths) {
            seasonFail = `${stop.name} is only open in its yatra window (${s.months.map((m) => MONTHS[m - 1]).join(', ')}) — ${s.note}`;
          } else if (s.kind === 'advisory' && inMonths) {
            verdict.season = 'advisory';
            notes.push(`${stop.name} in ${MONTHS[facts.month - 1]}: ${s.note}`);
          }
        }
        if (seasonFail) break;
      }
      if (seasonFail) {
        refused.push({
          proposal: original, gate: 'season',
          reason: `${seasonFail} That is the place's own calendar, not our preference. Tell me your month is flexible, or let me build you what ${MONTHS[facts.month - 1]} is actually good for.`,
        });
        continue;
      }
      if (verdict.season === 'unknown') verdict.season = 'pass';
    } else if (p.stops.some((st) => facts.seasons.some((s) => low(s.place) === low(st.name)))) {
      // He gave no month and this circuit HAS a season. Do not guess — flag that the month
      // question matters more than usual for this trip. (The counter-question machinery
      // already asks it; this note says why.)
      notes.push('This trip has a real season. Tell us your month and we will confirm the temples and roads are open.');
    }

    offered.push({ proposal: p, gates: verdict, gateNotes: notes });
  }

  return { offered, refused };
}

// ---- the transport SHAPE — honest at this stage, and it says so -----------------------------

export interface TransportShape {
  in: { kind: 'AIR' | 'RAIL' | 'ROAD'; at: string | null; basis: string };
  within: 'ROAD';
  provisional: true;
  note: string;
}

/**
 * What we may honestly show BEFORE anything is sequenced: a shape built from EXISTENCE
 * facts (a scheduled sector exists; the railhead passed the rail gate), with the deferral
 * said in words he reads. No service identifiers, no durations, no times — those belong to
 * step 5, where a source confirms them.
 */
export function buildShape(entry: EntryFact | null, gateway: Proposal['gateway']): TransportShape {
  const note = 'We will confirm the exact flights and trains once you choose this trip.';
  if (entry?.how === 'AIR') {
    return { in: { kind: 'AIR', at: null, basis: entry.basis }, within: 'ROAD', provisional: true, note };
  }
  if (gateway && gateway.kind === 'rail') {
    return {
      in: { kind: 'RAIL', at: gateway.name, basis: `${gateway.name} has ${gateway.services} real train services` },
      within: 'ROAD', provisional: true, note,
    };
  }
  if (entry) {
    return { in: { kind: entry.how, at: null, basis: entry.basis }, within: 'ROAD', provisional: true, note };
  }
  return { in: { kind: 'ROAD', at: null, basis: 'we have not yet measured a better way in' }, within: 'ROAD', provisional: true, note };
}
