// THE THIRD WITNESS. Google Directions knows Indian roads. OSRM does not.
// My climb-per-km model was fitted to FOUR roads, none of them a coastal highway.
// So: do not trust it here. ASK.
const KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const fmt=(m:number)=>`${Math.floor(m/60)}h ${String(Math.round(m%60)).padStart(2,"0")}m`;
async function google(a:[number,number], b:[number,number]) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${a[0]},${a[1]}&destination=${b[0]},${b[1]}&mode=driving&region=in&key=${KEY}`;
  const r = await fetch(url); const j:any = await r.json();
  if (j.status !== "OK") return { err: j.status, msg: (j.error_message||"").slice(0,60) };
  const leg = j.routes[0].legs[0];
  return { km: Math.round(leg.distance.value/1000), min: Math.round(leg.duration.value/60) };
}
const LEGS: [string,[number,number],string,[number,number],number,number][] = [
  // name, from, name, to, PAGE minutes (displayed), MY MODEL minutes
  ["Mumbai",[19.0760,72.8777],"Alibaug",[18.6468,72.8751],103,130],
  ["Alibaug",[18.6468,72.8751],"Murud",[18.3225,72.9614],65,76],
  ["Murud",[18.3225,72.9614],"Dapoli",[17.7577,73.1896],161,253],
  ["Dapoli",[17.7577,73.1896],"Ganpatipule",[17.1478,73.2712],166,167],
  ["Ganpatipule",[17.1478,73.2712],"Ratnagiri",[16.9944,73.3000],32,51],
  ["Ratnagiri",[16.9944,73.3000],"Malvan",[16.0619,73.4690],177,280],
  ["Malvan",[16.0619,73.4690],"Tarkarli",[16.0075,73.4924],19,12],
  ["Tarkarli",[16.0075,73.4924],"Dabolim",[15.3808,73.8314],170,193],
];
console.log("\nWHO IS RIGHT? Google Directions is the referee.\n");
console.log("  LEG                        km    PAGE      MY MODEL   GOOGLE     verdict");
let pT=0,mT=0,gT=0;
for (const [a,ac,b,bc,pageMin,modelMin] of LEGS) {
  const g:any = await google(ac,bc);
  if (g.err) { console.log(`  ${a}->${b}: GOOGLE ERROR ${g.err} ${g.msg}`); continue; }
  pT+=pageMin; mT+=modelMin; gT+=g.min;
  const dP=Math.abs(pageMin-g.min), dM=Math.abs(modelMin-g.min);
  const v = dP<dM ? "PAGE closer" : dM<dP ? "MY MODEL closer" : "tie";
  console.log(`  ${(a+" -> "+b).padEnd(26)} ${String(g.km).padStart(3)}  ${fmt(pageMin).padStart(7)}  ${fmt(modelMin).padStart(8)}  ${fmt(g.min).padStart(7)}   ${v}`);
  await new Promise(r=>setTimeout(r,150));
}
console.log(`\n  TOTAL   page ${fmt(pT)}   my model ${fmt(mT)}   GOOGLE ${fmt(gT)}`);
process.exit(0);
