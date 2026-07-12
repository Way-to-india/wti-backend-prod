/**
 * L7 — EXPLANATION ENGINE: decision records + per-leg option ledger. Spec §10.
 *
 * PURE + FACTS-ONLY. Given a leg's candidate options ALREADY RANKED by the same
 * DDCV objective the sequencer used (so `ranked[0]` IS the option the plan chose —
 * zero drift between "what we picked" and "what we say we picked"), this renders:
 *
 *   - `decisionRecord {winner, runnerUp, marginText, why}`  — the "Why this way?" note
 *   - `legOptions[] {id, dur, fare, freq, chosen, note}`    — every service compared
 *
 * ANTI-HALLUCINATION (founder-locked): every string here is derived
 * DETERMINISTICALLY from the option's OWN verified fields + its computed DDCV
 * vector. Nothing is invented — no train, fare, or time is asserted that the option
 * did not carry. The warm WTI-voice polish is the Sprint-5 narration AI rephrasing
 * THESE facts; it is never this file's job and this file never guesses.
 *
 * Additive + absent-safe: a leg with a single candidate emits a decisionRecord with
 * `runnerUp = null`; a leg with no candidates emits `{ legOptions: [] }` and no
 * record, so the UI's `WhyThisWay` renders nothing (Sprint-3-safe).
 */

import type { LegOption, DecisionRecord, LegOptionRow, Mode } from './types';
import { ddcv, spokenClock, type DDCV, type LegCtx, type Weights } from './ddcv';
import { indicativeFarePp } from './ddcv';
import { isTrueOvernight, toMin } from './constraints';
import { freqLabel } from './dayExpand';

export interface LegExplain {
  decisionRecord?: DecisionRecord;
  legOptions: LegOptionRow[];
}

// =============================================================================
// US-606/608 — LAW 5: A REJECTED OPTION MUST BE REJECTED FOR A HUMAN REASON.
//
//   "Today the engine tells him it rejected a train because another was cheaper. That
//    is THE ENGINE'S reason. He needs HIS OWN reason:
//        ✗ Netravathi Express — nine hours, and it puts you in Goa at 03:50 in the morning.
//    Not:
//        ✗ rejected — higher cost score."
//
// The rejected-options list is the most trust-building thing on the page. It must speak
// like the consultant, or it is worse than nothing.
//
// These reasons are composed AT THE MOMENT OF REJECTION (consultant.ts), where the
// knowledge lives — never reconstructed afterwards from a score.
// =============================================================================

/** Why an option left the running. The cause carries the FACTS; sayRejection says them. */
export type RejectionCause =
  | { kind: 'refused_mode'; mode: Mode; quote?: string }
  | { kind: 'dead_hours' }
  | { kind: 'ceiling'; ceiling: number; ordeal: number; qualified: 'long' | 'any'; quote?: string }
  | { kind: 'body'; reasons: string[] }
  | { kind: 'lost'; winner: string };

const NUM = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/**
 * Minutes → the way a person actually says it. "nine hours". "about three and a half
 * hours". Never "540 min", never "9.0h". A number a traveller has to decode is a number
 * he does not feel.
 */
export function spokenDuration(min: number | null | undefined): string | null {
  if (min == null || !Number.isFinite(min) || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const half = m >= 20 && m <= 40;
  const roundish = m < 20 || m > 40;

  if (h === 0) return `about ${Math.round(min / 5) * 5} minutes`;
  if (h === 1 && half) return 'about an hour and a half';
  if (h === 1) return 'about an hour';
  const word = NUM[h] ?? String(h);
  if (half) return `about ${word} and a half hours`;
  // 5 h 50 m reads as "about six hours" — rounding UP is the honest direction here,
  // because a journey never gets shorter than the timetable says.
  const hh = m > 40 ? h + 1 : h;
  return roundish ? `${NUM[hh] ?? String(hh)} hours` : `${word} hours`;
}

/** What we call this service, out loud. */
export function spokenLabel(o: LegOption): string {
  if (o.identifier) return o.identifier;
  if (o.mode === 'ROAD') return `Driving straight to ${o.to}`;
  if (o.mode === 'AIR') return `The flight to ${o.to}`;
  if (o.mode === 'RAIL') return `The train to ${o.to}`;
  if (o.mode === 'FERRY') return `The ferry to ${o.to}`;
  return `The journey to ${o.to}`;
}

/** The clock problem, in human words — "it puts you in Goa at 3:50 in the morning". */
export function clockProblem(o: LegOption): string | null {
  const arr = toMin(o.arrTime ?? null);
  if (arr == null) return null;
  const m = ((arr % 1440) + 1440) % 1440;
  if (m >= 23 * 60) return `it gets you in to ${o.to} at ${spokenClock(m)} at night`;
  if (m < 7 * 60) return `it puts you in ${o.to} at ${spokenClock(m)} in the morning`;
  return null;
}

/**
 * THE TEMPLATE (spec 5.2):
 *   "{name} — {duration in words}{, and it {clock problem}}{, which you asked us to avoid}."
 *
 * Composition rules, all of them load-bearing:
 *   - the duration comes from the option's own honest door-to-door minutes;
 *   - the clock problem comes from its own arrival time;
 *   - the refusal clause appears ONLY when it was HIS word that did the rejecting, and it
 *     is his word we cite;
 *   - THE FARE NEVER APPEARS. No price on the public planner — that is the law, and a
 *     rejection that says "it costs more" is the engine's reason, not the traveller's.
 */
export function sayRejection(o: LegOption, cause: RejectionCause, doorToDoorMin?: number | null): string {
  const name = spokenLabel(o);
  const dur = spokenDuration(doorToDoorMin ?? o.durationMin ?? null);
  const clock = clockProblem(o);

  switch (cause.kind) {
    case 'body':
      // The body's own refusal. It is not a preference and it is not negotiable, so we say
      // it plainly and we do not dress it up.
      return `${name} — this one is too hard on your party: ${cause.reasons[0] ?? 'it is beyond what this journey should ask of you'}.`;

    case 'dead_hours': {
      const bits = [dur, clock].filter(Boolean);
      return `${name} — ${bits.join(', and ')}.`;
    }

    case 'refused_mode':
      return `${name} — you asked us not to travel by ${modeSpoken(cause.mode)}, so we have kept it off your plan.`;

    case 'ceiling': {
      const bits: string[] = [];
      if (dur) bits.push(o.mode === 'ROAD' ? `${dur} on the road` : dur);
      if (clock) bits.push(`and it ${clock}`);
      const tail = cause.qualified === 'long' ? ', which you asked us to avoid' : '';
      return `${name} — ${bits.join(', ')}${tail}.`;
    }

    case 'lost':
    default: {
      const bits = [dur, clock].filter(Boolean);
      return bits.length ? `${name} — ${bits.join(', and ')}.` : `${name}.`;
    }
  }
}

function modeSpoken(m: Mode): string {
  switch (m) {
    case 'RAIL': return 'train';
    case 'ROAD': return 'road';
    case 'AIR': return 'air';
    case 'FERRY': return 'ferry';
    default: return 'this way';
  }
}

// ---- labels (facts only) -----------------------------------------------------

function modeWord(o: LegOption): string {
  if (o.mode === 'AIR') return 'Flight';
  if (o.mode === 'RAIL') return isTrueOvernight(o) ? 'Overnight train' : 'Train';
  if (o.mode === 'FERRY') return 'Ferry';
  return 'Road transfer';
}

function classTag(o: LegOption): string {
  if (o.mode === 'RAIL' && o.classes && o.classes.length) return ` (${o.classes[0]})`;
  return '';
}

/** Human label for one option: mode + identifier + class floor. Verified fields only. */
export function optionLabel(o: LegOption): string {
  const id = o.identifier ? ` ${o.identifier}` : '';
  return `${modeWord(o)}${id}${classTag(o)}`.trim();
}

// ---- one compared row --------------------------------------------------------

/** Honest door-to-door minutes from the DDCV T (hotel A → hotel B, all buffers). */
function doorToDoorMin(v: DDCV): number | null {
  return Number.isFinite(v.T) ? Math.round(v.T * 60) : null;
}

function farePpMid(o: LegOption): number {
  if (o.farePpMin != null && o.farePpMax != null) return Math.round((o.farePpMin + o.farePpMax) / 2);
  return indicativeFarePp(o);
}

function rowNote(o: LegOption, v: DDCV): string | undefined {
  const bits: string[] = [];
  if (isTrueOvernight(o)) bits.push('overnight — saves a hotel night');
  if (o.viaNode) bits.push(`via ${o.viaNode}${o.onwardRoadKm ? ` + ${Math.round(o.onwardRoadKm)} km road` : ''}`);
  if ((o.reliability != null && o.reliability <= 2) || o.seasonal) bits.push('verify at booking');
  if (v.hardBlock) bits.push('not usable for this party');
  return bits.length ? bits.join('; ') : undefined;
}

function rowOf(o: LegOption, v: DDCV, chosen: boolean): LegOptionRow {
  return {
    id: o.id ?? `${o.mode}:${o.identifier ?? `${o.from}-${o.to}`}`,
    dur: doorToDoorMin(v),
    fare: farePpMid(o),
    freq: o.mode !== 'ROAD' ? freqLabel(o.operatingDays) : 'daily',
    chosen,
    note: rowNote(o, v),
  };
}

// ---- the decision record -----------------------------------------------------

const round1 = (x: number) => Math.round(x * 10) / 10;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function fmtHrs(h: number): string {
  const H = Math.floor(h);
  const M = Math.round((h - H) * 60);
  if (H <= 0) return `${M} min`;
  return M ? `${H}h${String(M).padStart(2, '0')}` : `${H}h`;
}

function inr(n: number): string {
  return `₹${Math.abs(n).toLocaleString('en-IN')}`;
}

/** The plain-voice reason the winner won — one honest line, chosen deterministically. */
function whyLine(
  winner: LegOption, runnerUp: LegOption,
  d: { dHours: number; dMoneyPp: number; dPhi: number },
): string {
  // overnight rail beats a daytime option → the clock-quality truth (§4.1 q-term)
  if (isTrueOvernight(winner) && !isTrueOvernight(runnerUp)) {
    return 'The overnight train travels while you sleep, so no daylight is spent moving and you save a hotel night.';
  }
  // a ground option beats a flight on door-to-door truth (§4.5 airport-as-via-node)
  if (runnerUp.mode === 'AIR' && winner.mode !== 'AIR' && d.dHours >= 0) {
    return 'The flight looks faster in the air, but airport access and check-in make it slower door-to-door on this leg.';
  }
  // the flight genuinely wins the band on door-to-door hours
  if (winner.mode === 'AIR' && d.dHours >= 1.5) {
    return 'Flying saves several hours door-to-door here, and both airports are close enough to be worth it.';
  }
  if (d.dHours >= 0.5) return 'It is the fastest honest door-to-door option for this leg.';
  if (d.dMoneyPp >= 500) return 'It costs less for a comparable ride on this leg.';
  if (d.dPhi >= 0.4) return 'It is the easier ride for this party on this leg.';
  return 'It is the best balance of time, cost and comfort on this leg.';
}

function soloWhy(o: LegOption): string {
  if (isTrueOvernight(o)) return 'The overnight train is the one service that fits this leg — you travel by night and save a hotel night.';
  if (o.mode === 'AIR') return 'Flying is the only practical way to cover this leg in a day.';
  if (o.mode === 'RAIL') return 'This train is the service that fits this leg.';
  if (o.mode === 'FERRY') return 'The ferry is the way across on this leg.';
  return 'A road transfer is the practical way to cover this leg.';
}

function decisionRecordFor(
  winner: LegOption, wv: DDCV,
  runnerUp: LegOption | null, rv: DDCV | null,
  pax: number,
): DecisionRecord {
  const winLabel = optionLabel(winner);
  if (!runnerUp || !rv) {
    return { winner: winLabel, runnerUp: null, marginText: 'Only viable service on this leg.', why: soloWhy(winner) };
  }
  const ruLabel = optionLabel(runnerUp);
  const finite = Number.isFinite(wv.T) && Number.isFinite(rv.T);
  const dHours = finite ? round1(rv.T - wv.T) : 0;             // + = winner faster door-to-door
  const dMoneyPp = Math.round((rv.M - wv.M) / Math.max(1, pax)); // + = winner cheaper per person
  const dPhi = round1(rv.Phi - wv.Phi);                         // + = winner easier

  // comparative clauses read "... than the runner-up"; trailing clauses stand alone
  // ("... and it saves a hotel night") so the two never collide grammatically.
  const comparative: string[] = [];
  if (dHours >= 0.3) comparative.push(`about ${fmtHrs(dHours)} quicker door-to-door`);
  else if (dHours <= -0.3) comparative.push(`about ${fmtHrs(-dHours)} longer door-to-door`);
  if (dMoneyPp >= 200) comparative.push(`${inr(dMoneyPp)}/person cheaper`);
  else if (dMoneyPp <= -200) comparative.push(`${inr(-dMoneyPp)}/person more`);

  const trailing: string[] = [];
  if (isTrueOvernight(winner) && !isTrueOvernight(runnerUp)) trailing.push('saves a hotel night');
  else if (dPhi >= 0.4) trailing.push('is the easier ride');

  let marginText: string;
  if (comparative.length) {
    marginText = `${cap(comparative.join(', '))} than the ${ruLabel.toLowerCase()}`;
    if (trailing.length) marginText += `, and it ${trailing.join(' and ')}`;
    marginText += '.';
  } else if (trailing.length) {
    marginText = `Chosen because it ${trailing.join(' and ')}, where the ${ruLabel.toLowerCase()} does not.`;
  } else {
    marginText = `A close call with the ${ruLabel.toLowerCase()}; chosen on balance.`;
  }

  return { winner: winLabel, runnerUp: ruLabel, marginText, why: whyLine(winner, runnerUp, { dHours, dMoneyPp, dPhi }) };
}

// ---- public entry ------------------------------------------------------------

/**
 * Build the decision record + legOptions ledger for one leg.
 *
 * @param ranked  candidate options for this leg, ALREADY SORTED best→worst by the
 *                caller under the SAME objective the sequencer used (ranked[0] is
 *                the chosen option — do NOT re-sort here, that guarantees the record
 *                names the option the plan actually took).
 * @param ctxOf   per-option LegCtx builder (the same one optimize.legCtx uses, so
 *                access hours / far-airport reality match the engine's own costing).
 * @param w       weight vector under which the leg was scored (objective prior; TPP
 *                modulation is Sprint 4 and rescales this upstream — nothing here changes).
 */
export function buildLegExplain(
  ranked: LegOption[], ctxOf: (o: LegOption) => LegCtx, w: Weights,
): LegExplain {
  void w; // weights are already baked into `ranked`'s order; retained for signature stability
  if (!ranked.length) return { legOptions: [] };

  const vecs = ranked.map((o) => ddcv(o, ctxOf(o)));
  const legOptions = ranked.map((o, i) => rowOf(o, vecs[i], i === 0));

  const winner = ranked[0], wv = vecs[0];
  const runnerUp = ranked.length > 1 ? ranked[1] : null;
  const rv = runnerUp ? vecs[1] : null;
  const pax = Math.max(1, ctxOf(winner).pax ?? 1);

  return { decisionRecord: decisionRecordFor(winner, wv, runnerUp, rv, pax), legOptions };
}
