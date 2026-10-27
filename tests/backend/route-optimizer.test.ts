import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bestOrder,
  chooseTravelMode,
  estimateMatrix,
  haversineMeters,
  pathTotals,
  planDayRoute,
  type RouteStop,
  type TimeSlot,
  type TravelMatrix,
} from "../../supabase/functions/_shared/route-optimizer.ts";
import { googleRouteMatrix, travelMatrix } from "../../supabase/functions/_shared/travel-matrix.ts";
import { parseOptimizeRouteInput } from "../../supabase/functions/_shared/trip-actions.ts";
import { ValidationError } from "../../supabase/functions/_shared/http.ts";

/** Deterministic pseudo-random numbers so failures are reproducible. */
function rng(seed: number) {
  return () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
}

function permutations(items: number[]): number[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

function cost(order: number[], m: number[][]) {
  return order.reduce((sum, at, i) => (i ? sum + m[order[i - 1]][at] : 0), 0);
}

function slotsOk(order: number[], ranks: (number | null)[]) {
  const seen = order.map((i) => ranks[i]).filter((r): r is number => r !== null);
  return seen.every((r, i) => i === 0 || seen[i - 1] <= r);
}

const stop = (id: string, lat: number | null, lng: number | null, slot: TimeSlot | null, time: string | null): RouteStop => ({
  id,
  lat,
  lng,
  time_slot: slot,
  start_time: time,
});

test("haversine distance matches known city pairs", () => {
  const delhiToMumbai = haversineMeters({ lat: 28.6139, lng: 77.209 }, { lat: 19.076, lng: 72.8777 });
  assert.ok(Math.abs(delhiToMumbai - 1_148_000) < 10_000, `got ${delhiToMumbai}`);
  assert.equal(haversineMeters({ lat: 10, lng: 10 }, { lat: 10, lng: 10 }), 0);
});

test("Held-Karp finds the true optimum under time-slot order (vs brute force)", () => {
  const random = rng(42);
  for (let round = 0; round < 25; round += 1) {
    const n = 3 + (round % 5); // 3..7 stops
    const m = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 0 : Math.round(random() * 3600))),
    );
    const ranks = Array.from({ length: n }, () => {
      const r = Math.floor(random() * 4);
      return r === 3 ? null : r;
    });
    const valid = permutations(Array.from({ length: n }, (_, i) => i)).filter((p) => slotsOk(p, ranks));
    const optimum = Math.min(...valid.map((p) => cost(p, m)));
    const order = bestOrder(m, ranks);
    assert.equal(new Set(order).size, n, "every stop exactly once");
    assert.ok(slotsOk(order, ranks), "slots respected");
    assert.equal(cost(order, m), optimum, `round ${round}`);
  }
});

test("2-opt handles days too large for the exact search", () => {
  const random = rng(7);
  const n = 16;
  const points = Array.from({ length: n }, () => ({ lat: 35 + random() * 0.1, lng: 135.7 + random() * 0.1 }));
  const ranks = points.map((_, i) => (i < 5 ? 0 : i < 11 ? 1 : 2));
  const matrix = estimateMatrix(points, "DRIVE");
  const identity = points.map((_, i) => i);
  const order = bestOrder(matrix.seconds, ranks);
  assert.equal(new Set(order).size, n);
  assert.ok(slotsOk(order, ranks));
  assert.ok(cost(order, matrix.seconds) <= cost(identity, matrix.seconds));
});

test("planDayRoute untangles a zig-zag day, keeps slots, and re-times stops in order", () => {
  // Four stops on a line, visited out of order: 0 → 2 → 1 → 3 km.
  const km = (x: number) => 35 + x / 111;
  const stops = [
    stop("a", km(0), 135, "morning", "09:00"),
    stop("c", km(2), 135, "afternoon", "11:30"),
    stop("note", null, null, null, null), // no coordinates: stays where it is
    stop("b", km(1), 135, "afternoon", "13:00"),
    stop("d", km(3), 135, "evening", "19:00"),
  ];
  const points = stops.filter((s) => s.lat !== null).map((s) => ({ lat: s.lat!, lng: s.lng! }));
  const plan = planDayRoute(stops, estimateMatrix(points, "DRIVE"));

  assert.equal(plan.changed, true);
  assert.deepEqual(plan.order, ["a", "b", "note", "c", "d"]);
  assert.deepEqual(plan.start_times, { b: "11:30", c: "13:00" });
  assert.ok(plan.after.seconds < plan.before.seconds);
  assert.equal(plan.saved_seconds, plan.before.seconds - plan.after.seconds);
  assert.equal(plan.skipped, 1);
});

test("planDayRoute never moves an evening stop before a morning one", () => {
  // The evening stop is right next to the start, so ignoring slots would visit it second.
  const stops = [
    stop("hotel", 35.0, 135.0, "morning", "08:00"),
    stop("far", 35.05, 135.0, "afternoon", "13:00"),
    stop("near", 35.01, 135.0, "afternoon", "15:00"),
    stop("dinner", 35.0005, 135.0, "evening", "19:30"),
  ];
  const points = stops.map((s) => ({ lat: s.lat!, lng: s.lng! }));
  const matrix = estimateMatrix(points, "DRIVE");
  const unconstrained = bestOrder(matrix.seconds, [null, null, null, null]);
  assert.notEqual(unconstrained.at(-1), 3, "without slots, dinner would not be last");

  const plan = planDayRoute(stops, matrix);
  assert.equal(plan.order[0], "hotel");
  assert.equal(plan.order[plan.order.length - 1], "dinner");
});

test("already-efficient and tiny days are left alone", () => {
  const line = [0, 1, 2, 3].map((x, i) => stop(`s${i}`, 35 + x / 111, 135, null, null));
  const points = line.map((s) => ({ lat: s.lat!, lng: s.lng! }));
  const plan = planDayRoute(line, estimateMatrix(points, "WALK"));
  assert.equal(plan.changed, false);
  assert.deepEqual(plan.order, ["s0", "s1", "s2", "s3"]);
  assert.deepEqual(plan.start_times, {});

  const two = line.slice(0, 2);
  const small = planDayRoute(two, estimateMatrix(points.slice(0, 2), "WALK"));
  assert.equal(small.changed, false);
  assert.equal(small.saved_seconds, 0);
});

test("travel mode is walking only when every stop is close", () => {
  assert.equal(chooseTravelMode([{ lat: 35, lng: 135 }, { lat: 35.01, lng: 135 }]), "WALK");
  assert.equal(chooseTravelMode([{ lat: 35, lng: 135 }, { lat: 35.1, lng: 135 }]), "DRIVE");
});

test("Google Routes matrix is requested with a field mask and parsed (zero indexes omitted)", async () => {
  const points = [
    { lat: 35, lng: 135 },
    { lat: 35.01, lng: 135 },
    { lat: 35.02, lng: 135 },
  ];
  let seen: { url: string; headers: Headers; body: Record<string, any> } | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  const fake = (async (url: string, init: RequestInit) => {
    seen = { url, headers: new Headers(init.headers), body: JSON.parse(String(init.body)) };
    return new Response(
      JSON.stringify([
        { destinationIndex: 1, duration: "600s", distanceMeters: 1200, condition: "ROUTE_EXISTS" }, // origin 0 omitted
        { originIndex: 1, destinationIndex: 2, duration: "420s", distanceMeters: 900, condition: "ROUTE_EXISTS" },
        { originIndex: 2, destinationIndex: 0, condition: "ROUTE_NOT_FOUND" },
      ]),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  const matrix = await googleRouteMatrix("server-key", points, "WALK", fake);
  assert.equal(seen!.url, "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix");
  assert.equal(seen!.headers.get("x-goog-api-key"), "server-key");
  assert.match(seen!.headers.get("x-goog-fieldmask")!, /duration/);
  assert.equal(seen!.body.travelMode, "WALK");
  assert.equal(seen!.body.routingPreference, undefined, "routing preference is only valid for driving");
  assert.equal(seen!.body.origins.length, 3);

  assert.equal(matrix.source, "google");
  assert.equal(matrix.seconds[0][1], 600);
  assert.equal(matrix.meters[1][2], 900);
  const estimate = estimateMatrix(points, "WALK");
  assert.equal(matrix.seconds[2][0], estimate.seconds[2][0], "missing routes keep the estimate");
});

test("routing problems fall back to the estimate instead of failing", async () => {
  const points = [
    { lat: 35, lng: 135 },
    { lat: 35.01, lng: 135 },
    { lat: 35.02, lng: 135 },
  ];
  const denied = (async () => new Response("API key not valid", { status: 403 })) as unknown as typeof fetch;
  const down = (async () => {
    throw new TypeError("network down");
  }) as unknown as typeof fetch;
  const untouched = (async () => assert.fail("no key means no request")) as unknown as typeof fetch;

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    for (const [key, fetchImpl] of [
      ["k", denied],
      ["k", down],
      [undefined, untouched],
    ] as const) {
      const matrix: TravelMatrix = await travelMatrix(points, "DRIVE", key, fetchImpl);
      assert.equal(matrix.source, "estimate");
      assert.deepEqual(matrix.seconds, estimateMatrix(points, "DRIVE").seconds);
    }
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(pathTotals([0, 1, 2], estimateMatrix(points, "DRIVE")).seconds > 0, true);
});

test("optimize-route input is validated", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(parseOptimizeRouteInput({ itinerary_day_id: id.toUpperCase() }), { itinerary_day_id: id, apply: false });
  assert.deepEqual(parseOptimizeRouteInput({ itinerary_day_id: id, apply: true }), { itinerary_day_id: id, apply: true });
  for (const bad of [{}, { itinerary_day_id: "x" }, { itinerary_day_id: id, apply: "yes" }, { itinerary_day_id: id, extra: 1 }]) {
    assert.throws(() => parseOptimizeRouteInput(bad), ValidationError);
  }
});
