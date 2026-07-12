import { buildTourRoute } from "@/utils/tourRoute";
import prisma from "@/config/db";
const t: any = await prisma.$queryRawUnsafe(`SELECT id FROM tours WHERE slug=$1`, "konkan-holiday-package");
const id = t[0].id;
const itin: any = await prisma.$queryRawUnsafe(`SELECT day, title FROM tour_itinerary WHERE "tourId"=$1 ORDER BY day`, id);
const cities: any = await prisma.$queryRawUnsafe(
  `SELECT c.name, c.latitude::float AS latitude, c.longitude::float AS longitude
     FROM tour_cities tc JOIN cities c ON c.id=tc."cityId" WHERE tc."tourId"=$1`, id);
console.log("\nCITIES LINKED TO THE TOUR (all 6 present, all with coords):");
console.log(" ", cities.map((c:any)=>c.name).join(", "));
const r = buildTourRoute(itin, cities);
console.log("\nWHAT buildTourRoute ACTUALLY PRODUCES (this is what the page renders):");
(r?.stops||[]).forEach((s:any,i:number)=>console.log(`  ${i+1}. ${s.name}`));
console.log("\n  total km:", r?.totalKm);
console.log("\nPER-DAY PARSE — which day silently produces NOTHING?");
for (const it of itin) {
  const one = buildTourRoute([it], cities);
  const got = (one?.stops||[]).map((s:any)=>s.name).join(" -> ") || "*** NOTHING ***";
  console.log(`  day ${it.day}: ${got}`);
  console.log(`          title: ${String(it.title).slice(0,72)}`);
}
process.exit(0);
