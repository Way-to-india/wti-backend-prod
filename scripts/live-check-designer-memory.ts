import { loadDesignerMemory } from '@/services/route-optimizer/designerMemoryDb';
import { coDesignedWith, coDesignStrength, nightsWeCanStandBehind, nightsRaw, setCohesion } from '@/services/route-optimizer/designerMemory';

const m = await loadDesignerMemory();
let pass = 0, fail = 0;
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log('  OK  ' + n)) : (fail++, console.log('  XX  ' + n + (d ? ' -- ' + d : ''))); };

console.log('\nUS-804 LIVE READER — against the real database, not a fixture\n');
check('the memory loaded at all', m.pairs.length > 0 && m.nights.length > 0, m.pairs.length + ' pairs / ' + m.nights.length + ' nights');
check('504 pairs, as derived', m.pairs.length === 504, String(m.pairs.length));
check('Agra-Delhi is 37 LIVE', coDesignStrength(m, 'Agra', 'Delhi') === 37, String(coDesignStrength(m, 'Agra', 'Delhi')));
check('Jaipur-Delhi is 29 LIVE', coDesignStrength(m, 'Jaipur', 'Delhi') === 29);
check('Jaipur top pairing is Delhi LIVE', coDesignedWith(m, 'Jaipur')[0]?.pairsWith === 'Delhi', JSON.stringify(coDesignedWith(m,'Jaipur').slice(0,4).map(p=>p.pairsWith+':'+p.designedTogether)));
check('Guwahati-Shillong is 2 LIVE (the North East was never empty)', coDesignStrength(m, 'Guwahati', 'Shillong') === 2);
check('Guwahati-Kaziranga is 2 LIVE', coDesignStrength(m, 'Guwahati', 'Kaziranga') === 2);
check('Leh = 3.0 nights and we can stand behind it LIVE', nightsWeCanStandBehind(m, 'Leh')?.nights === 3.0, JSON.stringify(nightsWeCanStandBehind(m,'Leh')));
check('Delhi = 1.5 nights x82 LIVE', nightsWeCanStandBehind(m, 'Delhi')?.nights === 1.5);
check('EVERY night row is stamped catalogue_ai_parsed, never designer', m.nights.every(n => n.tier === 'catalogue_ai_parsed'));
check('EVERY pair row is stamped designer_catalogue', m.pairs.every(p => p.tier === 'designer_catalogue'));
check('Kedarnath is WITHHELD live (parse disagreed)', nightsWeCanStandBehind(m, 'Kedarnath') === null, JSON.stringify(nightsRaw(m,'Kedarnath')));
check('...but Kedarnath still EXISTS raw, for a human to judge', nightsRaw(m, 'Kedarnath') !== null && nightsRaw(m,'Kedarnath')!.reconciled === false);
check('exactly 7 towns are withheld live', m.nights.filter(n => !n.reconciled).length === 7, String(m.nights.filter(n=>!n.reconciled).length));
console.log('  .. withheld:', m.nights.filter(n => !n.reconciled).map(n => n.city).join(', '));
const gt = setCohesion(m, ['Delhi','Agra','Jaipur']); const ne = setCohesion(m, ['Guwahati','Shillong','Kaziranga']);
check('Golden Triangle cohesion > North East cohesion > 0 (both real, not the same promise)', gt > ne && ne > 0, 'GT=' + gt.toFixed(1) + ' NE=' + ne.toFixed(1));
console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail > 0 ? 1 : 0);
