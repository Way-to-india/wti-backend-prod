/**
 * PROBE 2 — MEASURE, then choose the model. Do not choose the model and then measure.
 *
 * FOUNDER: "It should be as accurate as possible."
 * FOUNDER: "plains 55 km/h, hills 22 km/h."
 *
 * My first attempt classified each kilometre by its ALTITUDE and got the plains exactly
 * right (Delhi->Agra 3.7 h vs a real 3.75 h) but under-counted every hill road:
 * Gangtok->Darjeeling came out 2.7 h against a real 4 h.
 *
 * THE REASON: ALTITUDE IS THE WRONG VARIABLE. A winding road at 800 m is slow too. What
 * makes a hill road slow is the CLIMBING and the CORNERS, not the height above the sea.
 *
 * So: measure the real terrain statistics of four roads whose true driving time we KNOW,
 * and fit the speed model to them. This prints the evidence. It decides nothing.
 *
 * GROUND TRUTH (real driving times, from operating these roads):
 *   Delhi     -> Agra         202 km / 3.75 h  =  54 km/h   PLAINS
 *   Shillong  -> Kaziranga    255 km / 6.25 h  =  41 km/h   mixed
 *   Guwahati  -> Shillong      98 km / 3.2  h  =  31 km/h   hill road
 *   Gangtok   -> Darjeeling    97 km / 4.0  h  =  24 km/h   TRUE MOUNTAIN
 */
import { osrmRouteGeometry, haversineKm } from '@/services/route-optimizer/geo';
import type { LatLng } from '@/services/route-optimizer/types';

async function elevationsOf(pts: LatLng[]): Promise<(number | null)[]> {
  const lat = pts.map((p) => p[0].toFixed(4)).join(',');
  const lng = pts.map((p) => p[1].toFixed(4)).join(',');
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
    const j: any = await r.json();
    return Array.isArray(j?.elevation) ? j.elevation.map((e: any) => (Number.isFinite(+e) ? Math.round(+e) : null)) : pts.map(() => null);
  } catch { return pts.map(() => null); }
}

function sample(coords: LatLng[], n: number): LatLng[] {
  if (coords.length <= n) return coords;
  const out: LatLng[] = [];
  for (let i = 0; i < n; i++) out.push(coords[Math.round((i * (coords.length - 1)) / (n - 1))]);
  return out;
}

async function measure(name: string, a: LatLng, b: LatLng, realHrs: number) {
  const geom = await osrmRouteGeometry(a, b);
  if (!geom) { console.log(`  ${name}: no geometry`); return; }

  const pts = sample(geom.coords, 80);
  const els = await elevationsOf(pts);

  let sampledKm = 0;
  for (let i = 0; i < pts.length - 1; i++) sampledKm += haversineKm(pts[i], pts[i + 1]);
  const scale = sampledKm > 0 ? geom.km / sampledKm : 1;

  let climb = 0, maxEl = 0, gradSum = 0, gradN = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const e0 = els[i], e1 = els[i + 1];
    if (e0 == null || e1 == null) continue;
    const segKm = haversineKm(pts[i], pts[i + 1]) * scale;
    const d = Math.abs(e1 - e0);
    climb += d;                                        // total vertical metres moved (up + down)
    maxEl = Math.max(maxEl, e0, e1);
    if (segKm > 0.2) { gradSum += d / (segKm * 1000); gradN++; }
  }
  const climbPerKm = geom.km > 0 ? climb / geom.km : 0;    // vertical metres per road km — the key statistic
  const meanGradPct = gradN ? (gradSum / gradN) * 100 : 0;
  const realSpeed = geom.km / realHrs;
  const osrmSpeed = geom.km / (geom.min / 60);

  console.log(
    `  ${name.padEnd(23)} ${String(geom.km).padStart(4)} km | maxEl ${String(maxEl).padStart(4)}m | ` +
    `CLIMB/km ${climbPerKm.toFixed(1).padStart(5)} m | grad ${meanGradPct.toFixed(2).padStart(5)}% | ` +
    `REAL ${realSpeed.toFixed(0).padStart(2)} km/h | OSRM ${osrmSpeed.toFixed(0).padStart(2)} km/h`);
}

console.log('\nMEASURE FIRST. The statistic that should predict speed is CLIMB PER KM.\n');
await measure('Delhi -> Agra', [28.6139, 77.2090], [27.1767, 78.0081], 3.75);
await measure('Shillong -> Kaziranga', [25.5689, 91.8831], [26.5775, 93.1711], 6.25);
await measure('Guwahati -> Shillong', [26.1844, 91.7458], [25.5689, 91.8831], 3.2);
await measure('Gangtok -> Darjeeling', [27.3257, 88.6122], [27.0360, 88.2627], 4.0);
console.log('\nIf CLIMB/km orders these the same way REAL km/h does, it is the variable to model on.\n');
process.exit(0);
