/**
 * Sprint 7 / US-604 acceptance — THE CONTRACT FILTERS, AND THE FLAG THAT LIED.
 *
 * Two defects, one story:
 *
 *  F2a. `overnightTrains: true` was HARDCODED in the public planner (controller:281). The
 *       filter it fed had worked all along; the ear was never connected. Every traveller
 *       who ever typed "no trains" was overruled by a constant.
 *
 *  F2b. The filter itself lied. It read:
 *          overnightTrains === false ? !(o.mode === 'RAIL') : true
 *       — which removes ALL RAIL, not just the overnight. A man who says "no overnight
 *       trains" is not saying "no trains": he would happily take the 10 a.m. Shatabdi and
 *       be at lunch by two. The old filter threw that away too, and then, because a leg
 *       with no candidates falls back to the full pool, it could hand him back the very
 *       sleeper he refused. A bug that loud is only possible because the flag's name and
 *       its behaviour had drifted apart.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/filters.test.ts
 */

import { usableOptions } from '../optimize';
import { compileContract, intentFromRaw } from '../intent';
import { isTrueOvernight } from '../constraints';
import type { LegOption } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 7 / US-604 — his refusals become filters; the overnight flag stops lying\n');

// A leg with a real choice on it: a day train, a night train, a drive, a flight.
const DAY_TRAIN: LegOption = { from: 'A', to: 'B', mode: 'RAIL', identifier: '12007 Shatabdi', durationMin: 240, depTime: '10:00', arrTime: '14:00', arrDayOffset: 0, classes: ['CC', 'EC'], operatingDays: 127, reliability: 5 };
const NIGHT_TRAIN: LegOption = { from: 'A', to: 'B', mode: 'RAIL', identifier: '16346 Netravathi Exp', durationMin: 540, depTime: '21:30', arrTime: '06:30', arrDayOffset: 1, classes: ['2A', '3A'], operatingDays: 127, reliability: 4 };
const ROAD: LegOption = { from: 'A', to: 'B', mode: 'ROAD', distanceKm: 260, durationMin: 300, operatingDays: 127 };
const FLIGHT: LegOption = { from: 'A', to: 'B', mode: 'AIR', identifier: '6E 123', durationMin: 75, depTime: '11:00', arrTime: '12:15', operatingDays: 127 };
const POOL = [DAY_TRAIN, NIGHT_TRAIN, ROAD, FLIGHT];
const ids = (l: LegOption[]) => l.map((o) => o.identifier ?? o.mode).sort().join(', ');

// ---- 1. the flag stops lying -----------------------------------------------------
console.log('  -- "no overnight trains" does not mean "no trains" --');
check('the fixture is honest: the night train IS a true overnight, the day train is not', isTrueOvernight(NIGHT_TRAIN) && !isTrueOvernight(DAY_TRAIN));

const noOvernight = usableOptions(POOL, { overnightTrains: false });
check('the OVERNIGHT is removed', !noOvernight.usable.includes(NIGHT_TRAIN));
check('...and the 10 a.m. Shatabdi SURVIVES (the old filter binned it)', noOvernight.usable.includes(DAY_TRAIN), ids(noOvernight.usable));
check('...road and flight are untouched', noOvernight.usable.includes(ROAD) && noOvernight.usable.includes(FLIGHT));
check('nothing was refused outright — the leg still has candidates', noOvernight.refusedAll === false);

const overnightOk = usableOptions(POOL, { overnightTrains: true });
check('with overnights allowed, every service stays (default behaviour, unchanged)', overnightOk.usable.length === 4);

// ---- 2. his refusal is a FILTER, not a weight (Law 1) ------------------------------
console.log('  -- "no trains" — the brief, not a term to be outvoted --');
const honeymoon = compileContract(intentFromRaw({
  comfortTier: 'luxury', purpose: 'honeymoon', pax: 2, composition: 'couple',
  modes: [{ mode: 'rail', stance: 'refuse', qualifier: 'any', strength: 0.9 }],
  quotes: { mode_rail: 'no trains' },
}, 'luxury honeymoon, no trains for us'));

const refused = usableOptions(POOL, { contract: honeymoon });
check('BOTH trains leave the pool — he said no trains, and he meant it', !refused.usable.some((o) => o.mode === 'RAIL'), ids(refused.usable));
check('...and everything he did NOT refuse is still there', refused.usable.includes(ROAD) && refused.usable.includes(FLIGHT));

// A weight can be outvoted by enough cost. A filter cannot be outvoted at all — that is
// the entire difference between "intent is a weight" and "intent is the brief".
check('the refusal is structural: the train is not in the set, at any price', refused.usable.every((o) => o.identifier !== '16346 Netravathi Exp'));

// ---- 3. "no LONG road journeys" does NOT ban the road ------------------------------
console.log('  -- Law 2: he refused the ordeal, not the rolling stock --');
const qualified = compileContract(intentFromRaw({
  comfortTier: 'luxury', pax: 2,
  modes: [{ mode: 'road', stance: 'avoid', qualifier: 'long', strength: 0.8 }],
  quotes: { mode_road: 'no long road journeys' },
}, 'luxury trip, no long road journeys please'));
const roadKept = usableOptions(POOL, { contract: qualified });
check('the ROAD stays in the pool (the three-hour drive through Mysuru IS the luxury)', roadKept.usable.includes(ROAD));
check('...the refusal became a CEILING on the road ordeal instead of a ban', qualified.tighten.perModeOrdealCeiling?.ROAD === 30);

// ---- 4. WHERE HIS REFUSAL LEAVES NOTHING, WE DO NOT LIE TO HIM ------------------------
console.log('  -- the leg where the train is the only thing there --');
const railOnly = [NIGHT_TRAIN, DAY_TRAIN];
const stranded = usableOptions(railOnly, { contract: honeymoon });
check('the candidate set is empty — his word removed everything this leg had', stranded.usable.length === 0);
check('and we FLAG it (refusedAll) rather than quietly handing him back the train', stranded.refusedAll === true);
// The engine must not invent a service, and must not overrule him in silence. It hands the
// leg to the consultant fallback (US-607), which speaks: finding, reason, alternative.

// ---- 5. the mind that WANTS the overnight train is untouched ---------------------------
const budget = compileContract(intentFromRaw({ comfortTier: 'budget', pax: 4, composition: 'family_kids' }, 'family of four, cheapest option please'));
const budgetSet = usableOptions(POOL, { contract: budget });
check('a budget family keeps every option, overnight included', budgetSet.usable.length === 4);
check('...and no overnight ban is invented for them', budget.filters.banOvernightRail === false);

// ---- 6. an absent contract is the engine exactly as it was ------------------------------
check('no contract, no flag → nothing is filtered (v1.0 behaviour, byte for byte)', usableOptions(POOL).usable.length === 4);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
