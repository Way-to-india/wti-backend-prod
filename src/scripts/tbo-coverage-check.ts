/**
 * TBO Pan-India Coverage Check  (read-only, no bookings)
 * Reuses the existing tested TBO service. Run on EC2 (IP whitelisted, env set):
 *   cd ~/wti-backend-prod && bun run src/scripts/tbo-coverage-check.ts
 */
import { TBOHotelService } from '@/services/tbo/tbo-hotels.service';

const TEST_CITIES = ['Delhi', 'Agra', 'Jaipur', 'Munnar', 'Goa'];

function sampleDates() {
  const ci = new Date(); ci.setDate(ci.getDate() + 45);
  const co = new Date(ci); co.setDate(co.getDate() + 2);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { checkIn: iso(ci), checkOut: iso(co) };
}
function bandOf(star: number) {
  if (star >= 5) return '5*'; if (star >= 4) return '4*';
  if (star >= 3) return '3*'; return '<3*';
}
async function run() {
  const { checkIn, checkOut } = sampleDates();
  console.log(`\n=== TBO COVERAGE CHECK ===`);
  console.log(`Dates: ${checkIn} -> ${checkOut} | 2 adults, 1 room | nationality IN\n`);
  console.log('Resolving Indian city list from TBO...');
  const cities = await TBOHotelService.getCityList('IN');
  console.log(`TBO returned ${cities.length} Indian cities.\n`);
  for (const cityName of TEST_CITIES) {
    const match = cities.find((c: any) => c.cityName?.toLowerCase() === cityName.toLowerCase())
      || cities.find((c: any) => c.cityName?.toLowerCase().includes(cityName.toLowerCase()));
    if (!match) { console.log(`❌ ${cityName.padEnd(8)} — NOT in TBO city list\n`); continue; }
    try {
      const res = await TBOHotelService.search({
        checkIn, checkOut, cityId: match.cityId, guestNationality: 'IN',
        rooms: [{ adults: 2, children: 0 }], minRating: 0, maxRating: 5,
      });
      const hotels = res.results || [];
      const bands: Record<string, { count: number; min: number }> = {};
      for (const h of hotels) {
        const b = bandOf(h.starRating || 0);
        bands[b] ??= { count: 0, min: Infinity };
        bands[b].count++;
        if (h.minPrice && h.minPrice < bands[b].min) bands[b].min = h.minPrice;
      }
      console.log(`✅ ${cityName.padEnd(8)} (CityId ${match.cityId}) — ${hotels.length} hotels`);
      for (const b of ['5*', '4*', '3*', '<3*']) if (bands[b]) {
        const min = isFinite(bands[b].min) ? `₹${Math.round(bands[b].min)}/night (cheapest)` : 'n/a';
        console.log(`     ${b.padEnd(4)} ${String(bands[b].count).padStart(3)} hotels   lowest net ${min}`);
      }
      hotels.slice(0, 2).forEach((h: any) => {
        const room = h.rooms?.[0];
        console.log(`     e.g. ${h.starRating}* ${h.name?.slice(0, 40)} — ` +
          `${room ? `${room.boardType}, net ₹${Math.round(room.price)} (markup ₹${Math.round(room.markup || 0)})` : 'no room data'}`);
      });
      console.log('');
    } catch (e: any) { console.log(`⚠️  ${cityName.padEnd(8)} — search error: ${e?.message || e}\n`); }
  }
  console.log('=== DONE. No bookings were made. ===\n');
}
run().catch((e) => { console.error('Fatal:', e); process.exit(1); });
