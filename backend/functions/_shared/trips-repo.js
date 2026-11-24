// Data access for trips in Firestore.
//
// One document per trip, `trips/{tripId}`, holding the trip fields plus
//   itinerary_days: [{ ...day, activities: [...] }]
//   expenses:       [...]   standalone expenses and the expense linked to each
//                           priced activity (source = "activity")
// A trip is always read and written as a whole, so every change is a single
// Firestore transaction: read → check owner → change → recompute total → write.
//
// Ownership: the Admin SDK bypasses Security Rules, so loadOwned() is the one
// place that checks `user_id`. Every read and write goes through it.

import { randomUUID } from "node:crypto";
import { db } from "./firebase.js";
import { ApiError } from "./http.js";
import { activityExpenseCategory, calculateBudget } from "./budget.js";

export const ESTIMATE_DISCLAIMER =
  "Prices, opening hours and coordinates suggested by AI are unverified estimates. Confirm them before booking.";

export const TRIP_FIELDS = [
  "id", "user_id", "title", "destination", "destination_lat", "destination_lng",
  "start_date", "end_date", "budget", "currency", "travelers", "interests", "pace",
  "travel_style", "notes", "travel_notes", "status", "total_estimated_cost",
  "generation_count", "generated_at", "ai_model", "created_at", "updated_at",
];

export const DAY_FIELDS = [
  "id", "trip_id", "day_number", "date", "title", "summary", "created_at", "updated_at",
];

export const ACTIVITY_FIELDS = [
  "id", "itinerary_day_id", "name", "description", "category", "time_slot", "start_time",
  "duration_minutes", "location_name", "lat", "lng", "estimated_cost", "cost_basis",
  "cost_is_estimate", "notes", "sort_order", "created_at", "updated_at",
];

export const EXPENSE_FIELDS = [
  "id", "trip_id", "activity_id", "category", "title", "amount", "currency", "quantity",
  "cost_basis", "notes", "source", "is_estimate", "created_at", "updated_at",
];

const COLLECTION = "trips";
// Firestore's limit is 1 MiB per document; stay well below it.
const MAX_TRIP_BYTES = 900_000;

export const newId = () => randomUUID();
export const nowIso = () => new Date().toISOString();

/** Copies `fields` from `source`, using null for missing ones (like SQL columns). */
export function pick(source, fields) {
  const out = {};
  for (const field of fields) out[field] = source?.[field] ?? null;
  return out;
}

function tripsCollection() {
  return db().collection(COLLECTION);
}

function notFound() {
  return new ApiError(404, "TRIP_NOT_FOUND", "Trip not found.");
}

function loadOwned(snapshot, userId) {
  if (!snapshot.exists) throw notFound();
  const trip = snapshot.data();
  // Someone else's trip is reported as missing, so its existence is not revealed.
  if (trip.user_id !== userId) throw notFound();
  return trip;
}

function unexpected(err, context) {
  if (err instanceof ApiError) return err;
  console.error(`${context}:`, err?.message ?? err);
  return new ApiError(500, "DATABASE_ERROR", `${context} failed. Please try again.`);
}

export async function getOwnedTrip(db, userId, tripId) {
  try {
    return loadOwned(await tripsCollection().doc(tripId).get(), userId);
  } catch (err) {
    throw unexpected(err, "Loading the trip");
  }
}

export async function listTrips(db, userId, limit) {
  try {
    const snapshot = await tripsCollection()
      .where("user_id", "==", userId)
      .orderBy("created_at", "desc")
      .limit(limit)
      .select(...TRIP_FIELDS)
      .get();
    return snapshot.docs.map((doc) => pick(doc.data(), TRIP_FIELDS));
  } catch (err) {
    throw unexpected(err, "Loading trips");
  }
}

/** Recomputes the cached total and timestamps before a trip is stored. */
function prepareForWrite(trip) {
  const { budget } = summarizeTrip(trip);
  trip.total_estimated_cost = budget.estimated_total;
  trip.updated_at = nowIso();
  if (JSON.stringify(trip).length > MAX_TRIP_BYTES) {
    throw new ApiError(
      409,
      "TRIP_TOO_LARGE",
      "This trip has reached its maximum size. Remove some stops or expenses first.",
    );
  }
  return trip;
}

/** Creates a new trip document (already fully built). */
export async function insertTrip(trip) {
  try {
    await tripsCollection().doc(trip.id).create(prepareForWrite(trip));
    return trip;
  } catch (err) {
    throw unexpected(err, "Creating the trip");
  }
}

/**
 * Changes an owned trip in one transaction. `change(trip)` edits the trip in
 * place and returns any result; it may run more than once if the transaction
 * is retried, so it must not have side effects outside the trip.
 * Returns { trip, result } with the trip as stored.
 */
export async function mutateTrip(db, tripId, change, context = "Saving the trip") {
  try {
    return await tripsCollection().firestore.runTransaction(async (tx) => {
      const ref = tripsCollection().doc(tripId);
      const trip = structuredClone(loadOwned(await tx.get(ref), db.userId));
      const result = await change(trip);
      tx.set(ref, prepareForWrite(trip));
      return { trip, result };
    });
  } catch (err) {
    throw unexpected(err, context);
  }
}

export async function deleteOwnedTrip(db, tripId) {
  try {
    await tripsCollection().firestore.runTransaction(async (tx) => {
      const ref = tripsCollection().doc(tripId);
      loadOwned(await tx.get(ref), db.userId);
      tx.delete(ref);
    });
  } catch (err) {
    throw unexpected(err, "Deleting the trip");
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const byOrder = (a, b) =>
  a.sort_order - b.sort_order || String(a.created_at).localeCompare(String(b.created_at));

export function sortedExpenses(trip) {
  return (trip.expenses ?? [])
    .map((expense) => pick(expense, EXPENSE_FIELDS))
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) ||
        String(a.created_at).localeCompare(String(b.created_at)),
    );
}

export function summarizeTrip(trip) {
  const expenses = sortedExpenses(trip);
  const budget = calculateBudget({
    budget: trip.budget,
    travelers: trip.travelers,
    expenses,
  });
  return { budget, expenses };
}

/** Budget summary for a trip (the stored total is kept current on every write). */
export function recalculateTripTotal(_db, trip) {
  return summarizeTrip(trip);
}

/** The full API representation of a trip. */
export async function getTripDetails(_db, trip) {
  const { budget, expenses } = summarizeTrip(trip);
  return {
    ...pick(trip, TRIP_FIELDS),
    total_estimated_cost: budget.estimated_total,
    itinerary_days: [...(trip.itinerary_days ?? [])]
      .sort((a, b) => a.day_number - b.day_number)
      .map((day) => ({
        ...pick(day, DAY_FIELDS),
        activities: [...(day.activities ?? [])]
          .sort(byOrder)
          .map((activity) => pick(activity, ACTIVITY_FIELDS)),
      })),
    expenses,
    budget_summary: budget,
    disclaimer: ESTIMATE_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// In-memory helpers used inside mutateTrip()
// ---------------------------------------------------------------------------

/** Finds a day of this trip, or throws DAY_NOT_FOUND. */
export function getTripDay(trip, dayId) {
  const day = (trip.itinerary_days ?? []).find((d) => d.id === dayId);
  if (!day)
    throw new ApiError(
      404,
      "DAY_NOT_FOUND",
      "That itinerary day does not belong to this trip.",
    );
  day.activities ??= [];
  return day;
}

/** Finds an activity of this trip with its day, or throws ACTIVITY_NOT_FOUND. */
export function getTripActivity(trip, activityId) {
  for (const day of trip.itinerary_days ?? []) {
    const activity = (day.activities ?? []).find((a) => a.id === activityId);
    if (activity) return { day, activity };
  }
  throw new ApiError(404, "ACTIVITY_NOT_FOUND", "Activity not found in this trip.");
}

export function nextSortOrder(day) {
  return (day.activities ?? []).reduce((max, a) => Math.max(max, a.sort_order + 1), 0);
}

/**
 * Keeps an activity's linked expense in step with its cost: one linked expense
 * per priced activity, none for free ones. (Replaces the old database trigger.)
 */
export function syncActivityExpense(trip, activity) {
  trip.expenses ??= [];
  const index = trip.expenses.findIndex((e) => e.activity_id === activity.id);
  if (!(Number(activity.estimated_cost) > 0)) {
    if (index !== -1) trip.expenses.splice(index, 1);
    return;
  }
  const now = nowIso();
  const linked = {
    ...(index === -1
      ? { id: newId(), trip_id: trip.id, created_at: now, currency: "INR", notes: null }
      : trip.expenses[index]),
    activity_id: activity.id,
    category: activityExpenseCategory(activity.category),
    title: activity.name,
    amount: activity.estimated_cost,
    quantity: 1,
    cost_basis: activity.cost_basis,
    source: "activity",
    is_estimate: activity.cost_is_estimate,
    updated_at: now,
  };
  if (index === -1) trip.expenses.push(linked);
  else trip.expenses[index] = linked;
}

export function removeActivityExpense(trip, activityId) {
  trip.expenses = (trip.expenses ?? []).filter((e) => e.activity_id !== activityId);
}

/** True if a standalone expense with this category and title already exists. */
export function hasDuplicateExpense(trip, category, title, exceptId = null) {
  const key = title.trim().toLowerCase();
  return (trip.expenses ?? []).some(
    (e) =>
      e.activity_id === null &&
      e.id !== exceptId &&
      e.category === category &&
      e.title.trim().toLowerCase() === key,
  );
}
