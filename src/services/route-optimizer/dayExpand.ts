/**
 * Stage E — Day expansion + hard-constraint check.
 *
 * Walks the chosen sequence and the chosen leg option per consecutive pair, keeps
 * a running clock, and produces day-by-day items + typed plan legs with:
 *   - true-overnight classification (Sabarmati rule)
 *   - gate / daylight feasibility (Mannanur rule) → violations reject the day
 *   - positioning-drive disclosure (road-to-gateway with 0 nights)
 *   - road-leg split suggestion when a leg exceeds maxRoadKmDay
 *   - weekday stamping once the Day-1 weekday is known
 *
 * Same-day chaining: consecutive legs where the intermediate city has 0 nights
 * (a pure transit/gateway hop, e.g. drive-to-airport → fly) run on ONE calendar
 * day and share the clock — this is what lets the flight-then-drive gate trap be
 * detected (arrival 17:55 + 213 km drive → gate reached ~23:55).
 */

import type { DayItem, LegOption, PlanLeg, CityNode, GroupProfile, Weekday } from './types';
import { WEEKDAY_NAMES } from './types';
import { isTrueOvernight, gateArrivalFeasible, gateReachMin, toMin, fmtMin } from './constraints';
import { toleranceForProfile, roadDayHardCapExceeded } from './physiology';
import { chooseAnchor, type AnchorCandidate } from './anchors';

const DOW_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function freqLabel(bits?: number): string {
  if (bits == null || bits === 127) return 'daily';
  const days = DOW_SHORT.filter((_, i) => bits & (1 << i));
  return days.length ? `${days.join(', ')} only` : 'daily';
}

const DEFAULT_DEPART_MIN = 7 * 60; // 07:00 default coach departure
const TRANSFER_BUFFER_MIN = 60; // vehicle↔airport/station handling between chained legs
const DEFAULT_MAX_KM = 350;
const SENIOR_MAX_KM = 300;

export interface ExpandInput {
  sequence: string[]; // city names in visiting order
  nights: Map<string, number>; // name → nights (0 = pass-through/gateway)
  nodes: Map<string, CityNode>; // name → node (for constraints/profile)
  chosen: Map<string, LegOption>; // "from||to" → chosen option
  profile: GroupProfile;
  maxRoadKmDay?: number;
  startWeekday?: Weekday | null; // once the lock is known, stamp weekdays
  haltNames?: Set<string>; // cities that are inserted en-route overnight halts
  month?: number; // seasonality for terrain speed (monsoon ghat slow-down)
  /** §4.4 candidate anchors per leg key (from||to), injected by the controller.
   *  Optional + graceful: absent = no pearl-split reasoning, behaviour unchanged. */
  anchorsByLeg?: Map<string, AnchorCandidate[]>;
  /** US-608 — false when the traveller's contract switched the hotel-night reward off. We
   *  then stop CONGRATULATING him on a saving he never asked for. The train, if he is on one
   *  at all, is described; it is not praised. */
  praiseHotelNight?: boolean;
}

export interface ExpandOutput {
  legs: PlanLeg[];
  days: DayItem[];
  warnings: string[];
  /** true if any day carried a hard-constraint violation (plan should be rejected/rerouted). */
  infeasible: boolean;
}

const legKey = (a: string, b: string) => `${a}||${b}`;
const modeToMap = (m: LegOption['mode']): 'road' | 'flight' | 'train' | 'ferry' =>
  m === 'AIR' ? 'flight' : m === 'RAIL' ? 'train' : m === 'FERRY' ? 'ferry' : 'road';

function inboundConstraints(node: CityNode | undefined) {
  return (node?.profile?.constraints ?? []);
}

export function expandDays(inp: ExpandInput): ExpandOutput {
  const maxKm = inp.maxRoadKmDay ?? (inp.profile === 'senior' ? SENIOR_MAX_KM : DEFAULT_MAX_KM);
  const tol = toleranceForProfile(inp.profile); // §3 body-truth party tolerance
  const legs: PlanLeg[] = [];
  const days: DayItem[] = [];
  const warnings: string[] = [];
  let infeasible = false;

  const stamp = (dayIdx: number): string | null =>
    inp.startWeekday != null ? WEEKDAY_NAMES[((inp.startWeekday + dayIdx) % 7) as Weekday] : null;

  let dayIdx = 0; // Day-1 = index 0
  let clock = DEFAULT_DEPART_MIN;

  // First city — arrival + its sightseeing nights.
  const first = inp.sequence[0];
  if (first) {
    const n = inp.nights.get(first) ?? 1;
    days.push({ day: dayIdx + 1, weekday: stamp(dayIdx), city: first, activity: `Arrive ${first}${n ? ' — sightseeing' : ''}`, transit: null, roadKm: 0, transitMin: 0 });
    for (let k = 1; k < Math.max(1, n); k++) {
      dayIdx++;
      days.push({ day: dayIdx + 1, weekday: stamp(dayIdx), city: first, activity: `${first} — full day`, transit: null, roadKm: 0, transitMin: 0 });
    }
  }

  for (let i = 1; i < inp.sequence.length; i++) {
    const from = inp.sequence[i - 1];
    const to = inp.sequence[i];
    const opt = inp.chosen.get(legKey(from, to));
    const toNode = inp.nodes.get(to);
    const nightsAtTo = inp.nights.get(to) ?? 1;

    if (!opt) {
      // no curated option and no road fallback resolved — surface as VERIFY
      legs.push({ from, to, mode: 'ROAD', identifier: null, verifyFlag: true, note: 'VERIFY — no curated option; treat as road and confirm.' });
      dayIdx++;
      days.push({ day: dayIdx + 1, weekday: stamp(dayIdx), city: to, activity: `Travel ${from} → ${to} (verify)`, transit: { from, to, mode: 'ROAD' }, roadKm: 0, transitMin: 0 });
      continue;
    }

    const mapMode = modeToMap(opt.mode);
    const overnight = isTrueOvernight(opt);
    const durationMin = opt.durationMin ?? 0;
    const km = opt.distanceKm ?? 0;

    // departure clock: explicit dep time wins; else continue the running clock (same-day chain).
    const startedFreshDay = (inp.nights.get(from) ?? 1) > 0; // we spent a night at `from`
    if (startedFreshDay) clock = DEFAULT_DEPART_MIN;
    const dep = toMin(opt.depTime ?? null) ?? clock;
    const arr = toMin(opt.arrTime ?? null) ?? dep + durationMin;

    // positioning drive: road leg into a 0-night gateway (exists only to reach onward transport)
    const positioning = opt.mode === 'ROAD' && nightsAtTo === 0;

    // ---- hard-constraint check: gates / daylight on the inbound corridor to `to`
    const violations: string[] = [];
    for (const c of inboundConstraints(toNode)) {
      if (c.kind === 'gate') {
        // clock at which the group reaches the gate = arrival at approach + onward drive.
        // For a chained flight→drive, `clock` already holds the preceding flight's arrival.
        const reach = gateReachMin(dep, durationMin) % 1440;
        const res = gateArrivalFeasible(reach, c);
        if (!res.ok) violations.push(res.reason || `${c.name}: gate window violated`);
      } else if (c.kind === 'daylight') {
        const arrClock = arr % 1440;
        if (arrClock >= 18 * 60 || arrClock < 6 * 60) {
          violations.push(`${c.name}: ${fmtMin(arrClock)} arrival breaks the daylight-only corridor rule (06:00–18:00).`);
        }
      }
    }
    // ---- body-truth HOUR cap (spec §3): terrain-adjusted vehicle-hours, not km.
    // The 350 km/day rule is now a derived special case; a hill/ghat corridor can
    // breach the party cap at a small km figure and MUST be refused as one road day.
    if (opt.mode === 'ROAD') {
      const cap = roadDayHardCapExceeded(opt, tol, { month: inp.month });
      if (cap.exceeded) violations.push(`${from} → ${to}: ${cap.hrs.toFixed(1)} h in-vehicle exceeds the ${cap.capHrs} h/day cap for a ${tol.cls} party — split via an en-route anchor or move to rail/air.`);
    }
    // §4.4 pearl-on-the-string: an over-cap ROAD leg should be split at a worthy
    // anchor (value ≥ ½ day, detour ≤ 15%, both halves within cap). No anchor => dead
    // halt, prefer re-sequencing. Graceful: only runs when candidates were injected.
    let pearlSplit: { anchor: string; detourPct: number; subHrs?: [number, number]; why?: string | null } | undefined;
    let deadHalt = false;
    if (opt.mode === 'ROAD' && roadDayHardCapExceeded(opt, tol, { month: inp.month }).exceeded) {
      const cands = inp.anchorsByLeg?.get(legKey(from, to));
      const fc = inp.nodes.get(from)?.coord, tc = inp.nodes.get(to)?.coord;
      if (cands && cands.length && fc && tc) {
        const ch = chooseAnchor(fc, tc, cands, tol, { month: inp.month });
        if (ch.deadHalt) { deadHalt = true; warnings.push(`${from} → ${to}: ${ch.reason}`); }
        else if (ch.anchor) {
          pearlSplit = { anchor: ch.anchor.name, detourPct: ch.detourPct, subHrs: ch.subLegs ? [ch.subLegs[0].hrs, ch.subLegs[1].hrs] : undefined, why: ch.anchor.why };
          warnings.push(`${from} → ${to}: ${ch.reason}. Insert an overnight at ${ch.anchor.name} and split the drive.`);
        }
      }
    }
    if (violations.length) infeasible = true;

    // ---- road-day cap
    if (opt.mode === 'ROAD' && km > maxKm) {
      warnings.push(`${from} → ${to} is ${km} km road — exceeds the ${maxKm} km/day cap for a ${inp.profile} group; insert an en-route halt and split across two days.`);
    }

    // reliability / staleness → verify list handled by guardrails; flag thin options here too
    const verifyFlag = (opt.reliability != null && opt.reliability <= 2) || !!opt.seasonal;

    legs.push({
      from, to, mode: opt.mode, identifier: opt.identifier ?? null,
      dep: opt.depTime ?? fmtMin(dep), arr: opt.arrTime ?? fmtMin(arr % 1440),
      distanceKm: opt.distanceKm ?? null, durationMin: opt.durationMin ?? null,
      farePpBand: opt.farePpMin != null && opt.farePpMax != null ? [opt.farePpMin, opt.farePpMax] : null,
      verifyFlag, positioning, overnight,
      operatingDays: opt.operatingDays,
      frequency: opt.mode !== 'ROAD' ? freqLabel(opt.operatingDays) : undefined,
      pearlSplit, deadHalt: deadHalt || undefined,
      note: positioning ? `Positioning drive to reach ${to} gateway — disclosed.` : violations.length ? violations.join(' ') : undefined,
    });

    if (positioning) {
      warnings.push(`Disclosed positioning drive: ${from} → ${to} (${km} km) exists only to reach onward transport — surface it to the client, don't bury it.`);
    }

    // advance calendar: overnight rail lands next day; otherwise same/next per arrDayOffset
    const dayAdvance = overnight ? 1 : Math.max((opt.arrDayOffset ?? 0), nightsAtTo > 0 ? 1 : 0);
    dayIdx += Math.max(1, dayAdvance);

    const isHalt = inp.haltNames?.has(to) ?? false;
    const verb = opt.mode === 'AIR' ? 'Fly' : opt.mode === 'RAIL' ? 'Train' : opt.mode === 'FERRY' ? 'Ferry' : 'Drive';
    const freq = opt.mode !== 'ROAD' ? freqLabel(opt.operatingDays) : 'daily';
    const idTxt = opt.identifier ? ` · ${opt.identifier}${opt.mode !== 'ROAD' && freq !== 'daily' ? ` (${freq})` : ''}` : '';
    days.push({
      day: dayIdx + 1, weekday: stamp(dayIdx), city: to, halt: isHalt,
      activity: isHalt ? `En-route overnight halt at ${to} (break the ${from} drive; sightseeing + hotel)`
        : overnight ? `Overnight train ${from} → ${to}${idTxt}${inp.praiseHotelNight === false ? '' : ' (saves a hotel night)'}`
        : `${verb} ${from} → ${to}${idTxt}${positioning ? ' (positioning)' : ''}`,
      transit: { from, to, mode: opt.mode, identifier: opt.identifier ?? null, dep: opt.depTime ?? null, arr: opt.arrTime ?? null },
      roadKm: opt.mode === 'ROAD' ? km : 0,
      transitMin: durationMin,
      violations: violations.length ? violations : undefined,
    });

    // extra full days at destination
    for (let k = 1; k < nightsAtTo; k++) {
      dayIdx++;
      days.push({ day: dayIdx + 1, weekday: stamp(dayIdx), city: to, activity: `${to} — full day`, transit: null, roadKm: 0, transitMin: 0 });
    }
    clock = arr % 1440 + TRANSFER_BUFFER_MIN;
  }

  return { legs, days, warnings, infeasible };
}
