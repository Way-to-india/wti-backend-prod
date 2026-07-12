/**
 * PROBE — validate the elevation-PROFILE road model before building it in.
 *
 * FOUNDER: "It should be as accurate as possible."
 *
 * So we do not guess a ghat length. We take the ACTUAL ROUTE from OSRM, sample it,
 * ask the earth how high each sample is, and charge each kilometre at the speed its
 * own terrain deserves — 22 km/h where it is mountain, 55 where it is plain.
 *
 * Ground truth to beat (real-world driving times):
 *   Guwahati  -> Shillong   ~98 km    about 3 to 3.5 hours
 *   Shillong  -> Kaziranga  ~279 km   about 6 to 6.5 hours
 *   Delhi     -> Agra       ~230 km   about 3.5 to 4 hours   (must NOT be slowed)
 *   Gangtok   -> Darjeeling ~100 km   about 4 hours          (mountain throughout)
 *
 * If the model cannot reproduce these, it does not get built.
 */
import { osrmRouteGeometry, haversineKm } from '@/services/route-optimizer/geo';
import type { LatLng } from '@/services/route-optimizer/types';

const HILL_M = 1200, ROLLING_M = 600;
const SPEED = { hill: 22, rolling: 42, plain: 55 };   // the founder's numbers; rolling is the shipped rqi-3

async function elevationsOf(pts: LatLng[]): Promise<(number | null)[]> {
  const lat = pts.map((p) => p[0].toFixed(4)).join(',');
  const lng = pts.map((p) => p[1].toFixed(4)).join(',');
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
    const j: any = await r.json();
    return Array.isArray(j?.elevation) ? j.elevation.map((e: any) => (Number.isFinite(+e) ? Math.round(+e) : null)) : pts.map(() => null);
  } catch { return pts.map(() => null); }
}

/** Thin the OSRM polyline down to N evenly-spaced samples. */
function sample(coords: LatLng[], n: number): LatLng[] {
  if (coords.length <= n) return coords;
  const out: LatLng[] = [];
  for (let i = 0; i < n; i++) out.push(coords[Math.round((i * (coords.length - 1)) / (n - 1))]);
  return out;
}

function speedFor(elevM: number): number {
  if (elevM >= HILL_M) return SPEED.hill;
  if (elevM >= ROLLING_M) return SPEED.rolling;
  return SPEED.plain;
}

async function leg(name: string, a: LatLng, b: LatLng, truthHrs: string, realHrs: number) {
  const geom = await osrmRouteGeometry(a, b);
  if (!geom) { console.log(`  ${name}: OSRM gave no geometry`); return; }

  const pts = sample(geom.coords, 60);
  const els = await elevationsOf(pts);

  // charge every segment at the speed ITS OWN terrain deserves
  let hrs = 0, hillKm = 0, plainKm = 0, rollKm = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const segKm = haversineKm(pts[i], pts[i + 1]);
    const e0 = els[i], e1 = els[i + 1];
    if (e0 == null || e1 == null) { hrs += segKm / SPEED.plain; plainKm += segKm; continue; }
    const mean = (e0 + e1) / 2;
    const v = speedFor(mean);
    hrs += segKm / v;
    if (v === SPEED.hill) hillKm += segKm; else if (v === SPEED.rolling) rollKm += segKm; else plainKm += segKm;
  }

  // the sampled polyline is shorter than the true road; scale back up to OSRM's real km
  const sampledKm = hillKm + rollKm + plainKm;
  const scale = sampledKm > 0 ? geom.km / sampledKm : 1;
  const trueHrs = hrs * scale;

  const osrmHrs = geom.min / 60;
  console.log(`  ${name.padEnd(24)} ${String(geom.km).padStart(4)} km  ` +
    `hill ${(hillKm * scale).toFixed(0).padStart(3)} / roll ${(rollKm * scale).toFixed(0).padStart(3)} / plain ${(plainKm * scale).toFixed(0).padStart(3)} km  ` +
    `=> PROFILE ${trueHrs.toFixed(1)} h   (OSRM said ${osrmHrs.toFixed(1)} h)   TRUTH: ${truthHrs}`);
}

const P: Record<string, LatLng> = {
  guwahati: [26.1844, 91.7458],
  shillong: [25.5689, 91.8831],
  kaziranga: [26.5775, 93.1711],
  delhi: [28.6139, 77.2090],
  agra: [27.1767, 78.0081],
  gangtok: [27.3257, 88.6122],
  darjeeling: [27.0360, 88.2627],
};

console.log('\nPROBE — elevation-PROFILE road model. Does it reproduce reality?\n');
await leg('Guwahati -> Shillong', P.guwahati, P.shillong, '~3 to 3.5 h');
await leg('Shillong -> Kaziranga', P.shillong, P.kaziranga, '~6 to 6.5 h');
await leg('Gangtok -> Darjeeling', P.gangtok, P.darjeeling, '~4 h');
await leg('Delhi -> Agra (PLAINS)', P.delhi, P.agra, '~3.5 to 4 h  (must NOT slow)');
console.log('');
process.exit(0);
