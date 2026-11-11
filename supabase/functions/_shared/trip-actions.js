// Activity and expense changes for an owned trip. Shared by the `trips` REST
// endpoints and the `trip-assistant` agent, so both go through the same
// validation, ownership checks and budget recalculation.

import { ApiError, mapDbError, ValidationError } from "./http.js";
import { tripDayCount, tripNightCount } from "./budget.js";

import {
  ACTIVITY_COLUMNS,
  EXPENSE_COLUMNS,
  asRow,
  asRows,
  getOwnedTrip,
  getTripActivity,
  getTripDay,
  nextSortOrder,
  recalculateTripTotal,
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

/** Who supplied a price: the user's own figure, or an unverified AI estimate. */

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export async function createActivity(
  { db, userId },
  tripId,
  body,
  costSource = "user",
) {
  const input = parseActivityInput(body, "create");
  const trip = await getOwnedTrip(db, userId, tripId);
  await getTripDay(db, tripId, input.itinerary_day_id);

  const { count, error: countError } = await db
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("itinerary_day_id", input.itinerary_day_id);
  if (countError) throw mapDbError(countError, "Loading activities");
  if ((count ?? 0) >= LIMITS.MAX_ACTIVITIES_PER_DAY) {
    throw new ApiError(
      409,
      "DAY_FULL",
      `A day can have at most ${LIMITS.MAX_ACTIVITIES_PER_DAY} activities.`,
    );
  }

  const { data, error } = await db
    .from("activities")
    .insert({
      category: "activity",
      cost_basis: "per_person",
      estimated_cost: 0,
      ...input,
      cost_is_estimate: costSource === "ai",
      sort_order: await nextSortOrder(db, input.itinerary_day_id),
    })
    .select(ACTIVITY_COLUMNS)
    .single();
  if (error) throw mapDbError(error, "Adding the activity");

  const { budget } = await recalculateTripTotal(db, trip);
  return { activity: asRow(data), budget_summary: budget };
}

export async function updateActivity(
  { db, userId },
  tripId,
  activityId,
  body,
  costSource = "user",
) {
  const input = parseActivityInput(body, "update");
  const trip = await getOwnedTrip(db, userId, tripId);
  const current = await getTripActivity(db, tripId, activityId);

  const patch = { ...input };
  if (
    input.itinerary_day_id &&
    input.itinerary_day_id !== current.itinerary_day_id
  ) {
    await getTripDay(db, tripId, input.itinerary_day_id);
    patch.sort_order = await nextSortOrder(db, input.itinerary_day_id);
  }
  if (input.estimated_cost !== undefined)
    patch.cost_is_estimate = costSource === "ai";

  const { data, error } = await db
    .from("activities")
    .update(patch)
    .eq("id", activityId)
    .eq("itinerary_day_id", current.itinerary_day_id)
    .select(ACTIVITY_COLUMNS)
    .single();
  if (error) throw mapDbError(error, "Updating the activity");

  const { budget } = await recalculateTripTotal(db, trip);
  return { activity: asRow(data), budget_summary: budget };
}

export async function deleteActivity({ db, userId }, tripId, activityId) {
  const trip = await getOwnedTrip(db, userId, tripId);
  const current = await getTripActivity(db, tripId, activityId);
  // The linked expense is removed by ON DELETE CASCADE.
  const { error } = await db
    .from("activities")
    .delete()
    .eq("id", activityId)
    .eq("itinerary_day_id", current.itinerary_day_id);
  if (error) throw mapDbError(error, "Deleting the activity");

  const { budget } = await recalculateTripTotal(db, trip);
  return { id: activityId, deleted: true, budget_summary: budget };
}

export async function reorderActivities({ db, userId }, tripId, body) {
  const input = parseReorderInput(body);
  await getOwnedTrip(db, userId, tripId);
  await getTripDay(db, tripId, input.itinerary_day_id);

  const { error } = await db.rpc("reorder_activities", {
    p_day_id: input.itinerary_day_id,
    p_activity_ids: input.activity_ids,
  });
  if (error?.code === "22023") {
    throw new ApiError(
      422,
      "INVALID_ORDER",
      "The new order must list every activity of that day exactly once.",
    );
  }
  if (error) throw mapDbError(error, "Reordering activities");

  const { data, error: loadError } = await db
    .from("activities")
    .select(ACTIVITY_COLUMNS)
    .eq("itinerary_day_id", input.itinerary_day_id)
    .order("sort_order");
  if (loadError) throw mapDbError(loadError, "Loading activities");
  return { itinerary_day_id: input.itinerary_day_id, activities: asRows(data) };
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

function duplicateExpense(error) {
  return error.code === "23505"
    ? new ApiError(
        409,
        "DUPLICATE_EXPENSE",
        "An expense with this title already exists in that category.",
      )
    : null;
}

async function getStandaloneExpense(db, tripId, expenseId) {
  const { data, error } = await db
    .from("trip_expenses")
    .select(EXPENSE_COLUMNS)
    .eq("id", expenseId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (error) throw mapDbError(error, "Loading the expense");
  if (!data)
    throw new ApiError(
      404,
      "EXPENSE_NOT_FOUND",
      "Expense not found in this trip.",
    );
  if (asRow(data).source === "activity") {
    throw new ApiError(
      409,
      "LINKED_EXPENSE",
      "This cost comes from an itinerary activity. Edit or delete the activity instead.",
    );
  }
  return data;
}

export async function createExpense({ db, userId }, tripId, body) {
  const input = parseExpenseInput(body, "create");
  const trip = await getOwnedTrip(db, userId, tripId);

  const { count, error: countError } = await db
    .from("trip_expenses")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);
  if (countError) throw mapDbError(countError, "Loading expenses");
  if ((count ?? 0) >= MAX_EXPENSES_PER_TRIP) {
    throw new ApiError(
      409,
      "TOO_MANY_EXPENSES",
      `A trip can have at most ${MAX_EXPENSES_PER_TRIP} expenses.`,
    );
  }

  const basis = input.cost_basis ?? "total";
  const { data, error } = await db
    .from("trip_expenses")
    .insert({
      ...input,
      cost_basis: basis,
      quantity: input.quantity ?? defaultQuantity(basis, trip),
      trip_id: tripId,
      source: "user",
    })
    .select(EXPENSE_COLUMNS)
    .single();
  if (error)
    throw duplicateExpense(error) ?? mapDbError(error, "Adding the expense");

  const { budget } = await recalculateTripTotal(db, trip);
  return { expense: asRow(data), budget_summary: budget };
}

export async function updateExpense({ db, userId }, tripId, expenseId, body) {
  const input = parseExpenseInput(body, "update");
  const trip = await getOwnedTrip(db, userId, tripId);
  await getStandaloneExpense(db, tripId, expenseId);

  const patch = { ...input };
  // A user edit to the price turns an AI estimate into the user's own figure.
  if (input.amount !== undefined && input.is_estimate === undefined)
    patch.is_estimate = false;

  const { data, error } = await db
    .from("trip_expenses")
    .update(patch)
    .eq("id", expenseId)
    .eq("trip_id", tripId)
    .select(EXPENSE_COLUMNS)
    .single();
  if (error)
    throw duplicateExpense(error) ?? mapDbError(error, "Updating the expense");

  const { budget } = await recalculateTripTotal(db, trip);
  return { expense: asRow(data), budget_summary: budget };
}

export async function deleteExpense({ db, userId }, tripId, expenseId) {
  const trip = await getOwnedTrip(db, userId, tripId);
  await getStandaloneExpense(db, tripId, expenseId);
  const { error } = await db
    .from("trip_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("trip_id", tripId);
  if (error) throw mapDbError(error, "Deleting the expense");

  const { budget } = await recalculateTripTotal(db, trip);
  return { id: expenseId, deleted: true, budget_summary: budget };
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
export async function optimizeDayRoute(
  { db, userId },
  tripId,
  body,
  getMatrix,
) {
  const input = parseOptimizeRouteInput(body);
  await getOwnedTrip(db, userId, tripId);
  await getTripDay(db, tripId, input.itinerary_day_id);

  const { data, error } = await db
    .from("activities")
    .select("id, lat, lng, time_slot, start_time, sort_order")
    .eq("itinerary_day_id", input.itinerary_day_id)
    .order("sort_order")
    .order("created_at");
  if (error) throw mapDbError(error, "Loading activities");
  const stops = (data ?? []).map((row) => {
    const r = row;
    return {
      id: r.id,
      lat: r.lat === null ? null : Number(r.lat),
      lng: r.lng === null ? null : Number(r.lng),
      time_slot: r.time_slot ?? null,
      // Postgres `time` comes back as HH:MM:SS.
      start_time:
        typeof r.start_time === "string" ? r.start_time.slice(0, 5) : null,
    };
  });

  const points = locatedPoints(stops);
  const mode = chooseTravelMode(points);
  // Fewer than 3 stops have only one sensible order: skip the (billed) routing call.
  const matrix =
    points.length >= 3
      ? await getMatrix(points, mode)
      : estimateMatrix(points, mode);
  const plan = planDayRoute(stops, matrix);

  let applied = false;
  if (input.apply && plan.changed) {
    const { error: reorderError } = await db.rpc("reorder_activities", {
      p_day_id: input.itinerary_day_id,
      p_activity_ids: plan.order,
    });
    if (reorderError?.code === "22023") {
      throw new ApiError(
        409,
        "DAY_CHANGED",
        "This day changed while optimising. Please try again.",
      );
    }
    if (reorderError) throw mapDbError(reorderError, "Saving the new order");
    for (const [id, time] of Object.entries(plan.start_times)) {
      const { error: timeError } = await db
        .from("activities")
        .update({ start_time: time })
        .eq("id", id)
        .eq("itinerary_day_id", input.itinerary_day_id);
      if (timeError) throw mapDbError(timeError, "Updating start times");
    }
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
