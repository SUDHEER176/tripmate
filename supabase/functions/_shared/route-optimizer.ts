// Finds the visiting order of a day's stops that minimises total travel time.
// Pure (no I/O) so the Edge Functions, the AI assistant and the tests share it.
//
// The route is an open path (the day can start and end anywhere) with one
// constraint: stops keep their time-of-day order, so morning stops come before
// afternoon stops and dinner never moves to breakfast. Days are small (3-8
// stops), so up to EXACT_LIMIT stops the optimum is found exactly with the
// Held-Karp dynamic programme (O(2^n · n^2)); larger days fall back to 2-opt.

export type TimeSlot = "morning" | "afternoon" | "evening";
export type Point = { lat: number; lng: number };
export type TravelMode = "DRIVE" | "WALK";

export type RouteStop = {
  id: string;
  lat: number | null;
  lng: number | null;
  time_slot: TimeSlot | null;
  start_time: string | null;
};

/** Pairwise travel costs; seconds[i][j] is the time from point i to point j. */
export type TravelMatrix = { seconds: number[][]; meters: number[][]; source: "google" | "estimate" };

export type RouteTotals = { seconds: number; meters: number };

export type RoutePlan = {
  /** Every stop id of the day in the new order (stops without coordinates keep their position). */
  order: string[];
  /** Start times re-assigned in visiting order, for stops whose time changes. */
  start_times: Record<string, string>;
  before: RouteTotals;
  after: RouteTotals;
  saved_seconds: number;
  /** True when the new order is meaningfully better than the current one. */
  changed: boolean;
  /** Stops left in place because they have no coordinates. */
  skipped: number;
};

export const EXACT_LIMIT = 12;
/** Ignore improvements smaller than this: not worth reshuffling someone's day. */
export const MIN_SAVING_SECONDS = 60;
export const MIN_SAVING_RATIO = 0.03;

const SLOT_RANK: Record<TimeSlot, number> = { morning: 0, afternoon: 1, evening: 2 };
// Roads are not straight lines; ~1.3 is a common urban detour factor.
const DETOUR_FACTOR = 1.3;
const SPEED_M_PER_S: Record<TravelMode, number> = { DRIVE: 25_000 / 3600, WALK: 4_800 / 3600 };
/** Below this spread, a day is walkable and walking times are used. */
export const WALKING_SPREAD_METERS = 2_500;

export function haversineMeters(a: Point, b: Point): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Walking when every stop is close to every other, otherwise driving. */
export function chooseTravelMode(points: Point[]): TravelMode {
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (haversineMeters(points[i], points[j]) > WALKING_SPREAD_METERS) return "DRIVE";
    }
  }
  return "WALK";
}

/** Straight-line estimate, used when no routing API is configured or it fails. */
export function estimateMatrix(points: Point[], mode: TravelMode): TravelMatrix {
  const meters = points.map((a) => points.map((b) => Math.round(haversineMeters(a, b) * DETOUR_FACTOR)));
  const seconds = meters.map((row) => row.map((m) => Math.round(m / SPEED_M_PER_S[mode])));
  return { seconds, meters, source: "estimate" };
}

export function pathTotals(order: number[], matrix: TravelMatrix): RouteTotals {
  let seconds = 0;
  let meters = 0;
  for (let i = 1; i < order.length; i += 1) {
    seconds += matrix.seconds[order[i - 1]][order[i]];
    meters += matrix.meters[order[i - 1]][order[i]];
  }
  return { seconds, meters };
}

function slotOf(stop: RouteStop): TimeSlot | null {
  if (stop.time_slot) return stop.time_slot;
  const hour = stop.start_time ? Number(stop.start_time.slice(0, 2)) : NaN;
  if (Number.isNaN(hour)) return null;
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

/** Bit mask, per stop, of the stops that must be visited before it (earlier time slot). */
function precedenceMasks(ranks: (number | null)[]): number[] {
  return ranks.map((rank) => {
    let mask = 0;
    if (rank === null) return mask;
    ranks.forEach((other, k) => {
      if (other !== null && other < rank) mask |= 1 << k;
    });
    return mask;
  });
}

function respectsSlots(order: number[], ranks: (number | null)[]): boolean {
  let highest = -1;
  for (const i of order) {
    const rank = ranks[i];
    if (rank === null) continue;
    if (rank < highest) return false;
    highest = rank;
  }
  return true;
}

/** Exact optimum by Held-Karp over subsets, honouring the slot precedence. */
function heldKarp(cost: number[][], ranks: (number | null)[]): number[] {
  const n = cost.length;
  const full = (1 << n) - 1;
  const before = precedenceMasks(ranks);
  const dp = Array.from({ length: 1 << n }, () => new Float64Array(n).fill(Infinity));
  const parent = Array.from({ length: 1 << n }, () => new Int8Array(n).fill(-1));

  for (let j = 0; j < n; j += 1) if (before[j] === 0) dp[1 << j][j] = 0;

  for (let mask = 1; mask <= full; mask += 1) {
    for (let last = 0; last < n; last += 1) {
      const current = dp[mask][last];
      if (current === Infinity) continue;
      for (let next = 0; next < n; next += 1) {
        const bit = 1 << next;
        if (mask & bit || (before[next] & mask) !== before[next]) continue;
        const value = current + cost[last][next];
        if (value < dp[mask | bit][next]) {
          dp[mask | bit][next] = value;
          parent[mask | bit][next] = last;
        }
      }
    }
  }

  let end = 0;
  for (let j = 1; j < n; j += 1) if (dp[full][j] < dp[full][end]) end = j;
  const order: number[] = [];
  for (let mask = full, at = end; at !== -1; ) {
    order.push(at);
    const prev = parent[mask][at];
    mask &= ~(1 << at);
    at = prev;
  }
  return order.reverse();
}

/** 2-opt local search from a slot-respecting start; for days too large for Held-Karp. */
function twoOpt(cost: number[][], ranks: (number | null)[]): number[] {
  const n = cost.length;
  // Start from the current order, stably grouped by slot (unslotted stops follow their predecessor).
  let carried = 0;
  const effective = ranks.map((rank) => (rank === null ? carried : (carried = rank)));
  let order = Array.from({ length: n }, (_, i) => i).sort((a, b) => effective[a] - effective[b] || a - b);
  const total = (o: number[]) => o.reduce((sum, at, i) => (i ? sum + cost[o[i - 1]][at] : 0), 0);

  let best = total(order);
  for (let improved = true, rounds = 0; improved && rounds < 100; rounds += 1) {
    improved = false;
    for (let i = 0; i < n - 1; i += 1) {
      for (let k = i + 1; k < n; k += 1) {
        const candidate = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
        if (!respectsSlots(candidate, ranks)) continue;
        const value = total(candidate);
        if (value < best - 1e-9) {
          order = candidate;
          best = value;
          improved = true;
        }
      }
    }
  }
  return order;
}

/** Index order of `stops` with the least total travel time. */
export function bestOrder(cost: number[][], ranks: (number | null)[]): number[] {
  if (cost.length <= 2) return cost.map((_, i) => i);
  return cost.length <= EXACT_LIMIT ? heldKarp(cost, ranks) : twoOpt(cost, ranks);
}

/** Points of the stops that have coordinates, in day order. */
export function locatedPoints(stops: RouteStop[]): Point[] {
  return stops.filter(isLocated).map((stop) => ({ lat: stop.lat as number, lng: stop.lng as number }));
}

function isLocated(stop: RouteStop): boolean {
  return Number.isFinite(stop.lat) && Number.isFinite(stop.lng) && stop.lat !== null && stop.lng !== null;
}

/**
 * Plans the best order for a day. `matrix` must cover `locatedPoints(stops)`
 * in the same order.
 */
export function planDayRoute(stops: RouteStop[], matrix: TravelMatrix): RoutePlan {
  const locatedIdx = stops.flatMap((stop, i) => (isLocated(stop) ? [i] : []));
  const located = locatedIdx.map((i) => stops[i]);
  const identity = located.map((_, i) => i);
  const before = pathTotals(identity, matrix);
  const unchanged: RoutePlan = {
    order: stops.map((stop) => stop.id),
    start_times: {},
    before,
    after: before,
    saved_seconds: 0,
    changed: false,
    skipped: stops.length - located.length,
  };
  if (located.length < 3) return unchanged;

  const ranks = located.map((stop) => {
    const slot = slotOf(stop);
    return slot ? SLOT_RANK[slot] : null;
  });
  const order = bestOrder(matrix.seconds, ranks);
  const after = pathTotals(order, matrix);
  const saved = before.seconds - after.seconds;
  if (saved < MIN_SAVING_SECONDS || saved < before.seconds * MIN_SAVING_RATIO) return unchanged;

  // Located stops take the located positions in their new order; the others stay put.
  const newStops = [...stops];
  locatedIdx.forEach((position, k) => (newStops[position] = located[order[k]]));

  // Keep the day's clock running forwards: hand out the existing start times in visiting order.
  const times = newStops.flatMap((stop) => (stop.start_time ? [stop.start_time] : [])).sort();
  const start_times: Record<string, string> = {};
  let t = 0;
  for (const stop of newStops) {
    if (!stop.start_time) continue;
    const time = times[t++];
    if (time !== stop.start_time) start_times[stop.id] = time;
  }

  return {
    order: newStops.map((stop) => stop.id),
    start_times,
    before,
    after,
    saved_seconds: saved,
    changed: true,
    skipped: unchanged.skipped,
  };
}
