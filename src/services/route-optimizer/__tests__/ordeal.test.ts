/**
 * Sprint 7 / US-605 acceptance — THE ORDEAL FUNCTION.
 *
 * The parameters in ordeal.ts are TUNED, not derived. This file is the only warrant they
 * have: it pins them to the founder's own verdicts, given in his ruling before any of this
 * was built. If someone re-tunes the constants, these tests tell him what he broke.
 *
 * The verdicts, verbatim from THE-CONSULTANTS-LAW.md:
 *   "A three-hour drive is a pleasure. A nine-hour overnight is an ordeal, whatever it saves."
 *   "Bengaluru → Mysuru → Coorg by car is short, scenic and chauffeur-driven — THAT IS THE
 *    LUXURY. A nine-hour train arriving at 03:50 is not."
 *
 * The test to read first is the last one: the function must REPRODUCE the founder's
 * verdicts from first principles, having never been told them.
 *
 * Runnable standalone:  bun run src/services/route-optimizer/__tests__/ordeal.test.ts
 */

import {
  ordeal, durationOrdeal, clockOrdeal, endurance, bandOf, ceilingBreach, travelsThroughNight, BAND_EPS,
  type OrdealParty,
} from '../ordeal';
import { isTrueOvernight } from '../constraints';
import { compileContract, intentFromRaw } from '../intent';
import type { LegOption } from '../types';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)); };

console.log('\nSprint 7 / US-605 — the ordeal: the dial is not the mode\n');

const HONEYMOONERS: OrdealParty = { cls: 'midage', budgetStance: 'comfort_first' };
const BUDGET_FAMILY: OrdealParty = { cls: 'family', budgetStance: 'price_first' };

// The real services from the failing request. Nothing invented.
const NETRAVATHI: LegOption = {
  from: 'Coorg', to: 'Goa', mode: 'RAIL', identifier: '16346 Netravathi Exp',
  durationMin: 540, depTime: '18:50', arrTime: '03:50', arrDayOffset: 1,
  classes: ['2A', '3A', 'SL'],
};
const DRIVE_TO_MANGALORE: LegOption = {
  from: 'Coorg', to: 'Mangalore', mode: 'ROAD', distanceKm: 140, durationMin: 210,   // 3.5 h
};
const DRIVE_BLR_MYSURU: LegOption = { from: 'Bengaluru', to: 'Mysuru', mode: 'ROAD', distanceKm: 145, durationMin: 180 };  // 3 h
// A REAL sleeper: boards late, lands after dawn, and gives a night's sleep in a berth.
// (The engine's own "Sabarmati rule" — constraints.isTrueOvernight.)
const HARIPRIYA: LegOption = {
  from: 'A', to: 'B', mode: 'RAIL', identifier: '17416 Haripriya Exp',
  durationMin: 615, depTime: '22:00', arrTime: '08:15', arrDayOffset: 1, classes: ['2A', '3A'],
};
const DRIVE_STRAIGHT_TO_GOA: LegOption = { from: 'Coorg', to: 'Goa', mode: 'ROAD', distanceKm: 380, durationMin: 450 };    // 7.5 h

// ---- 1. the curve is convex — hour seven hurts more than hour two -----------------
console.log('  -- the shape: fatigue is not linear, and no traveller thinks it is --');
const h3 = durationOrdeal(3), h6 = durationOrdeal(6), h9 = durationOrdeal(9);
check('3 h → 24 points', h3 === 24);
check('6 h → 60 points', h6 === 60);
check('9 h → 108 points', h9 === 108);
check('doubling 3 h to 6 h costs MORE than double (convex)', h6 > 2 * h3);
check('a 9-hour journey is not three 3-hour journeys', h9 > 3 * h3);

// ---- 2. THE CHAUFFEUR DISCOUNT — the number the founder's ruling turns on -----------
console.log('  -- being driven is not the same as enduring --');
check('a chauffeur-driven road leg is discounted (0.55 — half-rest)', endurance(DRIVE_BLR_MYSURU, HONEYMOONERS) === 0.55);
check('a comfort-first night journey is PENALISED (1.5 — a night not in his hotel is the cost)', endurance(HARIPRIYA, HONEYMOONERS) === 1.5);
check('...but for the family who CHOSE the sleeper it is a bargain (0.8)', endurance(HARIPRIYA, BUDGET_FAMILY) === 0.8);
check('the same berth, two minds, two numbers — this is P5 made flesh', endurance(HARIPRIYA, HONEYMOONERS) > endurance(HARIPRIYA, BUDGET_FAMILY));

// AND THE FINDING THAT FELL OUT OF THE TEST — worth more than the test that found it:
// nine hours ending at 03:50 means the Netravathi BOARDS AT 18:50. By the engine's own
// Sabarmati rule it is therefore NOT A TRUE OVERNIGHT: it never earned a hotel night at
// all. The engine praised it for saving one anyway.
check('THE NETRAVATHI IS NOT EVEN A TRUE OVERNIGHT — it never earned the hotel night it was praised for', isTrueOvernight(NETRAVATHI) === false);
check('...but it certainly travels through the night, and THAT is what the body feels', travelsThroughNight(NETRAVATHI) === true);
check('a 3:50 a.m. sleeper is no bargain for the budget family either — cheap is not the same as kind', endurance(NETRAVATHI, BUDGET_FAMILY) === 1.1);

// ---- 3. the clock — the 02:00–05:00 trough ------------------------------------------
console.log('  -- the circadian term that catches 3:50 in the morning --');
check('arriving 03:50 sits in the trough (+40)', clockOrdeal(null, 3 * 60 + 50) === 40);
check('arriving 23:00 is the edge of the night (+20)', clockOrdeal(null, 23 * 60) === 20);
check('arriving 07:00 is simply the morning (+0)', clockOrdeal(null, 7 * 60) === 0);
check('a 06:30 arrival is easing out of the night, not free', clockOrdeal(null, 6 * 60 + 30) > 0 && clockOrdeal(null, 6 * 60 + 30) < 40);
check('a 4 a.m. departure is its own cruelty (+14)', clockOrdeal(4 * 60, null) === 14);
check('a civilised 09:00 → 14:00 journey has no clock penalty at all', clockOrdeal(9 * 60, 14 * 60) === 0);

// ---- 4. THE FOUNDER'S VERDICTS, REPRODUCED ---------------------------------------------
console.log('  -- the verdicts, from first principles --');
const netra = ordeal(NETRAVATHI, HONEYMOONERS);
const drive = ordeal(DRIVE_TO_MANGALORE, HONEYMOONERS);
const mysuru = ordeal(DRIVE_BLR_MYSURU, HONEYMOONERS);
const straight = ordeal(DRIVE_STRAIGHT_TO_GOA, HONEYMOONERS);

console.log(`     Netravathi (9 h, arr 03:50)      → ${netra.total}  (${netra.band})`);
console.log(`     drive to Mangalore (3.5 h)       → ${drive.total}  (${drive.band})`);
console.log(`     drive Bengaluru→Mysuru (3 h)     → ${mysuru.total}  (${mysuru.band})`);
console.log(`     drive straight to Goa (7.5 h)    → ${straight.total}  (${straight.band})`);

check('"a nine-hour overnight is an ORDEAL, whatever it saves"', netra.band === 'ordeal' && netra.total >= 70, String(netra.total));
check('"a three-hour drive is a PLEASURE"', mysuru.band === 'pleasant', String(mysuru.total));
check('the 3.5 h hill drive to Mangalore airport is pleasant too — THIS is the luxury', drive.band === 'pleasant', String(drive.total));
check('the train is worse than the drive by a wide margin, not a whisker', netra.total > drive.total * 5);
check('...and the 7.5 h drive straight to Goa is heavy — he was right to refuse it', straight.band === 'heavy', String(straight.total));

// The founder's own arithmetic, to the point: 108 × 1.5 + 40 + 12 ≈ 214. Reached here from
// first principles — nine convex hours, endured (not rested) by a man who asked for comfort,
// plus the trough, plus the night it broke.
check('Netravathi decomposes exactly as designed (108 × 1.5 + 40 clock + 12 broken night = 214)', Math.abs(netra.total - (108 * 1.5 + 40 + 12)) < 0.5, String(netra.total));

// ---- 5. the same train, for the family it was written for --------------------------------
console.log('  -- and for the budget family, the sleeper is not an ordeal at all --');
const sleeperForFamily = ordeal(HARIPRIYA, BUDGET_FAMILY);
const sleeperForHoneymoon = ordeal(HARIPRIYA, HONEYMOONERS);
console.log(`     a REAL sleeper (22:00 → 08:15) for a price-first family → ${sleeperForFamily.total}  (${sleeperForFamily.band})`);
console.log(`     the same sleeper for the honeymooners               → ${sleeperForHoneymoon.total}  (${sleeperForHoneymoon.band})`);
check('a real sleeper costs the family far less than it costs the honeymooner', sleeperForFamily.total < sleeperForHoneymoon.total);
check('the broken night is WAIVED — they chose it, the berth is a bed, they wake after dawn', sleeperForFamily.parts.breakOfDay === 0);

// And the honest counterweight: the NETRAVATHI is not waived for anybody, because it does
// not give anybody a night's sleep. It takes the night and returns nothing.
const netraForFamily = ordeal(NETRAVATHI, BUDGET_FAMILY);
console.log(`     the Netravathi for that same family                 → ${netraForFamily.total}  (${netraForFamily.band})`);
check('the Netravathi keeps its broken-night charge even for the family — it took their night too', netraForFamily.parts.breakOfDay === 12);
check('...it is an ordeal for them as well. We never sell a 3:50 a.m. arrival as a saving.', netraForFamily.band === 'ordeal');
// It is worse still for the honeymooner — not because he is more precious, but because he
// told us what he wanted, and a night outside his hotel is itself the cost for HIM.
check('...and worse for the honeymooner than for the family, exactly as his brief implies', netra.total > netraForFamily.total);
// And the real sleeper, for the mind it was written for, is the one journey here that is
// genuinely a fair deal. Same engine. Same night. Two honest answers.
check('the honest contrast: a REAL sleeper costs the family less than this night-wrecker does', sleeperForFamily.total < netraForFamily.total);

// ---- 6. the weakest member carries the party -----------------------------------------------
const elderly = ordeal(DRIVE_STRAIGHT_TO_GOA, { cls: 'elderly', budgetStance: 'value' });
const young = ordeal(DRIVE_STRAIGHT_TO_GOA, { cls: 'young', budgetStance: 'value' });
check('the same road is harder on elderly parents than on young friends', elderly.total > young.total);

// ---- 7. the ceilings: where his words become a gate -------------------------------------------
console.log('  -- "no long road journeys", given a number --');
const contract = compileContract(intentFromRaw({
  comfortTier: 'luxury', pax: 2, composition: 'couple',
  modes: [{ mode: 'road', stance: 'avoid', qualifier: 'long', strength: 0.8 }],
  quotes: { mode_road: 'no long road journeys' },
}, 'luxury honeymoon, no long road journeys'));

check('the 7.5 h drive BREACHES his road ceiling', !!ceilingBreach(DRIVE_STRAIGHT_TO_GOA, straight.total, contract.tighten));
check('...and the 3.5 h drive to the airport does NOT — it is blessed', ceilingBreach(DRIVE_TO_MANGALORE, drive.total, contract.tighten) === null);
check('...nor does the 3 h drive to Mysuru', ceilingBreach(DRIVE_BLR_MYSURU, mysuru.total, contract.tighten) === null);
check('the breach names the ceiling HE set, not a score we invented', ceilingBreach(DRIVE_STRAIGHT_TO_GOA, straight.total, contract.tighten)?.ceiling === 30);

// This single pair of assertions IS Law 2. The same mode. One banned, one blessed. The
// dial was never the mode; it was always the ordeal.
check('LAW 2, in one line: same mode, one refused and one welcomed', !!ceilingBreach(DRIVE_STRAIGHT_TO_GOA, straight.total, contract.tighten) && ceilingBreach(DRIVE_BLR_MYSURU, mysuru.total, contract.tighten) === null);

// ---- 8. bands ---------------------------------------------------------------------------------
check('the bands read as the spec says (0–25 / 25–45 / 45–70 / 70+)', bandOf(10) === 'pleasant' && bandOf(30) === 'fine' && bandOf(50) === 'heavy' && bandOf(80) === 'ordeal');
check('the band width for ranking is 8 points', BAND_EPS === 8);

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
