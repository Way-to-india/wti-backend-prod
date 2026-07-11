/**
 * Stage C — Open-path sequencing (asymmetric TSP path, not a cycle).
 *
 * Input is a scalar cost matrix `cost[i][j]` (already reduced from the option pool
 * to each pair's best option under the chosen objective, with structural penalties
 * folded in by the caller). Output is the visiting order (indices into the matrix).
 *
 *   n ≤ HELD_KARP_MAX : exact Held-Karp bitmask DP (open path, optional fixed
 *                       start/end; free endpoints try all start/end pairs).
 *   n  > HELD_KARP_MAX : nearest-neighbour seed + 2-opt local search (zero deps).
 *
 * Held-Karp open path is O(n²·2ⁿ) — fine to ~13 nodes (8192·169 ≈ 1.4M ops).
 */

export const HELD_KARP_MAX = 13;
const INF = Number.POSITIVE_INFINITY;

export interface SequenceOptions {
  /** index of a forced first city, or null for free. */
  start?: number | null;
  /** index of a forced last city, or null for free. */
  end?: number | null;
}

export function pathCost(order: number[], cost: number[][]): number {
  let s = 0;
  for (let i = 1; i < order.length; i++) s += cost[order[i - 1]][order[i]] ?? INF;
  return s;
}

/** Exact open-path Held-Karp with a fixed start. Returns best order + cost. */
function heldKarpFixedStart(cost: number[][], start: number, end: number | null): { order: number[]; cost: number } {
  const n = cost.length;
  const FULL = 1 << n;
  // dp[mask][j] = min cost of a path starting at `start`, visiting exactly `mask`, ending at j.
  const dp = Array.from({ length: FULL }, () => new Float64Array(n).fill(INF));
  const par = Array.from({ length: FULL }, () => new Int16Array(n).fill(-1));
  dp[1 << start][start] = 0;

  for (let mask = 0; mask < FULL; mask++) {
    if (!(mask & (1 << start))) continue;
    for (let j = 0; j < n; j++) {
      if (!(mask & (1 << j)) || dp[mask][j] === INF) continue;
      const base = dp[mask][j];
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue;
        const nm = mask | (1 << k);
        const c = base + (cost[j][k] ?? INF);
        if (c < dp[nm][k]) { dp[nm][k] = c; par[nm][k] = j; }
      }
    }
  }

  let bestEnd = -1, best = INF;
  const full = FULL - 1;
  for (let j = 0; j < n; j++) {
    if (end != null && j !== end) continue;
    if (dp[full][j] < best) { best = dp[full][j]; bestEnd = j; }
  }
  // reconstruct
  const order: number[] = [];
  let mask = full, j = bestEnd;
  while (j !== -1) { order.push(j); const p = par[mask][j]; mask ^= (1 << j); j = p; }
  order.reverse();
  return { order, cost: best };
}

function nearestNeighbour(cost: number[][], start: number): number[] {
  const n = cost.length;
  const seen = new Set([start]);
  const order = [start];
  let cur = start;
  while (order.length < n) {
    let best = -1, bd = INF;
    for (let k = 0; k < n; k++) if (!seen.has(k) && (cost[cur][k] ?? INF) < bd) { bd = cost[cur][k]; best = k; }
    if (best === -1) break;
    order.push(best); seen.add(best); cur = best;
  }
  return order;
}

/** 2-opt improving open path; respects fixed start/end by not moving those endpoints. */
function twoOpt(order: number[], cost: number[][], fixStart: boolean, fixEnd: boolean): number[] {
  const n = order.length;
  let improved = true;
  const lo = fixStart ? 1 : 0;
  while (improved) {
    improved = false;
    for (let i = lo; i < n - 1; i++) {
      for (let k = i + 1; k < (fixEnd ? n - 1 : n); k++) {
        const a = order[i - 1] ?? -1;
        const cand = order.slice();
        // reverse segment [i..k]
        let l = i, r = k;
        while (l < r) { [cand[l], cand[r]] = [cand[r], cand[l]]; l++; r--; }
        if (pathCost(cand, cost) + 1e-9 < pathCost(order, cost)) { order = cand; improved = true; }
        void a;
      }
    }
  }
  return order;
}

export function sequence(cost: number[][], opts: SequenceOptions = {}): { order: number[]; cost: number } {
  const n = cost.length;
  if (n <= 1) return { order: n === 1 ? [0] : [], cost: 0 };
  if (n === 2) return { order: [0, 1], cost: cost[0][1] ?? INF };

  // HARDENING (2026-07-11): a caller can hand us a stale index (e.g. the start
  // city was dropped upstream because its coordinates could not be resolved,
  // so findIndex returned -1). An out-of-range index must degrade to a FREE
  // start/end, never reach the DP (1 << -1 corrupts the mask and crashes).
  const rawStart = opts.start ?? null;
  const rawEnd = opts.end ?? null;
  const start = rawStart != null && rawStart >= 0 && rawStart < n ? rawStart : null;
  const end = rawEnd != null && rawEnd >= 0 && rawEnd < n ? rawEnd : null;

  if (n <= HELD_KARP_MAX) {
    if (start != null) return heldKarpFixedStart(cost, start, end);
    // free start: try every start (and let end float or be fixed); keep the best.
    let best: { order: number[]; cost: number } = { order: [], cost: INF };
    for (let s = 0; s < n; s++) {
      const r = heldKarpFixedStart(cost, s, end);
      if (r.cost < best.cost) best = r;
    }
    return best;
  }

  // Large n — heuristic.
  const seed = nearestNeighbour(cost, start ?? 0);
  const order = twoOpt(seed, cost, start != null, end != null);
  return { order, cost: pathCost(order, cost) };
}
