import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ApiError,
  ValidationError,
} from "../../supabase/functions/_shared/http.js";
import { addDaysUtc } from "../../supabase/functions/_shared/budget.js";
import {
  AiOutputError,
  parseActivityInput,
  parseExpenseInput,
  parseGenerateRequest,
  parseReorderInput,
  parseTripInput,
  parseTripUpdate,
  validateAiItinerary,
} from "../../supabase/functions/_shared/validation.js";
import { buildAiItinerary } from "../fixtures/ai-itinerary.js";

const TODAY = "2026-10-26";
const valid = {
  destination: "Jaipur, India",
  start_date: "2026-11-10",
  end_date: "2026-11-12",
  travelers: 2,
  budget: 40000,
  travel_style: "mid_range",
  interests: ["food", "history"],
  pace: "moderate",
  preferences: "Vegetarian food",
};

function fieldsOf(fn) {
  try {
    fn();
  } catch (err) {
    assert.ok(
      err instanceof ValidationError,
      `expected ValidationError, got ${err}`,
    );
    assert.equal(err.status, 422);
    return err.details.fields;
  }
  assert.fail("expected validation to fail");
}

test("valid trip input is normalised", () => {
  const input = parseTripInput(valid, { today: TODAY });
  assert.equal(input.destination, "Jaipur, India");
  assert.equal(input.travelers, 2);
  assert.equal(input.budget, 40000);
  assert.deepEqual(input.interests, ["food", "history"]);
  assert.equal(input.preferences, "Vegetarian food");
});

test("defaults apply and legacy `notes` maps to preferences", () => {
  const {
    travel_style: _s,
    pace: _p,
    interests: _i,
    preferences: _pr,
    ...minimal
  } = valid;
  const input = parseTripInput(
    { ...minimal, notes: "Anniversary", budget: "25000" },
    { today: TODAY },
  );
  assert.equal(input.travel_style, "mid_range");
  assert.equal(input.pace, "moderate");
  assert.deepEqual(input.interests, []);
  assert.equal(input.preferences, "Anniversary");
  assert.equal(input.budget, 25000);
});

test("invalid dates are rejected", () => {
  assert.ok(
    fieldsOf(() =>
      parseTripInput({ ...valid, start_date: "2026-02-30" }, { today: TODAY }),
    ).start_date,
  );
  assert.ok(
    fieldsOf(() =>
      parseTripInput({ ...valid, end_date: "2026-11-09" }, { today: TODAY }),
    ).end_date,
  );
  assert.ok(
    fieldsOf(() =>
      parseTripInput(
        { ...valid, start_date: "2026-10-01", end_date: "2026-10-02" },
        { today: TODAY },
      ),
    ).start_date,
  );
  assert.match(
    fieldsOf(() =>
      parseTripInput(
        { ...valid, end_date: addDaysUtc(valid.start_date, 14) },
        { today: TODAY },
      ),
    ).end_date,
    /at most 14 days/,
  );
  assert.ok(
    fieldsOf(() =>
      parseTripInput(
        { ...valid, start_date: "2030-01-01", end_date: "2030-01-02" },
        { today: TODAY },
      ),
    ).start_date,
  );
  // Past start allowed when regenerating an existing trip.
  assert.equal(
    parseTripInput(
      { ...valid, start_date: "2026-10-01", end_date: "2026-10-02" },
      { today: TODAY, allowPastStart: true },
    ).start_date,
    "2026-10-01",
  );
});

test("invalid budgets and traveler counts are rejected", () => {
  assert.ok(
    fieldsOf(() => parseTripInput({ ...valid, budget: 500 }, { today: TODAY }))
      .budget,
  );
  assert.ok(
    fieldsOf(() => parseTripInput({ ...valid, budget: -100 }, { today: TODAY }))
      .budget,
  );
  assert.ok(
    fieldsOf(() =>
      parseTripInput({ ...valid, budget: 1000.555 }, { today: TODAY }),
    ).budget,
  );
  assert.ok(
    fieldsOf(() =>
      parseTripInput({ ...valid, budget: "lots" }, { today: TODAY }),
    ).budget,
  );
  assert.ok(
    fieldsOf(() => parseTripInput({ ...valid, budget: 1e12 }, { today: TODAY }))
      .budget,
  );
  assert.ok(
    fieldsOf(() => parseTripInput({ ...valid, travelers: 0 }, { today: TODAY }))
      .travelers,
  );
  assert.ok(
    fieldsOf(() =>
      parseTripInput({ ...valid, travelers: 2.5 }, { today: TODAY }),
    ).travelers,
  );
  assert.ok(
    fieldsOf(() =>
      parseTripInput({ ...valid, travelers: 21 }, { today: TODAY }),
    ).travelers,
  );
});

test("invalid destinations are rejected", () => {
  assert.ok(
    fieldsOf(() =>
      parseTripInput({ ...valid, destination: "" }, { today: TODAY }),
    ).destination,
  );
  assert.ok(
    fieldsOf(() =>
      parseTripInput({ ...valid, destination: "x" }, { today: TODAY }),
    ).destination,
  );
  assert.ok(
    fieldsOf(() =>
      parseTripInput(
        { ...valid, destination: "<script>alert(1)</script>" },
        { today: TODAY },
      ),
    ).destination,
  );
  assert.ok(
    fieldsOf(() =>
      parseTripInput(
        { ...valid, destination: "a".repeat(101) },
        { today: TODAY },
      ),
    ).destination,
  );
  assert.ok(
    fieldsOf(() =>
      parseTripInput({ ...valid, destination: 42 }, { today: TODAY }),
    ).destination,
  );
  // Non-Latin scripts are fine.
  assert.equal(
    parseTripInput({ ...valid, destination: "京都" }, { today: TODAY })
      .destination,
    "京都",
  );
  assert.equal(
    parseTripInput({ ...valid, destination: "St. John's" }, { today: TODAY })
      .destination,
    "St. John's",
  );
});

test("client-supplied user ids and unknown fields are refused", () => {
  const fields = fieldsOf(() =>
    parseTripInput({ ...valid, user_id: "someone-else" }, { today: TODAY }),
  );
  assert.equal(fields.user_id, "is not an allowed field");
  assert.ok(
    fieldsOf(() =>
      parseTripInput(
        { ...valid, interests: ["food", "gambling"] },
        { today: TODAY },
      ),
    ).interests,
  );
  assert.ok(
    fieldsOf(() => parseTripInput({ ...valid, pace: "warp" }, { today: TODAY }))
      .pace,
  );
  assert.ok(fieldsOf(() => parseTripInput([], { today: TODAY })).body);
});

test("generate request separates regeneration flags", () => {
  const req = parseGenerateRequest({
    trip_id: "6f9619ff-8b86-4011-b42d-00c04fc964ff",
    confirm_regenerate: true,
    budget: 1,
  });
  assert.equal(req.confirm_regenerate, true);
  assert.deepEqual(req.fields, { budget: 1 });
  assert.ok(fieldsOf(() => parseGenerateRequest({ trip_id: "nope" })).trip_id);
});

test("trip updates", () => {
  assert.deepEqual(parseTripUpdate({ travelers: 3, notes: null }), {
    travelers: 3,
    notes: null,
  });
  assert.ok(fieldsOf(() => parseTripUpdate({})).body);
  assert.ok(
    fieldsOf(() => parseTripUpdate({ start_date: "2026-11-01" })).end_date,
  );
  assert.ok(fieldsOf(() => parseTripUpdate({ user_id: "x" })).user_id);
  assert.ok(fieldsOf(() => parseTripUpdate({ status: "deleted" })).status);
});

test("activity input", () => {
  const dayId = "6f9619ff-8b86-4011-b42d-00c04fc964ff";
  assert.ok(
    fieldsOf(() => parseActivityInput({ name: "x" }, "create"))
      .itinerary_day_id,
  );
  assert.ok(
    fieldsOf(() => parseActivityInput({ itinerary_day_id: dayId }, "create"))
      .name,
  );
  assert.ok(
    fieldsOf(() => parseActivityInput({ start_time: "25:00" }, "update"))
      .start_time,
  );
  assert.ok(fieldsOf(() => parseActivityInput({ lat: 10 }, "update")).lat);
  assert.ok(
    fieldsOf(() => parseActivityInput({ estimated_cost: -5 }, "update"))
      .estimated_cost,
  );
  assert.deepEqual(
    parseActivityInput({ lat: 10, lng: 20, estimated_cost: "99.5" }, "update"),
    {
      lat: 10,
      lng: 20,
      estimated_cost: 99.5,
    },
  );
});

test("expense input", () => {
  const created = parseExpenseInput(
    { category: "food", title: " Snacks ", amount: 150 },
    "create",
  );
  assert.deepEqual(created, {
    category: "food",
    title: "Snacks",
    amount: 150,
    cost_basis: "total",
    is_estimate: false,
  });
  assert.ok(
    fieldsOf(() =>
      parseExpenseInput({ category: "spa", title: "x", amount: 1 }, "create"),
    ).category,
  );
  assert.ok(
    fieldsOf(() =>
      parseExpenseInput(
        { category: "food", title: "x", amount: 1, quantity: 0 },
        "create",
      ),
    ).quantity,
  );
  assert.ok(
    fieldsOf(() =>
      parseExpenseInput(
        { category: "food", title: "x", amount: 1, cost_basis: "weekly" },
        "create",
      ),
    ).cost_basis,
  );
  assert.ok(
    fieldsOf(() => parseExpenseInput({ trip_id: "x" }, "update")).trip_id,
  );
});

test("reorder input", () => {
  const a = "6f9619ff-8b86-4011-b42d-00c04fc964ff";
  const b = "7f9619ff-8b86-4011-b42d-00c04fc964ff";
  assert.deepEqual(
    parseReorderInput({ itinerary_day_id: a, activity_ids: [b, a] })
      .activity_ids,
    [b, a],
  );
  assert.ok(
    fieldsOf(() =>
      parseReorderInput({ itinerary_day_id: a, activity_ids: [b, b] }),
    ).activity_ids,
  );
  assert.ok(
    fieldsOf(() => parseReorderInput({ itinerary_day_id: a, activity_ids: [] }))
      .activity_ids,
  );
});

// ---------------------------------------------------------------------------
// AI output
// ---------------------------------------------------------------------------

const tripInput = parseTripInput(valid, { today: TODAY });
const dates = ["2026-11-10", "2026-11-11", "2026-11-12"];
const fixture = () =>
  buildAiItinerary({ destination: "Jaipur", dates, nights: 2 });

test("valid AI output is normalised and protected against double counting", () => {
  const raw = fixture();
  raw.itinerary_days[1].date = "1999-01-01"; // model-supplied dates are ignored
  const result = validateAiItinerary(raw, tripInput);

  assert.equal(result.days.length, 3);
  assert.deepEqual(
    result.days.map((d) => d.date),
    dates,
  );
  assert.equal(result.activities.length, 12);
  for (const day of result.days) {
    const slots = new Set(
      result.activities
        .filter((a) => a.itinerary_day_id === day.id)
        .map((a) => a.time_slot),
    );
    assert.deepEqual([...slots].sort(), ["afternoon", "evening", "morning"]);
  }
  const checkIn = result.activities.find((a) => a.category === "accommodation");
  assert.equal(
    checkIn?.estimated_cost,
    0,
    "stay is budgeted as a nightly expense, not on the activity",
  );

  const hotel = result.expenses.find((e) => e.category === "accommodation");
  assert.equal(
    hotel?.quantity,
    2,
    "per-night quantity is forced to the real number of nights",
  );
  const autos = result.expenses.find((e) => e.cost_basis === "per_day");
  assert.equal(autos?.quantity, 3);
  assert.ok(result.warnings.length > 0);
  assert.equal(result.title, "3 days in Jaipur");
  assert.ok(result.travel_notes?.includes("Carry cash"));
});

test("AI output missing a time slot is rejected", () => {
  const raw = fixture();
  raw.itinerary_days[2].activities = raw.itinerary_days[2].activities.filter(
    (a) => a.time_slot !== "evening",
  );
  assert.throws(
    () => validateAiItinerary(raw, tripInput),
    (err) => {
      assert.ok(err instanceof AiOutputError);
      assert.ok(err.problems.some((p) => p.includes("no evening activity")));
      return true;
    },
  );
});

test("AI output with the wrong number of days is rejected", () => {
  const raw = fixture();
  raw.itinerary_days.pop();
  assert.throws(() => validateAiItinerary(raw, tripInput), AiOutputError);
});

test("AI output with invalid costs or durations is rejected", () => {
  const negative = fixture();
  negative.itinerary_days[0].activities[1].estimated_cost = -10;
  assert.throws(() => validateAiItinerary(negative, tripInput), AiOutputError);

  const huge = fixture();
  huge.itinerary_days[0].activities[1].estimated_cost = 10_000_000;
  assert.throws(() => validateAiItinerary(huge, tripInput), AiOutputError);

  const duration = fixture();
  duration.itinerary_days[0].activities[1].duration_minutes = 0;
  assert.throws(() => validateAiItinerary(duration, tripInput), AiOutputError);
});

test("AI output without accommodation for an overnight trip is rejected", () => {
  const raw = fixture();
  raw.expenses = raw.expenses.filter((e) => e.category !== "accommodation");
  raw.itinerary_days[0].activities[0].estimated_cost = 0;
  assert.throws(
    () => validateAiItinerary(raw, tripInput),
    (err) => {
      assert.ok(err instanceof AiOutputError);
      assert.ok(err.problems.some((p) => p.includes("accommodation")));
      return true;
    },
  );
});

test("duplicate and lump-sum activity expenses from AI are dropped", () => {
  const raw = fixture();
  raw.expenses.push({ ...raw.expenses[1] }); // duplicate train tickets
  raw.expenses.push({
    category: "activities",
    title: "All entry fees",
    amount: 5000,
    cost_basis: "total",
    quantity: 1,
    notes: "",
  });
  const result = validateAiItinerary(raw, tripInput);
  assert.equal(
    result.expenses.filter((e) => e.title === "Return train tickets").length,
    1,
  );
  assert.equal(
    result.expenses.some((e) => e.category === "activities"),
    false,
  );
});

test("implausible coordinates are dropped, not trusted", () => {
  const raw = fixture();
  raw.itinerary_days[0].activities[1].lat = 51.5; // London, far from Jaipur
  raw.itinerary_days[0].activities[1].lng = -0.12;
  const result = validateAiItinerary(raw, tripInput);
  const lunch = result.activities.find((a) => a.name === "Lunch thali 1");
  assert.equal(lunch?.lat, null);
  assert.equal(lunch?.lng, null);
});

test("unrecognised destinations surface as a 422", () => {
  assert.throws(
    () =>
      validateAiItinerary(
        { destination_valid: false, destination_issue: "Not a real place" },
        tripInput,
      ),
    (err) =>
      err instanceof ApiError &&
      err.status === 422 &&
      err.code === "INVALID_DESTINATION",
  );
});

test("non-object AI output is rejected", () => {
  assert.throws(() => validateAiItinerary("hello", tripInput), AiOutputError);
  assert.throws(
    () => validateAiItinerary({ title: "x" }, tripInput),
    AiOutputError,
  );
});
