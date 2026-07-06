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
      note: positioning ? `Positioning drive to reach ${to} gateway — disclosed.` : violations.length ? violations.join(' ') : undefined,
    });

    if (positioning) {
      warnings.push(`Disclosed positioning drive: ${from} → ${to} (${km} km) exists only to reach onward transport — surface it to the client, don't bury it.`);
    }

    // advance calendar: overnight rail lands next day; otherwise same/next per arrDayOffset
    const dayAdvance = overnight ? 1 : Math.max((opt.arrDayOffset ?? 0), nightsAtTo > 0 ? 1 : 0);
    dayIdx += Math.max(1, dayAdvance);

    days.push({
      day: dayIdx + 1, weekday: stamp(dayIdx), city: to,
      activity: overnight ? `Overnight ${mapMode} ${from} → ${to} (saves a hotel night)` : `Travel ${from} → ${to}${positioning ? ' (positioning)' : ''}`,
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
