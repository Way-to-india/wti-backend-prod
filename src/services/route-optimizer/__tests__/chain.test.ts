/**
 * US-827 — THE GROUND CHAIN GATE.
 *
 * The founder's indictment, from the live payload of 14 July 2026:
 *
 *     12-hour flight day    -> HARD-BLOCKED: "more than one day should ask of you"
 *     20h24 overnight train -> ALLOWED. Not flagged at all.
 *
 * These assertions exist so that can never be true again.
 */
import { groundChainBlock, groundChainable, sleepMinutes, wakingHours, wakingSplit, toMin } from '../chain';
import type { LegOption } from '../types';

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, got = '') => {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${got ? ` — ${got}` : ''}`); }
};

const leg = (o: Partial<LegOption>): LegOption =>
  ({ from: 'A', to: 'B', mode: 'RAIL', ...o } as LegOption);

console.log('\n-- the clock --');
check('toMin reads 17:30', toMin('17:30') === 17 * 60 + 30);
check('toMin refuses rubbish', toMin('nonsense') === null && toMin('99:99') === null);

console.log('\n-- what counts as sleep: 23:00 -> 07:00, and nothing else --');
check('a 12 h overnight leaving 20:00 sleeps 8 h', sleepMinutes(20 * 60, 12 * 60) === 480);
check('a 4 h afternoon hop sleeps NOTHING', sleepMinutes(14 * 60, 4 * 60) === 0);
// I first asserted 780 here — "two nights, so 16 hours" — and the code said 540. THE CODE WAS
// RIGHT AND I WAS WRONG. Leaving at 18:00 and running 30 hours you get ONE whole night (23:00
// -> 07:00, 8 h) and exactly ONE HOUR of the next (23:00 -> midnight, when the journey ends).
// 480 + 60 = 540. This is precisely why sleepMinutes() walks the clock minute by minute instead
// of doing the arithmetic in its head: I did the arithmetic in my head, and I got it wrong.
check('a 30 h train gets ONE whole night and one hour of the next — 540 min, not 780',
      sleepMinutes(18 * 60, 30 * 60) === 540, `${sleepMinutes(18 * 60, 30 * 60)}`);
check('...and 21 waking hours is still blocked for ANY body',
      groundChainBlock(leg({ mode: 'RAIL', depTime: '18:00', durationMin: 30 * 60 }), 'young').blocked);
check('NO departure time credits ZERO sleep — an unknown clock may never BUY comfort',
      sleepMinutes(null, 20 * 60) === 0);

console.log('\n-- THE 20-HOUR TRAIN. The one that started this. --');
// Tirupati -> Kanyakumari, the real service the engine chose: 16381 PUNE CAPE EXP, 19 h 54.
const theTrain = leg({ from: 'Tirupati', to: 'Kanyakumari', mode: 'RAIL',
                       identifier: '16381 PUNE CAPE EXP', depTime: '17:00', durationMin: 19 * 60 + 54 });
const LUXURY = { cls: 'elderly', budgetStance: 'comfort_first' } as const;
const BUDGET_FAMILY = { cls: 'family', budgetStance: 'price_first' } as const;
const g = groundChainBlock(theTrain, LUXURY);
check('it is BLOCKED for the 56-and-49 couple who asked for LUXURY', g.blocked, JSON.stringify(g));
check('...and the berth is still honestly credited — 8 hours of it', Math.round(g.sleptHrs) === 8, `${g.sleptHrs}`);
check('...but 11.9 WAKING hours is not a night. It is a day on a train.',
      g.wakingHrs > 11 && g.wakingHrs < 12.5, `${g.wakingHrs}`);
check('...and the reason says so, in the engine\'s own words',
      /AWAKE in the vehicle/.test(g.reason), g.reason);

console.log('\n-- AND WE HAVE NOT BANNED THE INDIAN OVERNIGHT TRAIN --');
// This is the thing we must NOT break. A proper overnight is the backbone of Indian travel.
const properOvernight = leg({ mode: 'RAIL', identifier: '12559 Shiv Ganga Exp',
                              depTime: '20:00', durationMin: 12 * 60 });
check('a real 12 h overnight, 20:00 -> 08:00, PASSES even for the luxury couple',
      !groundChainBlock(properOvernight, LUXURY).blocked);
check('...because only 4 of its hours are spent awake',
      Math.abs(groundChainBlock(properOvernight, LUXURY).wakingHrs - 4) < 0.01);

// ---- THE THING WE MUST NOT BREAK: THE BUDGET FAMILY'S TRAIN --------------------------------
// 17310 Vasco Exp, Goa -> Bengaluru, 18:20 -> 08:50. Fourteen and a half hours, and it costs
// them NO DAY AT ALL: they leave after dinner and arrive at breakfast, for a fifth of the fare
// of the flight. IT IS THEIR BEST ANSWER AND THE ENGINE MUST SAY SO. To force this family onto
// a flight they never asked for and cannot afford is the SAME ARROGANCE IN THE OPPOSITE
// DIRECTION -- congratulating ourselves on their comfort while emptying their pocket.
const familyTrain = leg({ from: 'Goa', to: 'Bengaluru', mode: 'RAIL', identifier: '17310 Vasco Exp',
                          depTime: '18:20', durationMin: 870, classes: ['2A', '3A', 'SL'] });
const fam = groundChainBlock(familyTrain, BUDGET_FAMILY);
check('the budget family KEEPS their 14 h overnight — it costs them no day and a fifth of the fare',
      !fam.blocked, JSON.stringify(fam));
check('...4.7 waking hours before the night, 1.8 after it. Neither is a travel day.',
      Math.round(wakingSplit(toMin('18:20'), 870, true).before / 6) / 10 === 4.7
      && Math.round(wakingSplit(toMin('18:20'), 870, true).after / 6) / 10 === 1.8,
      JSON.stringify(wakingSplit(toMin('18:20'), 870, true)));

// ---- AND THE SAME 20-HOUR TRAIN, FOR THE PURSE LANE -----------------------------------------
// A budget family really does take a 20-hour train, and it is not our place to forbid it. What
// we may never do is sell it to a man who asked for LUXURY and tell him it was a night's sleep.
check('the SAME 20 h train is NOT blocked for a price-first family — their call, not ours',
      !groundChainBlock(theTrain, BUDGET_FAMILY).blocked);
check('...but it IS blocked for the man who said luxury. One engine, two minds, two honest answers.',
      groundChainBlock(theTrain, LUXURY).blocked);

console.log('\n-- a 34-hour road slog is not a journey, it is an endurance test --');
const roadSlog = leg({ mode: 'ROAD', durationMin: 34 * 60 + 6 });
check('BLOCKED for everyone, even the young', groundChainBlock(roadSlog, 'young').blocked);
check('a car through the night is NOT sleep — no berth, no credit',
      groundChainBlock(leg({ mode: 'ROAD', depTime: '22:00', durationMin: 34 * 60 }), 'young').sleptHrs === 0);

console.log('\n-- the gate is GROUND ONLY. It never touches a flight. --');
const flight = leg({ mode: 'AIR', identifier: '6E 6216', durationMin: 11 * 60 + 48 });
check('a flight is never blocked BY THIS GATE (the body gates still judge it)',
      !groundChainBlock(flight, 'elderly').blocked);

console.log('\n-- IT ONLY EVER TIGHTENS --');
check('a 3 h drive passes for the frailest body there is',
      !groundChainBlock(leg({ mode: 'ROAD', durationMin: 180 }), 'reduced_mobility').blocked);
check('a 6 h drive is fine for the young and NOT for the frail — the same leg, two bodies',
      !groundChainBlock(leg({ mode: 'ROAD', durationMin: 360 }), 'young').blocked
      && groundChainBlock(leg({ mode: 'ROAD', durationMin: 360 }), 'reduced_mobility').blocked);

console.log('\n-- THE FOUNDER\'S SENTENCE, MADE CHECKABLE --');
// "two towns more than one comfortable day apart by ground CANNOT BE CHAINED BY GROUND"
check('Tirupati and Kanyakumari are NOT chainable by ground for this couple',
      !groundChainable([theTrain, roadSlog], LUXURY));
check('...so the radar must fly the gap, or never place them side by side',
      !groundChainable([theTrain, roadSlog], LUXURY) && !groundChainBlock(flight, LUXURY).blocked);
check('two towns a proper overnight apart ARE chainable by ground',
      groundChainable([properOvernight], LUXURY));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
