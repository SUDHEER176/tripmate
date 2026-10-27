// Supabase Edge Function: trips
// Trip, activity and expense management for the signed-in user. See routes.ts
// for the endpoint list. Every handler re-verifies that the caller owns the trip;
// user ids sent by the client are never trusted.

import { serveJson } from "../_shared/handler.ts";
import { ApiError, mapDbError, ok, readJsonBody } from "../_shared/http.ts";
import { addDaysUtc, tripDayCount } from "../_shared/budget.ts";
import { enforceRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { authenticate, type Db } from "../_shared/supabase.ts";
import { routesApiKeyFromEnv, travelMatrix } from "../_shared/travel-matrix.ts";
import * as actions from "../_shared/trip-actions.ts";
import {
  TRIP_COLUMNS,
  getOwnedTrip,
  getTripDetails,
  normalizeRow,
  recalculateTripTotal,
  type TripRow,
} from "../_shared/trips-repo.ts";
import { parseTripInput, parseTripUpdate } from "../_shared/validation.ts";
import { matchRoute } from "./routes.ts";

const MAX_TRIPS_LISTED = 200;

type Ctx = { db: Db; userId: string };

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

async function listTrips({ db, userId }: Ctx) {
  const { data, error } = await db
    .from("trips")
    .select(TRIP_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_TRIPS_LISTED);
  if (error) throw mapDbError(error, "Loading trips");
  return ok(((data ?? []) as unknown as Record<string, unknown>[]).map(normalizeRow));
}

async function createTrip({ db, userId }: Ctx, body: unknown) {
  const { title: rawTitle, ...fields } = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const input = parseTripInput(fields);
  if (rawTitle !== undefined && (typeof rawTitle !== "string" || !rawTitle.trim() || rawTitle.length > 200)) {
    throw new ApiError(422, "VALIDATION_FAILED", "Some fields are invalid.", {
      fields: { title: "must be 1–200 characters" },
    });
  }
  const days = tripDayCount(input.start_date, input.end_date);

  const { data: trip, error } = await db
    .from("trips")
    .insert({
      user_id: userId,
      title: (rawTitle as string | undefined)?.trim() || `${days}-day ${input.destination} trip`,
      destination: input.destination,
      start_date: input.start_date,
      end_date: input.end_date,
      budget: input.budget,
      travelers: input.travelers,
      interests: input.interests,
      pace: input.pace,
      travel_style: input.travel_style,
      notes: input.preferences,
      status: "draft",
    })
    .select(TRIP_COLUMNS)
    .single();
  if (error) throw mapDbError(error, "Creating the trip");

  const row = normalizeRow(trip as unknown as TripRow);
  const { error: dayError } = await db.from("itinerary_days").insert(
    Array.from({ length: days }, (_, i) => ({
      trip_id: row.id,
      day_number: i + 1,
      date: addDaysUtc(input.start_date, i),
      title: `Day ${i + 1}`,
      summary: "",
    })),
  );
  if (dayError) {
    await db.from("trips").delete().eq("id", row.id).eq("user_id", userId); // compensate: no half-created trips
    throw mapDbError(dayError, "Creating the itinerary days");
  }
  return ok(await getTripDetails(db, row), 201);
}

async function updateTrip({ db, userId }: Ctx, tripId: string, body: unknown) {
  const patch = parseTripUpdate(body);
  const trip = await getOwnedTrip(db, userId, tripId);

  if (patch.start_date && patch.end_date) {
    const { data: days, error } = await db.from("itinerary_days").select("id, day_number").eq("trip_id", tripId);
    if (error) throw mapDbError(error, "Loading the itinerary");
    const newLength = tripDayCount(patch.start_date, patch.end_date);
    const existing = (days ?? []) as { id: string; day_number: number }[];
    if (existing.length && newLength !== existing.length) {
      throw new ApiError(
        409,
        "DATES_REQUIRE_REGENERATION",
        `This itinerary has ${existing.length} day(s). Keep the same trip length to shift dates, ` +
          "or regenerate the itinerary for the new dates.",
      );
    }
    for (const day of existing) {
      const { error: shiftError } = await db
        .from("itinerary_days")
        .update({ date: addDaysUtc(patch.start_date, day.day_number - 1) })
        .eq("id", day.id)
        .eq("trip_id", tripId);
      if (shiftError) throw mapDbError(shiftError, "Updating itinerary dates");
    }
  }

  const { data, error } = await db
    .from("trips")
    .update(patch)
    .eq("id", tripId)
    .eq("user_id", userId)
    .select(TRIP_COLUMNS)
    .single();
  if (error) throw mapDbError(error, "Updating the trip");

  // Budget or traveler count may have changed: totals are recalculated in getTripDetails.
  return ok(await getTripDetails(db, { ...trip, ...normalizeRow(data as unknown as TripRow) }));
}

async function deleteTrip({ db, userId }: Ctx, tripId: string) {
  // Days, activities and expenses are removed by ON DELETE CASCADE in the same statement.
  const { data, error } = await db.from("trips").delete().eq("id", tripId).eq("user_id", userId).select("id");
  if (error) throw mapDbError(error, "Deleting the trip");
  if (!data?.length) throw new ApiError(404, "TRIP_NOT_FOUND", "Trip not found.");
  return ok({ id: tripId, deleted: true });
}

// ---------------------------------------------------------------------------

serveJson(["GET", "POST", "PATCH", "DELETE"], async (req) => {
  const route = matchRoute(req.method, new URL(req.url).pathname);
  const { db, user } = await authenticate(req);
  const ctx: Ctx = { db, userId: user.id };

  const body = req.method === "POST" || req.method === "PATCH" ? await readJsonBody(req) : undefined;
  if (req.method !== "GET") await enforceRateLimit(db, RATE_LIMITS.writes);

  switch (route.name) {
    case "listTrips":
      return listTrips(ctx);
    case "createTrip":
      return createTrip(ctx, body);
    case "getTrip":
      return ok(await getTripDetails(db, await getOwnedTrip(db, user.id, route.tripId)));
    case "updateTrip":
      return updateTrip(ctx, route.tripId, body);
    case "deleteTrip":
      return deleteTrip(ctx, route.tripId);
    case "getBudget": {
      const trip = await getOwnedTrip(db, user.id, route.tripId);
      return ok((await recalculateTripTotal(db, trip)).budget);
    }
    case "createActivity":
      return ok(await actions.createActivity(ctx, route.tripId, body), 201);
    case "reorderActivities":
      return ok(await actions.reorderActivities(ctx, route.tripId, body));
    case "updateActivity":
      return ok(await actions.updateActivity(ctx, route.tripId, route.activityId, body));
    case "deleteActivity":
      return ok(await actions.deleteActivity(ctx, route.tripId, route.activityId));
    case "createExpense":
      return ok(await actions.createExpense(ctx, route.tripId, body), 201);
    case "updateExpense":
      return ok(await actions.updateExpense(ctx, route.tripId, route.expenseId, body));
    case "deleteExpense":
      return ok(await actions.deleteExpense(ctx, route.tripId, route.expenseId));
    case "optimizeRoute": {
      await enforceRateLimit(db, RATE_LIMITS.routesPerHour);
      const apiKey = routesApiKeyFromEnv();
      return ok(
        await actions.optimizeDayRoute(ctx, route.tripId, body, (points, mode) => travelMatrix(points, mode, apiKey)),
      );
    }
  }
});
