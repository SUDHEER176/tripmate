// End-to-end tests against a running Supabase stack (local or a staging project).
//
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... MOCK_LLM_URL=http://127.0.0.1:8787 \
//     npm run test:integration
//
// Requires the migrations applied, all Edge Functions served, and an LLM
// endpoint (tests/integration/mock-llm-server.ts locally). Skips when
// SUPABASE_URL is not set.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculateBudget, type BudgetExpense } from "../../supabase/functions/_shared/budget.ts";

const URL_ = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY ?? "";
const skip = !URL_ || !ANON ? "SUPABASE_URL / SUPABASE_ANON_KEY not set" : false;

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type User = { email: string; password: string; token: string; id: string; client: SupabaseClient };

function isoDate(offsetDays: number) {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

async function call(path: string, opts: { method?: string; body?: unknown; token?: string; raw?: string } = {}) {
  const headers: Record<string, string> = { apikey: ANON };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined || opts.raw !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${URL_}/functions/v1/${path}`, {
    method: opts.method ?? (opts.body !== undefined || opts.raw !== undefined ? "POST" : "GET"),
    headers,
    body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  const text = await res.text();
  let json: Json = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function newUser(label: string): Promise<User> {
  const client = createClient(URL_!, ANON, { auth: { persistSession: false } });
  const email = `it-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = `Pw-${Math.random().toString(36).slice(2)}-9!`;
  const { data, error } = await client.auth.signUp({ email, password });
  assert.ifError(error);
  assert.ok(data.session, "local auth must not require email confirmation");
  return { email, password, token: data.session!.access_token, id: data.user!.id, client };
}

const tripRequest = () => ({
  destination: "Jaipur",
  start_date: isoDate(10),
  end_date: isoDate(12),
  travelers: 2,
  budget: 40000,
  travel_style: "mid_range",
  interests: ["food", "history"],
  pace: "moderate",
  preferences: "Vegetarian",
});

let alice: User;
let bob: User;
let tripId: string;

before(async () => {
  if (skip) return;
  alice = await newUser("alice");
  bob = await newUser("bob");
});

test("authentication is required", { skip }, async () => {
  const noToken = await call("generate-itinerary", { body: tripRequest() });
  assert.equal(noToken.status, 401);
  const badToken = await call("trips", { token: "not-a-jwt" });
  assert.equal(badToken.status, 401);
  const anonAsUser = await call("trips", { token: ANON });
  assert.equal(anonAsUser.status, 401);
});

test("invalid generation input is rejected before calling the AI", { skip }, async () => {
  const cases: [Json, string][] = [
    [{ ...tripRequest(), end_date: isoDate(5) }, "end_date"],
    [{ ...tripRequest(), budget: 10 }, "budget"],
    [{ ...tripRequest(), travelers: 0 }, "travelers"],
    [{ ...tripRequest(), destination: "<b>x</b>" }, "destination"],
    [{ ...tripRequest(), start_date: isoDate(-30), end_date: isoDate(-28) }, "start_date"],
    [{ ...tripRequest(), user_id: bob?.id }, "user_id"],
  ];
  for (const [body, field] of cases) {
    const res = await call("generate-itinerary", { body, token: alice.token });
    assert.equal(res.status, 422, `expected 422 for ${field}: ${JSON.stringify(res.json)}`);
    assert.equal(res.json.error.code, "VALIDATION_FAILED");
    assert.ok(res.json.error.details.fields[field], `field ${field} flagged`);
  }
  const bad = await call("generate-itinerary", { raw: "{not json", token: alice.token });
  assert.equal(bad.status, 400);
  const big = await call("generate-itinerary", { body: { ...tripRequest(), preferences: "x".repeat(40_000) }, token: alice.token });
  assert.equal(big.status, 413);
});

test("generates, validates and saves a complete itinerary", { skip }, async () => {
  const res = await call("generate-itinerary", { body: tripRequest(), token: alice.token });
  assert.equal(res.status, 201, JSON.stringify(res.json));
  const data = res.json.data;
  tripId = data.trip_id;
  assert.ok(tripId);
  assert.ok(data.disclaimer.includes("estimates"));

  const trip = data.trip;
  assert.equal(trip.user_id, alice.id);
  assert.equal(trip.status, "planned");
  assert.equal(trip.currency, "INR");
  assert.equal(trip.itinerary_days.length, 3);
  for (const day of trip.itinerary_days) {
    const slots = new Set(day.activities.map((a: Json) => a.time_slot));
    assert.ok(slots.has("morning") && slots.has("afternoon") && slots.has("evening"));
    for (const a of day.activities) {
      assert.ok(a.description && a.location_name && a.duration_minutes > 0);
      assert.equal(a.cost_is_estimate, true);
    }
  }

  // Accommodation: one nightly expense for 2 nights; the check-in activity carries no cost.
  const stays = trip.expenses.filter((e: Json) => e.category === "accommodation");
  assert.equal(stays.length, 1);
  assert.equal(stays[0].quantity, 2);
  assert.equal(stays[0].cost_basis, "per_night");

  // Every priced activity has exactly one linked expense.
  const priced = trip.itinerary_days.flatMap((d: Json) => d.activities).filter((a: Json) => a.estimated_cost > 0);
  const linked = trip.expenses.filter((e: Json) => e.source === "activity");
  assert.equal(linked.length, priced.length);
  assert.equal(new Set(linked.map((e: Json) => e.activity_id)).size, linked.length);

  // Server budget equals the shared calculation over the stored expenses.
  const expected = calculateBudget({ budget: 40000, travelers: 2, expenses: trip.expenses as BudgetExpense[] });
  assert.deepEqual(trip.budget_summary, expected);
  assert.equal(trip.budget, 40000, "numeric budget is not shadowed");
  assert.equal(trip.total_estimated_cost, expected.estimated_total);
  // 2 nights × 4000 stay + 2 × 1800 trains + 3 days × 400 autos + 2 travelers × (200 + 200 + 3 × (450 + 900))
  assert.equal(expected.estimated_total, 8000 + 3600 + 1200 + 2 * (400 + 3 * 1350));
});

test("persists across sessions (refresh) and lists only the owner's trips", { skip }, async () => {
  const fresh = createClient(URL_!, ANON, { auth: { persistSession: false } });
  const { data, error } = await fresh.auth.signInWithPassword({ email: alice.email, password: alice.password });
  assert.ifError(error);
  const token = data.session!.access_token;

  const got = await call(`trips/${tripId}`, { token });
  assert.equal(got.status, 200);
  assert.equal(got.json.data.itinerary_days.length, 3);

  const list = await call("trips", { token });
  assert.equal(list.status, 200);
  assert.ok(list.json.data.some((t: Json) => t.id === tripId));
  const bobList = await call("trips", { token: bob.token });
  assert.equal(bobList.json.data.some((t: Json) => t.id === tripId), false);
});

test("other users cannot read or modify the trip (API and direct table access)", { skip }, async () => {
  const trip = (await call(`trips/${tripId}`, { token: alice.token })).json.data;
  const day = trip.itinerary_days[0];
  const activity = day.activities[0];
  const expense = trip.expenses.find((e: Json) => e.source === "ai");

  const attempts = [
    call(`trips/${tripId}`, { token: bob.token }),
    call(`trips/${tripId}/budget`, { token: bob.token }),
    call(`trips/${tripId}`, { method: "PATCH", body: { budget: 99999 }, token: bob.token }),
    call(`trips/${tripId}`, { method: "DELETE", token: bob.token }),
    call(`trips/${tripId}/activities`, { body: { itinerary_day_id: day.id, name: "Hijack" }, token: bob.token }),
    call(`trips/${tripId}/activities/${activity.id}`, { method: "PATCH", body: { name: "x" }, token: bob.token }),
    call(`trips/${tripId}/activities/${activity.id}`, { method: "DELETE", token: bob.token }),
    call(`trips/${tripId}/expenses`, { body: { category: "food", title: "x", amount: 1 }, token: bob.token }),
    call(`trips/${tripId}/expenses/${expense.id}`, { method: "DELETE", token: bob.token }),
    call("generate-itinerary", { body: { trip_id: tripId, confirm_regenerate: true }, token: bob.token }),
  ];
  for (const res of await Promise.all(attempts)) {
    assert.equal(res.status, 404, JSON.stringify(res.json));
  }

  // Bob's own trip id cannot be used to reach Alice's activity either.
  const bobTrip = await call("trips", {
    body: { destination: "Pune", start_date: isoDate(20), end_date: isoDate(21), travelers: 1, budget: 5000 },
    token: bob.token,
  });
  assert.equal(bobTrip.status, 201);
  const crossed = await call(`trips/${bobTrip.json.data.id}/activities/${activity.id}`, {
    method: "PATCH",
    body: { name: "x" },
    token: bob.token,
  });
  assert.equal(crossed.status, 404);

  // Direct PostgREST access is constrained by RLS.
  for (const table of ["trips", "itinerary_days", "activities", "trip_expenses"]) {
    const { data } = await bob.client.from(table).select("id");
    const ids = (data ?? []).map((r: Json) => r.id);
    assert.ok(![tripId, day.id, activity.id, expense.id].some((id) => ids.includes(id)), `${table} leaked`);
  }
  const insert = await bob.client.from("trip_expenses").insert({ trip_id: tripId, category: "food", title: "x", amount: 1 });
  assert.ok(insert.error, "RLS blocks inserting into someone else's trip");
  const upd = await bob.client.from("trips").update({ budget: 1 }).eq("id", tripId).select("id");
  assert.equal(upd.data?.length ?? 0, 0);
  const rl = await bob.client.from("rate_limit_events").select("id");
  assert.ok(rl.error || (rl.data ?? []).length === 0, "rate limit table is not readable");

  const after = (await call(`trips/${tripId}`, { token: alice.token })).json.data;
  assert.equal(after.budget, 40000);
  assert.equal(after.budget_summary.total_budget, 40000);
});

test("activities: add, edit, move, reorder, delete keep the budget consistent", { skip }, async () => {
  const before = (await call(`trips/${tripId}`, { token: alice.token })).json.data;
  const beforeTotal = before.budget_summary.estimated_total;
  const day1 = before.itinerary_days[0];
  const day2 = before.itinerary_days[1];

  const added = await call(`trips/${tripId}/activities`, {
    body: { itinerary_day_id: day1.id, name: "Elephant safari", category: "activity", time_slot: "morning", estimated_cost: 1500, cost_basis: "per_person" },
    token: alice.token,
  });
  assert.equal(added.status, 201, JSON.stringify(added.json));
  const act = added.json.data.activity;
  assert.equal(act.cost_is_estimate, false);
  assert.equal(added.json.data.budget_summary.estimated_total, beforeTotal + 3000);

  const edited = await call(`trips/${tripId}/activities/${act.id}`, {
    method: "PATCH",
    body: { estimated_cost: 2000, cost_basis: "total" },
    token: alice.token,
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.json.data.budget_summary.estimated_total, beforeTotal + 2000);

  // Free activity → linked expense removed.
  const free = await call(`trips/${tripId}/activities/${act.id}`, { method: "PATCH", body: { estimated_cost: 0 }, token: alice.token });
  assert.equal(free.json.data.budget_summary.estimated_total, beforeTotal);
  await call(`trips/${tripId}/activities/${act.id}`, { method: "PATCH", body: { estimated_cost: 2000 }, token: alice.token });

  // Linked expenses cannot be edited directly.
  const detail = (await call(`trips/${tripId}`, { token: alice.token })).json.data;
  const linked = detail.expenses.find((e: Json) => e.activity_id === act.id);
  assert.ok(linked);
  const direct = await call(`trips/${tripId}/expenses/${linked.id}`, { method: "PATCH", body: { amount: 1 }, token: alice.token });
  assert.equal(direct.status, 409);
  assert.equal(direct.json.error.code, "LINKED_EXPENSE");

  // Move to day 2 → appended at the end.
  const moved = await call(`trips/${tripId}/activities/${act.id}`, {
    method: "PATCH",
    body: { itinerary_day_id: day2.id },
    token: alice.token,
  });
  assert.equal(moved.status, 200);
  assert.equal(moved.json.data.activity.sort_order, day2.activities.length);

  // Reorder day 2: reverse it.
  const ids = [...day2.activities.map((a: Json) => a.id), act.id].reverse();
  const reordered = await call(`trips/${tripId}/activities/reorder`, {
    body: { itinerary_day_id: day2.id, activity_ids: ids },
    token: alice.token,
  });
  assert.equal(reordered.status, 200, JSON.stringify(reordered.json));
  assert.deepEqual(reordered.json.data.activities.map((a: Json) => a.id), ids);

  const partial = await call(`trips/${tripId}/activities/reorder`, {
    body: { itinerary_day_id: day2.id, activity_ids: ids.slice(1) },
    token: alice.token,
  });
  assert.equal(partial.status, 422);
  const foreign = await call(`trips/${tripId}/activities/reorder`, {
    body: { itinerary_day_id: day2.id, activity_ids: [...ids.slice(1), day1.activities[0].id] },
    token: alice.token,
  });
  assert.equal(foreign.status, 422);

  const removed = await call(`trips/${tripId}/activities/${act.id}`, { method: "DELETE", token: alice.token });
  assert.equal(removed.status, 200);
  assert.equal(removed.json.data.budget_summary.estimated_total, beforeTotal);
  const gone = await alice.client.from("trip_expenses").select("id").eq("activity_id", act.id);
  assert.equal(gone.data?.length, 0, "linked expense removed with the activity");

  const invalid = await call(`trips/${tripId}/activities`, {
    body: { itinerary_day_id: day1.id, name: "x", start_time: "9am" },
    token: alice.token,
  });
  assert.equal(invalid.status, 422);
});

test("expenses: add, dedupe, update, delete, with per-person scaling", { skip }, async () => {
  const before = (await call(`trips/${tripId}/budget`, { token: alice.token })).json.data;

  const added = await call(`trips/${tripId}/expenses`, {
    body: { category: "miscellaneous", title: "Travel insurance", amount: 600, cost_basis: "per_person" },
    token: alice.token,
  });
  assert.equal(added.status, 201, JSON.stringify(added.json));
  assert.equal(added.json.data.budget_summary.estimated_total, before.estimated_total + 1200);
  const expense = added.json.data.expense;
  assert.equal(expense.source, "user");
  assert.equal(expense.is_estimate, false);

  const dup = await call(`trips/${tripId}/expenses`, {
    body: { category: "miscellaneous", title: "  travel INSURANCE ", amount: 1 },
    token: alice.token,
  });
  assert.equal(dup.status, 409);
  assert.equal(dup.json.error.code, "DUPLICATE_EXPENSE");

  const nightly = await call(`trips/${tripId}/expenses`, {
    body: { category: "food", title: "Breakfast add-on", amount: 250, cost_basis: "per_person_per_night" },
    token: alice.token,
  });
  assert.equal(nightly.json.data.expense.quantity, 2, "quantity defaults to the trip's nights");

  const updated = await call(`trips/${tripId}/expenses/${expense.id}`, {
    method: "PATCH",
    body: { amount: 700 },
    token: alice.token,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.budget_summary.estimated_total, before.estimated_total + 1400 + 1000);

  for (const bad of [{ amount: -1 }, { amount: "abc" }, { cost_basis: "weekly" }, { quantity: 0 }, {}]) {
    const res = await call(`trips/${tripId}/expenses/${expense.id}`, { method: "PATCH", body: bad, token: alice.token });
    assert.equal(res.status, 422, JSON.stringify(bad));
  }

  // Changing travelers rescales every per-person line.
  const trip = await call(`trips/${tripId}`, { method: "PATCH", body: { travelers: 3 }, token: alice.token });
  assert.equal(trip.status, 200);
  const recomputed = calculateBudget({ budget: 40000, travelers: 3, expenses: trip.json.data.expenses });
  assert.deepEqual(trip.json.data.budget_summary, recomputed);
  assert.equal(trip.json.data.total_estimated_cost, recomputed.estimated_total);

  for (const id of [expense.id, nightly.json.data.expense.id]) {
    const del = await call(`trips/${tripId}/expenses/${id}`, { method: "DELETE", token: alice.token });
    assert.equal(del.status, 200);
  }
  const back = await call(`trips/${tripId}`, { method: "PATCH", body: { travelers: 2 }, token: alice.token });
  assert.equal(back.json.data.budget_summary.estimated_total, before.estimated_total);
});

test("trip updates: details, budget flag, date shifting", { skip }, async () => {
  const over = await call(`trips/${tripId}`, { method: "PATCH", body: { budget: 5000, title: "Pink City" }, token: alice.token });
  assert.equal(over.status, 200);
  assert.equal(over.json.data.title, "Pink City");
  assert.equal(over.json.data.budget_summary.is_over_budget, true);
  assert.ok(over.json.data.budget_summary.remaining < 0);

  const shifted = await call(`trips/${tripId}`, {
    method: "PATCH",
    body: { start_date: isoDate(30), end_date: isoDate(32), budget: 40000 },
    token: alice.token,
  });
  assert.equal(shifted.status, 200, JSON.stringify(shifted.json));
  assert.deepEqual(shifted.json.data.itinerary_days.map((d: Json) => d.date), [isoDate(30), isoDate(31), isoDate(32)]);

  const longer = await call(`trips/${tripId}`, {
    method: "PATCH",
    body: { start_date: isoDate(30), end_date: isoDate(34) },
    token: alice.token,
  });
  assert.equal(longer.status, 409);
  assert.equal(longer.json.error.code, "DATES_REQUIRE_REGENERATION");

  const bad = await call(`trips/${tripId}`, { method: "PATCH", body: { status: "deleted" }, token: alice.token });
  assert.equal(bad.status, 422);
});

test("regeneration requires confirmation and keeps user expenses", { skip }, async () => {
  const keep = await call(`trips/${tripId}/expenses`, {
    body: { category: "transport", title: "Airport parking", amount: 900 },
    token: alice.token,
  });
  assert.equal(keep.status, 201);
  const before = (await call(`trips/${tripId}`, { token: alice.token })).json.data;

  const unconfirmed = await call("generate-itinerary", { body: { trip_id: tripId }, token: alice.token });
  assert.equal(unconfirmed.status, 409);
  assert.equal(unconfirmed.json.error.code, "CONFIRMATION_REQUIRED");

  const regen = await call("generate-itinerary", {
    body: { trip_id: tripId, confirm_regenerate: true, end_date: isoDate(33) },
    token: alice.token,
  });
  assert.equal(regen.status, 200, JSON.stringify(regen.json));
  const after = regen.json.data.trip;
  assert.equal(regen.json.data.regenerated, true);
  assert.equal(after.id, tripId);
  assert.equal(after.itinerary_days.length, 4);
  assert.equal(after.generation_count, before.generation_count + 1);
  const oldDayIds = new Set(before.itinerary_days.map((d: Json) => d.id));
  assert.ok(after.itinerary_days.every((d: Json) => !oldDayIds.has(d.id)));
  assert.ok(after.expenses.some((e: Json) => e.id === keep.json.data.expense.id), "user expense kept");
  assert.equal(after.expenses.filter((e: Json) => e.category === "accommodation")[0].quantity, 3);
  assert.equal(after.title, "4 days in Jaipur", "title comes from the new generation");
});

test("invalid AI output and invalid destinations save nothing", { skip }, async () => {
  const countTrips = async () => (await call("trips", { token: alice.token })).json.data.length;
  const start = await countTrips();

  const broken = await call("generate-itinerary", { body: { ...tripRequest(), destination: "Brokenville" }, token: alice.token });
  assert.equal(broken.status, 502, JSON.stringify(broken.json));
  assert.equal(broken.json.error.code, "AI_INVALID_OUTPUT");
  assert.ok(broken.json.error.details.problems.length > 0);

  const myth = await call("generate-itinerary", { body: { ...tripRequest(), destination: "Atlantis" }, token: alice.token });
  assert.equal(myth.status, 422);
  assert.equal(myth.json.error.code, "INVALID_DESTINATION");

  assert.equal(await countTrips(), start);
});

test("AI generation is rate limited per user", { skip }, async () => {
  const carol = await newUser("carol");
  const limit = Number(process.env.AI_RATE_LIMIT_PER_HOUR ?? 8);
  let last = { status: 0, json: {} as Json };
  for (let i = 0; i <= limit; i += 1) {
    last = await call("generate-itinerary", { body: { ...tripRequest(), destination: "Atlantis" }, token: carol.token });
    if (last.status === 429) break;
  }
  assert.equal(last.status, 429);
  assert.equal(last.json.error.code, "RATE_LIMITED");
  assert.ok(last.json.error.details.retry_after_seconds > 0);

  // Other users are unaffected.
  const other = await call("generate-itinerary", { body: { ...tripRequest(), destination: "Atlantis" }, token: bob.token });
  assert.equal(other.status, 422);
});

test("trip assistant edits the trip through tools and scopes them to the owner", { skip }, async () => {
  const ask = (content: string, token = alice.token, id = tripId) =>
    call("trip-assistant", { body: { trip_id: id, messages: [{ role: "user", content }] }, token });

  const before = (await call(`trips/${tripId}`, { token: alice.token })).json.data;
  const res = await ask("Add a rooftop dinner on day 1");
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const { reply, actions, trip } = res.json.data;
  assert.equal(reply, "Added a rooftop dinner to day 1.");
  assert.deepEqual(actions, [{ tool: "add_activity", ok: true, label: "Added “Mock Rooftop Dinner” to day 1" }]);

  const added = trip.itinerary_days[0].activities.find((a: Json) => a.name === "Mock Rooftop Dinner");
  assert.ok(added, "the new stop is saved");
  assert.equal(added.cost_is_estimate, true, "AI prices are flagged as estimates");
  assert.equal(trip.budget_summary.estimated_total, before.budget_summary.estimated_total + 1500 * trip.travelers);

  // A made-up ref is refused without touching the trip.
  const bogus = await ask("delete a99");
  assert.equal(bogus.status, 200);
  assert.equal(bogus.json.data.actions[0].ok, false);
  assert.match(bogus.json.data.reply, /Unknown activity ref/);

  // Another user cannot drive the assistant on Alice's trip.
  assert.equal((await ask("Add a rooftop dinner on day 1", bob.token)).status, 404);

  const invalid = await call("trip-assistant", {
    body: { trip_id: tripId, messages: [{ role: "assistant", content: "hi" }] },
    token: alice.token,
  });
  assert.equal(invalid.status, 422);
});

test("optimize-route previews, then applies, the fastest order for a day", { skip }, async () => {
  const created = await call("trips", {
    body: { destination: "Kyoto", start_date: isoDate(20), end_date: isoDate(20), travelers: 1, budget: 20000 },
    token: alice.token,
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const id = created.json.data.id;
  const dayId = created.json.data.itinerary_days[0].id;

  // Stops along a line, visited out of order: 0 km → 2 km → 1 km → 3 km.
  const stops = [
    ["A", 0, "morning", "09:00"],
    ["C", 2, "afternoon", "11:30"],
    ["B", 1, "afternoon", "13:00"],
    ["D", 3, "evening", "19:00"],
  ] as const;
  for (const [name, km, slot, time] of stops) {
    const res = await call(`trips/${id}/activities`, {
      body: { itinerary_day_id: dayId, name, category: "sightseeing", time_slot: slot, start_time: time, lat: 35 + km / 111, lng: 135.76 },
      token: alice.token,
    });
    assert.equal(res.status, 201, JSON.stringify(res.json));
  }
  const names = async () =>
    (await call(`trips/${id}`, { token: alice.token })).json.data.itinerary_days[0].activities.map(
      (a: Json) => `${a.name}@${String(a.start_time).slice(0, 5)}`,
    );

  const preview = await call(`trips/${id}/optimize-route`, { body: { itinerary_day_id: dayId }, token: alice.token });
  assert.equal(preview.status, 200, JSON.stringify(preview.json));
  assert.equal(preview.json.data.changed, true);
  assert.equal(preview.json.data.applied, false);
  assert.ok(preview.json.data.saved_seconds > 0);
  assert.deepEqual(await names(), ["A@09:00", "C@11:30", "B@13:00", "D@19:00"], "a preview saves nothing");

  const applied = await call(`trips/${id}/optimize-route`, { body: { itinerary_day_id: dayId, apply: true }, token: alice.token });
  assert.equal(applied.json.data.applied, true);
  assert.deepEqual(await names(), ["A@09:00", "B@11:30", "C@13:00", "D@19:00"]);

  const again = await call(`trips/${id}/optimize-route`, { body: { itinerary_day_id: dayId }, token: alice.token });
  assert.equal(again.json.data.changed, false, "an optimised day stays put");

  assert.equal(
    (await call(`trips/${id}/optimize-route`, { body: { itinerary_day_id: dayId, apply: true }, token: bob.token })).status,
    404,
  );
  await call(`trips/${id}`, { method: "DELETE", token: alice.token });
});

test("deleting a trip removes all of its records", { skip }, async () => {
  const detail = (await call(`trips/${tripId}`, { token: alice.token })).json.data;
  const dayIds = detail.itinerary_days.map((d: Json) => d.id);

  const del = await call(`trips/${tripId}`, { method: "DELETE", token: alice.token });
  assert.equal(del.status, 200);
  assert.equal((await call(`trips/${tripId}`, { token: alice.token })).status, 404);
  assert.equal((await call(`trips/${tripId}`, { method: "DELETE", token: alice.token })).status, 404);

  const days = await alice.client.from("itinerary_days").select("id").in("id", dayIds);
  const acts = await alice.client.from("activities").select("id").in("itinerary_day_id", dayIds);
  const exps = await alice.client.from("trip_expenses").select("id").eq("trip_id", tripId);
  assert.equal(days.data?.length, 0);
  assert.equal(acts.data?.length, 0);
  assert.equal(exps.data?.length, 0);
});

test("responses use the JSON error envelope", { skip }, async () => {
  const res = await call("trips/not-a-uuid", { token: alice.token });
  assert.equal(res.status, 400);
  assert.equal(res.json.error.code, "INVALID_ID");
  assert.ok(res.json.error.request_id);
  const method = await call("generate-itinerary", { method: "GET", token: alice.token });
  assert.equal(method.status, 405);
});
