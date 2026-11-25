import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../../functions/_shared/http.js";
import {
  basePackingList,
  normalizeAiPacking,
  parsePackingList,
  parseWeatherHint,
  PACKING_LIMITS,
} from "../../functions/_shared/packing.js";
import { newShareId, publicTripView } from "../../functions/_shared/trips-repo.js";
import { parseShareId } from "../../functions/shared/index.js";
import { matchRoute } from "../../functions/trips/routes.js";

const TRIP_ID = "6f1c2c56-1a7e-4c3b-9a0e-2b3c4d5e6f70";

const trip = {
  id: TRIP_ID,
  user_id: "owner-uid",
  title: "Goa getaway",
  destination: "Goa, India",
  start_date: "2026-12-10",
  end_date: "2026-12-14",
  travelers: 2,
  budget: 40000,
  interests: ["nature", "nightlife"],
  pace: "moderate",
  notes: "private preferences",
  share_id: "abcdEFGHijklMNOP1234",
  itinerary_days: [
    {
      id: "d1",
      day_number: 1,
      date: "2026-12-10",
      title: "Beaches",
      summary: "",
      activities: [
        { id: "a1", name: "Baga beach", category: "sightseeing", sort_order: 0, notes: "secret", estimated_cost: 0 },
      ],
    },
  ],
  expenses: [{ id: "e1", category: "food", title: "Snacks", amount: 500, quantity: 1, cost_basis: "total", activity_id: null, source: "user" }],
  packing_list: [{ id: "p1", text: "Swimwear", category: "clothing", packed: true }],
};

test("share and packing routes", () => {
  assert.equal(matchRoute("POST", `/api/trips/${TRIP_ID}/share`).name, "shareTrip");
  assert.equal(matchRoute("DELETE", `/api/trips/${TRIP_ID}/share`).name, "unshareTrip");
  assert.equal(matchRoute("PATCH", `/api/trips/${TRIP_ID}/packing-list`).name, "updatePackingList");
  assert.equal(
    matchRoute("POST", `/api/trips/${TRIP_ID}/packing-list/generate`).name,
    "generatePackingList",
  );
  assert.throws(() => matchRoute("GET", `/api/trips/${TRIP_ID}/share`), (e) => e.status === 405);
  assert.throws(() => matchRoute("POST", `/api/trips/${TRIP_ID}/packing-list/x`), (e) => e.status === 404);
});

test("share ids are long, URL-safe and unique; bad ids are rejected", () => {
  const a = newShareId();
  assert.match(a, /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(a, newShareId());
  assert.equal(parseShareId(`/api/shared/${a}`), a);
  for (const bad of ["/api/shared/", "/api/shared/short", "/api/shared/bad$chars!!!!!!!!!!!", `/api/shared/${a}/x`]) {
    assert.throws(() => parseShareId(bad), (e) => e instanceof ApiError && e.status === 404);
  }
});

test("public view hides the owner, private notes, expenses and packing list", () => {
  const view = publicTripView(trip);
  const json = JSON.stringify(view);
  for (const hidden of ["owner-uid", "private preferences", "secret", "share_id", "Snacks", "Swimwear"]) {
    assert.ok(!json.includes(hidden), `${hidden} should not be public`);
  }
  assert.equal(view.itinerary_days[0].activities[0].name, "Baga beach");
  assert.equal(view.estimated_total, 500);
});

test("rule-based packing list adapts to trip and weather", () => {
  const plain = basePackingList(trip);
  assert.ok(plain.length >= 15);
  assert.ok(plain.every((i) => i.id && i.packed === false));
  assert.ok(plain.some((i) => /swimwear/i.test(i.text)), "beach destination");
  assert.ok(plain.some((i) => /5 sets/.test(i.text)), "clothes scale with days");

  const coldRainy = basePackingList(trip, { min_temp: 5, max_temp: 14, rainy_days: 2 });
  assert.ok(coldRainy.some((i) => /warm jacket/i.test(i.text)));
  assert.ok(coldRainy.some((i) => /umbrella/i.test(i.text)));
});

test("packing list validation", () => {
  const items = parsePackingList({
    items: [
      { id: "p1", text: "  Charger ", category: "electronics", packed: true },
      { id: "p1", text: "Hat", category: "nonsense" },
      { text: "Socks" },
    ],
  });
  assert.equal(items[0].text, "Charger");
  assert.equal(items[0].packed, true);
  assert.equal(items[1].category, "other");
  assert.notEqual(items[1].id, "p1", "duplicate id replaced");
  assert.ok(items[2].id);

  assert.throws(() => parsePackingList({}), (e) => e.status === 422);
  assert.throws(() => parsePackingList({ items: [{ text: "" }] }), (e) => e.status === 422);
  assert.throws(
    () => parsePackingList({ items: Array.from({ length: PACKING_LIMITS.maxItems + 1 }, () => ({ text: "x" })) }),
    (e) => e.status === 422,
  );
});

test("AI packing output is cleaned and weather hints are bounded", () => {
  const items = normalizeAiPacking({
    items: [{ text: "Sunscreen", category: "toiletries" }, { text: "sunscreen" }, { text: "" }, { text: "Map", category: "??" }],
  });
  assert.deepEqual(items.map((i) => [i.text, i.category]), [["Sunscreen", "toiletries"], ["Map", "other"]]);
  assert.deepEqual(normalizeAiPacking(null), []);

  assert.equal(parseWeatherHint("hot"), null);
  assert.deepEqual(parseWeatherHint({ min_temp: 10.4, max_temp: 999, rainy_days: 1 }), {
    min_temp: 10,
    max_temp: null,
    rainy_days: 1,
  });
});
