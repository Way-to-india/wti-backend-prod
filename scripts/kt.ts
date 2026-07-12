import { roadTerrainFor } from "@/services/route-optimizer/roadTerrainDb";
import prisma from "@/config/db";
const legs: [string, [number,number], string, [number,number], number][] = [
  ["Mumbai",[19.0760,72.8777],"Alibaug",[18.6468,72.8751],76],
  ["Alibaug",[18.6468,72.8751],"Murud",[18.3225,72.9614],48],
  ["Murud",[18.3225,72.9614],"Dapoli",[17.7577,73.1896],119],
  ["Dapoli",[17.7577,73.1896],"Ganpatipule",[17.1478,73.2712],123],
  ["Ganpatipule",[17.1478,73.2712],"Ratnagiri",[16.9944,73.3000],24],
  ["Ratnagiri",[16.9944,73.3000],"Malvan",[16.0619,73.4690],131],
  ["Malvan",[16.0619,73.4690],"Tarkarli",[16.0075,73.4924],14],
  ["Tarkarli",[16.0075,73.4924],"Dabolim",[15.3808,73.8314],126],
];
const fmt=(m:number)=>`${Math.floor(m/60)}h ${String(Math.round(m%60)).padStart(2,"0")}m`;
console.log("\nKONKAN — the times the page shows vs the road as it really is\n");
console.log("  LEG                        km    PAGE SAYS    HONEST      climb/km");
let pageTot=0, realTot=0;
for (const [a,ac,b,bc,pageMin] of legs) {
  const t = await roadTerrainFor(a,b,ac,bc);
  if(!t){ console.log(`  ${a} -> ${b}: no measurement`); continue; }
  pageTot+=pageMin; realTot+=t.minutes;
  const kmh = t.km/(pageMin/60);
  console.log(`  ${(a+" -> "+b).padEnd(26)} ${String(t.km).padStart(3)}   ${fmt(pageMin).padStart(7)} (${kmh.toFixed(0)}km/h)  ${fmt(t.minutes).padStart(7)}   ${t.climbPerKm.toFixed(1)}m`);
}
console.log(`\n  TOTAL DRIVING   page: ${fmt(pageTot)}   honest: ${fmt(realTot)}   difference: ${fmt(realTot-pageTot)}`);
await prisma.$disconnect(); process.exit(0);
