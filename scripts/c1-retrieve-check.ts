/** C1 retrieval smoke-check against LIVE data. No writes. bun run scripts/c1-retrieve-check.ts */
import { loadBranches, branchIdByTour } from '@/services/route-optimizer/libraryDb';
import { retrieve, type QueryFacets } from '@/services/route-optimizer/library';
import { resolveNamedCircuit } from '@/services/route-optimizer/namedCircuits';
import { REGIONS } from '@/services/route-optimizer/regions';

const statesOfKey = (key: string) =>
  (REGIONS.find((r) => r.key === key)?.states.map((s) => s.name)) ?? null;

async function main() {
  const branches = await loadBranches();
  console.log(`loaded ${branches.length} branches\n`);

  async function run(name: string, text: string, q: Partial<QueryFacets> & { regionKey?: string | null }) {
    const facets: QueryFacets = {
      chips: q.chips ?? [], regionKey: q.regionKey ?? null,
      regionStates: q.regionKey ? statesOfKey(q.regionKey) : null,
      measuredFrom: q.measuredFrom ?? null, monthIndex0: q.monthIndex0 ?? null,
      saidNights: q.saidNights ?? null, profile: q.profile ?? 'standard',
    };
    let aliasBranchId: string | null = null; let aliasQuote: string | null = null;
    const c = resolveNamedCircuit(text);
    if (c) { aliasBranchId = await branchIdByTour(c.circuit.tourId); aliasQuote = c.quote; }
    const { offered, proof } = retrieve(branches, facets, { aliasBranchId, aliasQuote });
    console.log(`### ${name}  "${text}"`);
    console.log(`   facets: chips=[${facets.chips.join(', ')}] region=${facets.regionKey} nights=${facets.saidNights}`);
    console.log(`   aliasHit=${proof.aliasHit ?? '—'}  survivors=${proof.stage1_survivors}/${proof.stage1_in}  served=${offered.length}`);
    for (const o of offered.slice(0, 4)) {
      const stops = o.branch.stops.map((s) => `${s.name}·${s.nights}[${s.role}]`).join(' > ');
      console.log(`     ✔ ${o.branch.label}  score=${Math.round(o.score)} matched=[${o.matchedChips.join(',')}] miss=[${o.missingChips.join(',')}]`);
      console.log(`       ${stops}`);
    }
    console.log(`   proof.excluded(top3): ${proof.excluded.slice(0, 3).map((e) => e.label + '→' + e.stage).join(' | ')}`);
    console.log('');
  }

  await run('Nau Devi (alias)', 'ten of us doing the Nau Devi Yatra, luxury', { saidNights: 7 });
  await run('Kerala luxury couple', 'kerala for a couple, luxury, in November', { regionKey: 'kerala', chips: ['Honeymoon & Romance'], monthIndex0: 10, saidNights: 7 });
  await run('Karnataka heritage couple', 'the heritage cities of Karnataka', { regionKey: 'karnataka', chips: ['Heritage & Forts'], saidNights: 9 });
  await run('MP wildlife couple', 'wildlife and adventure in Madhya Pradesh, luxury', { regionKey: 'central_india', chips: ['Wildlife & Nature', 'Trekking & Adventure'], saidNights: 6 });
  await import('@/config/db').then((m) => (m.default as any).$disconnect());
}
main().catch((e) => { console.error(e); process.exit(1); });
