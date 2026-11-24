// API: trips
// Trip, activity and expense management for the signed-in user. See routes.js
// for the endpoint list. Every handler re-verifies that the caller owns the trip;
// user ids sent by the client are never trusted.

import { serveJson } from "../_shared/handler.js";
import { ApiError, ok, readJsonBody } from "../_shared/http.js";
import { addDaysUtc, tripDayCount } from "../_shared/budget.js";
import { enforceRateLimit, RATE_LIMITS } from "../_shared/rate-limit.js";
import { authenticate } from "../_shared/auth.js";
import { routesApiKeyFromEnv, travelMatrix } from "../_shared/travel-matrix.js";
import * as actions from "../_shared/trip-actions.js";
import {
  deleteOwnedTrip,
  getOwnedTrip,
  getTripDetails,
  insertTrip,
  listTrips as listOwnedTrips,
  mutateTrip,
  newId,
  nowIso,
  recalculateTripTotal,
} from "../_shared/trips-repo.js";
import { parseTripInput, parseTripUpdate } from "../_shared/validation.js";
import { matchRoute } from "./routes.js";

const MAX_TRIPS_LISTED = 200;

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

async function listTrips({ db, userId }) {
  return ok(await listOwnedTrips(db, userId, MAX_TRIPS_LISTED));
}

async function createTrip({ db, userId }, body) {
  const { title: rawTitle, ...fields } =
    body && typeof body === "object" ? body : {};
  const input = parseTripInput(fields);
  if (
    rawTitle !== undefined &&
    (typeof rawTitle !== "string" || !rawTitle.trim() || rawTitle.length > 200)
  ) {
    throw new ApiError(422, "VALIDATION_FAILED", "Some fields are invalid.", {
      fields: { title: "must be 1–200 characters" },
    });
  }
  const days = tripDayCount(input.start_date, input.end_date);
  const id = newId();
  const now = nowIso();

  // The trip and its days are one document, so they are created together.
  const trip = await insertTrip({
    id,
    user_id: userId,
    title: rawTitle?.trim() || `${days}-day ${input.destination} trip`,
    destination: input.destination,
    destination_lat: null,
    destination_lng: null,
    start_date: input.start_date,
    end_date: input.end_date,
    budget: input.budget,
    currency: "INR",
    travelers: input.travelers,
    interests: input.interests ?? [],
    pace: input.pace,
    travel_style: input.travel_style,
    notes: input.preferences ?? null,
    travel_notes: null,
    status: "draft",
    total_estimated_cost: 0,
    generation_count: 0,
    generated_at: null,
    ai_model: null,
    created_at: now,
    updated_at: now,
    itinerary_days: Array.from({ length: days }, (_, i) => ({
      id: newId(),
      trip_id: id,
      day_number: i + 1,
      date: addDaysUtc(input.start_date, i),
      title: `Day ${i + 1}`,
      summary: "",
      created_at: now,
      updated_at: now,
      activities: [],
    })),
    expenses: [],
  });
  return ok(await getTripDetails(db, trip), 201);
}

async function updateTrip({ db }, tripId, body) {
  const patch = parseTripUpdate(body);

  // Day dates and trip fields change together, or not at all.
  const { trip } = await mutateTrip(db, tripId, (trip) => {
    if (patch.start_date && patch.end_date) {
      const days = trip.itinerary_days ?? [];
      const newLength = tripDayCount(patch.start_date, patch.end_date);
      if (days.length && newLength !== days.length) {
        throw new ApiError(
          409,
          "DATES_REQUIRE_REGENERATION",
          `This itinerary has ${days.length} day(s). Keep the same trip length to shift dates, ` +
            "or regenerate the itinerary for the new dates.",
        );
      }
      const now = nowIso();
      for (const day of days) {
        day.date = addDaysUtc(patch.start_date, day.day_number - 1);
        day.updated_at = now;
      }
    }
    Object.assign(trip, patch);
  }, "Updating the trip");

  // Budget or traveler count may have changed: totals are recalculated on save.
  return ok(await getTripDetails(db, trip));
}

async function deleteTrip({ db }, tripId) {
  // Days, activities and expenses live in the trip document and go with it.
  await deleteOwnedTrip(db, tripId);
  return ok({ id: tripId, deleted: true });
}

// ---------------------------------------------------------------------------

export default serveJson(["GET", "POST", "PATCH", "DELETE"], async (req) => {
  const route = matchRoute(req.method, new URL(req.url).pathname);
  const { db, user } = await authenticate(req);
  const ctx = { db, userId: user.id };

  const body =
    req.method === "POST" || req.method === "PATCH"
      ? await readJsonBody(req)
      : undefined;
  if (req.method !== "GET") await enforceRateLimit(db, RATE_LIMITS.writes);

  switch (route.name) {
    case "listTrips":
      return listTrips(ctx);
    case "createTrip":
      return createTrip(ctx, body);
    case "getTrip":
      return ok(
        await getTripDetails(db, await getOwnedTrip(db, user.id, route.tripId)),
      );
    case "updateTrip":
      return updateTrip(ctx, route.tripId, body);
    case "deleteTrip":
      return deleteTrip(ctx, route.tripId);
    case "getBudget": {
      const trip = await getOwnedTrip(db, user.id, route.tripId);
      return ok(recalculateTripTotal(db, trip).budget);
    }
    case "createActivity":
      return ok(await actions.createActivity(ctx, route.tripId, body), 201);
    case "reorderActivities":
      return ok(await actions.reorderActivities(ctx, route.tripId, body));
    case "updateActivity":
      return ok(
        await actions.updateActivity(ctx, route.tripId, route.activityId, body),
      );
    case "deleteActivity":
      return ok(
        await actions.deleteActivity(ctx, route.tripId, route.activityId),
      );
    case "createExpense":
      return ok(await actions.createExpense(ctx, route.tripId, body), 201);
    case "updateExpense":
      return ok(
        await actions.updateExpense(ctx, route.tripId, route.expenseId, body),
      );
    case "deleteExpense":
      return ok(
        await actions.deleteExpense(ctx, route.tripId, route.expenseId),
      );
    case "optimizeRoute": {
      await enforceRateLimit(db, RATE_LIMITS.routesPerHour);
      const apiKey = routesApiKeyFromEnv();
      return ok(
        await actions.optimizeDayRoute(
          ctx,
          route.tripId,
          body,
          (points, mode) => travelMatrix(points, mode, apiKey),
        ),
      );
    }
  }
});
