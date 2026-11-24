// Activity and expense changes for an owned trip. Shared by the `trips` REST
// endpoints and the `trip-assistant` agent, so both go through the same
// validation, ownership checks and budget recalculation.
//
// Each action is one Firestore transaction on the trip document (mutateTrip),
// so a change and the budget it affects are always saved together.

import { ApiError, ValidationError } from "./http.js";
import { tripDayCount, tripNightCount } from "./budget.js";
import {
  ACTIVITY_FIELDS,
  EXPENSE_FIELDS,
  getOwnedTrip,
  getTripActivity,
  getTripDay,
  hasDuplicateExpense,
  mutateTrip,
  newId,
  nextSortOrder,
  nowIso,
  pick,
  removeActivityExpense,
  summarizeTrip,
  syncActivityExpense,
} from "./trips-repo.js";
import {
  chooseTravelMode,
  estimateMatrix,
  locatedPoints,
  planDayRoute,
} from "./route-optimizer.js";
import {
  isUuid,
  LIMITS,
  parseActivityInput,
  parseExpenseInput,
  parseReorderInput,
} from "./validation.js";

const MAX_EXPENSES_PER_TRIP = 200;

const budgetOf = (trip) => summarizeTrip(trip).budget;

/** Drops keys whose value is undefined (fields the request did not send). */
const defined = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export async function createActivity(ctx, tripId, body, costSource = "user") {
  const input = defined(parseActivityInput(body, "create"));
  const { trip, result } = await mutateTrip(ctx.db, tripId, (trip) => {
    const day = getTripDay(trip, input.itinerary_day_id);
    if (day.activities.length >= LIMITS.MAX_ACTIVITIES_PER_DAY) {
      throw new ApiError(
        409,
        "DAY_FULL",
        `A day can have at most ${LIMITS.MAX_ACTIVITIES_PER_DAY} activities.`,
      );
    }
    const now = nowIso();
    const activity = {
      ...pick({}, ACTIVITY_FIELDS),
      category: "activity",
      cost_basis: "per_person",
      estimated_cost: 0,
      ...input,
      id: newId(),
      cost_is_estimate: costSource === "ai",
      sort_order: nextSortOrder(day),
      created_at: now,
      updated_at: now,
    };
    day.activities.push(activity);
    syncActivityExpense(trip, activity);
    return activity;
  }, "Adding the activity");
  return { activity: pick(result, ACTIVITY_FIELDS), budget_summary: budgetOf(trip) };
}

export async function updateActivity(ctx, tripId, activityId, body, costSource = "user") {
  const input = defined(parseActivityInput(body, "update"));
  const { trip, result } = await mutateTrip(ctx.db, tripId, (trip) => {
    const { day, activity } = getTripActivity(trip, activityId);
    const patch = { ...input };
    if (input.estimated_cost !== undefined) patch.cost_is_estimate = costSource === "ai";

    if (input.itinerary_day_id && input.itinerary_day_id !== day.id) {
      const target = getTripDay(trip, input.itinerary_day_id);
      if (target.activities.length >= LIMITS.MAX_ACTIVITIES_PER_DAY) {
        throw new ApiError(
          409,
          "DAY_FULL",
          `A day can have at most ${LIMITS.MAX_ACTIVITIES_PER_DAY} activities.`,
        );
      }
      patch.sort_order = nextSortOrder(target);
      day.activities = day.activities.filter((a) => a.id !== activityId);
      target.activities.push(activity);
    }
    Object.assign(activity, patch, { updated_at: nowIso() });
    syncActivityExpense(trip, activity);
    return activity;
  }, "Updating the activity");
  return { activity: pick(result, ACTIVITY_FIELDS), budget_summary: budgetOf(trip) };
}

export async function deleteActivity(ctx, tripId, activityId) {
  const { trip } = await mutateTrip(ctx.db, tripId, (trip) => {
    const { day } = getTripActivity(trip, activityId);
    day.activities = day.activities.filter((a) => a.id !== activityId);
    removeActivityExpense(trip, activityId);
  }, "Deleting the activity");
  return { id: activityId, deleted: true, budget_summary: budgetOf(trip) };
}

/** Rewrites sort_order for one day. `ids` must list every activity of the day exactly once. */
function applyOrder(day, ids) {
  const existing = day.activities.map((a) => a.id).sort();
  const requested = [...ids].sort();
  if (
    !existing.length ||
    existing.length !== requested.length ||
    existing.some((id, i) => id !== requested[i])
  ) {
    return false;
  }
  const position = new Map(ids.map((id, i) => [id, i]));
  const now = nowIso();
  for (const activity of day.activities) {
    activity.sort_order = position.get(activity.id);
    activity.updated_at = now;
  }
  return true;
}

export async function reorderActivities(ctx, tripId, body) {
  const input = parseReorderInput(body);
  const { result } = await mutateTrip(ctx.db, tripId, (trip) => {
    const day = getTripDay(trip, input.itinerary_day_id);
    if (!applyOrder(day, input.activity_ids)) {
      throw new ApiError(
        422,
        "INVALID_ORDER",
        "The new order must list every activity of that day exactly once.",
      );
    }
    return [...day.activities]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((a) => pick(a, ACTIVITY_FIELDS));
  }, "Reordering activities");
  return { itinerary_day_id: input.itinerary_day_id, activities: result };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

function defaultQuantity(basis, trip) {
  if (basis === "per_night" || basis === "per_person_per_night") {
    return Math.max(1, tripNightCount(trip.start_date, trip.end_date));
  }
  if (basis === "per_day" || basis === "per_person_per_day")
    return tripDayCount(trip.start_date, trip.end_date);
  return 1;
}

function duplicateExpense() {
  return new ApiError(
    409,
    "DUPLICATE_EXPENSE",
    "An expense with this title already exists in that category.",
  );
}

function getStandaloneExpense(trip, expenseId) {
  const expense = (trip.expenses ?? []).find((e) => e.id === expenseId);
  if (!expense)
    throw new ApiError(404, "EXPENSE_NOT_FOUND", "Expense not found in this trip.");
  if (expense.source === "activity") {
    throw new ApiError(
      409,
      "LINKED_EXPENSE",
      "This cost comes from an itinerary activity. Edit or delete the activity instead.",
    );
  }
  return expense;
}

export async function createExpense(ctx, tripId, body) {
  const input = defined(parseExpenseInput(body, "create"));
  const { trip, result } = await mutateTrip(ctx.db, tripId, (trip) => {
    trip.expenses ??= [];
    if (trip.expenses.length >= MAX_EXPENSES_PER_TRIP) {
      throw new ApiError(
        409,
        "TOO_MANY_EXPENSES",
        `A trip can have at most ${MAX_EXPENSES_PER_TRIP} expenses.`,
      );
    }
    if (hasDuplicateExpense(trip, input.category, input.title)) throw duplicateExpense();
    const basis = input.cost_basis ?? "total";
    const now = nowIso();
    const expense = {
      ...pick({}, EXPENSE_FIELDS),
      currency: "INR",
      is_estimate: true,
      ...input,
      id: newId(),
      trip_id: trip.id,
      activity_id: null,
      cost_basis: basis,
      quantity: input.quantity ?? defaultQuantity(basis, trip),
      source: "user",
      created_at: now,
      updated_at: now,
    };
    trip.expenses.push(expense);
    return expense;
  }, "Adding the expense");
  return { expense: pick(result, EXPENSE_FIELDS), budget_summary: budgetOf(trip) };
}

export async function updateExpense(ctx, tripId, expenseId, body) {
  const input = defined(parseExpenseInput(body, "update"));
  const { trip, result } = await mutateTrip(ctx.db, tripId, (trip) => {
    const expense = getStandaloneExpense(trip, expenseId);
    const patch = { ...input };
    // A user edit to the price turns an AI estimate into the user's own figure.
    if (input.amount !== undefined && input.is_estimate === undefined)
      patch.is_estimate = false;
    const next = { ...expense, ...patch };
    if (hasDuplicateExpense(trip, next.category, next.title, expense.id))
      throw duplicateExpense();
    Object.assign(expense, patch, { updated_at: nowIso() });
    return expense;
  }, "Updating the expense");
  return { expense: pick(result, EXPENSE_FIELDS), budget_summary: budgetOf(trip) };
}

export async function deleteExpense(ctx, tripId, expenseId) {
  const { trip } = await mutateTrip(ctx.db, tripId, (trip) => {
    getStandaloneExpense(trip, expenseId);
    trip.expenses = trip.expenses.filter((e) => e.id !== expenseId);
  }, "Deleting the expense");
  return { id: expenseId, deleted: true, budget_summary: budgetOf(trip) };
}

// ---------------------------------------------------------------------------
// Route optimisation
// ---------------------------------------------------------------------------

export function parseOptimizeRouteInput(body) {
  const src =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const fields = {};
  for (const key of Object.keys(src)) {
    if (key !== "itinerary_day_id" && key !== "apply")
      fields[key] = "is not a recognised field";
  }
  if (!isUuid(src.itinerary_day_id)) fields.itinerary_day_id = "is required";
  if (src.apply !== undefined && typeof src.apply !== "boolean")
    fields.apply = "must be true or false";
  if (Object.keys(fields).length) throw new ValidationError(fields);
  return {
    itinerary_day_id: src.itinerary_day_id.toLowerCase(),
    apply: src.apply === true,
  };
}

/**
 * Finds the order of a day's stops with the least travel time. With `apply`,
 * saves the new order and start times; otherwise returns a preview.
 */
export async function optimizeDayRoute(ctx, tripId, body, getMatrix) {
  const input = parseOptimizeRouteInput(body);
  const current = await getOwnedTrip(ctx.db, ctx.userId, tripId);
  const day = getTripDay(current, input.itinerary_day_id);

  const stops = [...day.activities]
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        String(a.created_at).localeCompare(String(b.created_at)),
    )
    .map((a) => ({
      id: a.id,
      lat: a.lat ?? null,
      lng: a.lng ?? null,
      time_slot: a.time_slot ?? null,
      // Accept HH:MM:SS as well as HH:MM.
      start_time: typeof a.start_time === "string" ? a.start_time.slice(0, 5) : null,
    }));

  const points = locatedPoints(stops);
  const mode = chooseTravelMode(points);
  // Fewer than 3 stops have only one sensible order: skip the (billed) routing call.
  const matrix =
    points.length >= 3 ? await getMatrix(points, mode) : estimateMatrix(points, mode);
  const plan = planDayRoute(stops, matrix);

  let applied = false;
  if (input.apply && plan.changed) {
    // The new order and start times are saved together, and only if the day
    // still has exactly the stops that were optimised.
    await mutateTrip(ctx.db, tripId, (trip) => {
      const target = getTripDay(trip, input.itinerary_day_id);
      if (!applyOrder(target, plan.order)) {
        throw new ApiError(
          409,
          "DAY_CHANGED",
          "This day changed while optimising. Please try again.",
        );
      }
      for (const activity of target.activities) {
        const time = plan.start_times[activity.id];
        if (time) activity.start_time = time;
      }
    }, "Saving the new order");
    applied = true;
  }

  return {
    itinerary_day_id: input.itinerary_day_id,
    ...plan,
    travel_mode: mode,
    source: matrix.source,
    applied,
  };
}
