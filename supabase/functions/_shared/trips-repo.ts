// Data access for trips. All queries use the caller-scoped client (RLS applies)
// and additionally filter on the verified user id, so ownership is checked twice.

import { ApiError, mapDbError } from "./http.ts";
import { calculateBudget, type BudgetSummary, type BudgetExpense } from "./budget.ts";
import type { Db } from "./supabase.ts";

export const ESTIMATE_DISCLAIMER =
  "Prices, opening hours and coordinates suggested by AI are unverified estimates. Confirm them before booking.";

export const TRIP_COLUMNS =
  "id, user_id, title, destination, destination_lat, destination_lng, start_date, end_date, budget, currency, " +
  "travelers, interests, pace, travel_style, notes, travel_notes, status, total_estimated_cost, generation_count, " +
  "generated_at, ai_model, created_at, updated_at";

export const DAY_COLUMNS = "id, trip_id, day_number, date, title, summary, created_at, updated_at";

export const ACTIVITY_COLUMNS =
  "id, itinerary_day_id, name, description, category, time_slot, start_time, duration_minutes, location_name, " +
  "lat, lng, estimated_cost, cost_basis, cost_is_estimate, notes, sort_order, created_at, updated_at";

export const EXPENSE_COLUMNS =
  "id, trip_id, activity_id, category, title, amount, currency, quantity, cost_basis, notes, source, is_estimate, " +
  "created_at, updated_at";

export type TripRow = Record<string, unknown> & {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  budget: number;
  travelers: number;
  total_estimated_cost: number;
};

type Row = Record<string, unknown>;

const NUMERIC_FIELDS = ["budget", "total_estimated_cost", "estimated_cost", "amount", "quantity"];

/** Rows from untyped selects (column lists are built at runtime, so supabase-js cannot infer them). */
export function asRows(data: unknown): Row[] {
  return ((data ?? []) as Row[]).map(normalizeRow);
}

export function asRow(data: unknown): Row {
  return normalizeRow(data as Row);
}

/** PostgREST may return numeric columns as strings; normalise to numbers. */
export function normalizeRow<T extends Row>(row: T): T {
  const out: Row = { ...row };
  for (const key of NUMERIC_FIELDS) {
    if (key in out && out[key] !== null && out[key] !== undefined) out[key] = Number(out[key]);
  }
  return out as T;
}

export async function getOwnedTrip(db: Db, userId: string, tripId: string): Promise<TripRow> {
  const { data, error } = await db
    .from("trips")
    .select(TRIP_COLUMNS)
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw mapDbError(error, "Loading the trip");
  if (!data) throw new ApiError(404, "TRIP_NOT_FOUND", "Trip not found.");
  return normalizeRow(data as unknown as TripRow);
}

export async function listExpenses(db: Db, tripId: string): Promise<Row[]> {
  const { data, error } = await db
    .from("trip_expenses")
    .select(EXPENSE_COLUMNS)
    .eq("trip_id", tripId)
    .order("category")
    .order("created_at");
  if (error) throw mapDbError(error, "Loading expenses");
  return asRows(data);
}

export function summarize(trip: TripRow, expenses: Row[]): BudgetSummary {
  return calculateBudget({
    budget: trip.budget,
    travelers: trip.travelers,
    expenses: expenses as unknown as BudgetExpense[],
  });
}

/**
 * Recomputes the trip's budget from its expenses and stores the cached total
 * used by the trip list. Call after any change to expenses, activity costs or
 * traveler count.
 */
export async function recalculateTripTotal(db: Db, trip: TripRow): Promise<{ budget: BudgetSummary; expenses: Row[] }> {
  const expenses = await listExpenses(db, trip.id);
  const budget = summarize(trip, expenses);
  if (Number(trip.total_estimated_cost) !== budget.estimated_total) {
    const { error } = await db
      .from("trips")
      .update({ total_estimated_cost: budget.estimated_total })
      .eq("id", trip.id)
      .eq("user_id", trip.user_id);
    if (error) throw mapDbError(error, "Updating the trip total");
    trip.total_estimated_cost = budget.estimated_total;
  }
  return { budget, expenses };
}

export async function getTripDetails(db: Db, trip: TripRow) {
  const { data: days, error: dayError } = await db
    .from("itinerary_days")
    .select(DAY_COLUMNS)
    .eq("trip_id", trip.id)
    .order("day_number");
  if (dayError) throw mapDbError(dayError, "Loading the itinerary");

  const dayIds = ((days ?? []) as Row[]).map((day) => day.id as string);
  let activities: Row[] = [];
  if (dayIds.length) {
    const { data, error } = await db
      .from("activities")
      .select(ACTIVITY_COLUMNS)
      .in("itinerary_day_id", dayIds)
      .order("sort_order")
      .order("created_at");
    if (error) throw mapDbError(error, "Loading activities");
    activities = asRows(data);
  }

  const { budget, expenses } = await recalculateTripTotal(db, trip);

  return {
    ...trip,
    itinerary_days: ((days ?? []) as Row[]).map((day) => ({
      ...day,
      activities: activities.filter((activity) => activity.itinerary_day_id === day.id),
    })),
    expenses,
    budget_summary: budget,
    disclaimer: ESTIMATE_DISCLAIMER,
  };
}

/** Loads a day and confirms it belongs to the given (already owned) trip. */
export async function getTripDay(db: Db, tripId: string, dayId: string): Promise<Row> {
  const { data, error } = await db
    .from("itinerary_days")
    .select("id, trip_id, day_number, date")
    .eq("id", dayId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (error) throw mapDbError(error, "Loading the day");
  if (!data) throw new ApiError(404, "DAY_NOT_FOUND", "That itinerary day does not belong to this trip.");
  return data as Row;
}

/** Loads an activity and confirms it belongs to the given (already owned) trip. */
export async function getTripActivity(db: Db, tripId: string, activityId: string): Promise<Row> {
  const { data, error } = await db
    .from("activities")
    .select(`${ACTIVITY_COLUMNS}, itinerary_days!inner(trip_id)`)
    .eq("id", activityId)
    .eq("itinerary_days.trip_id", tripId)
    .maybeSingle();
  if (error) throw mapDbError(error, "Loading the activity");
  if (!data) throw new ApiError(404, "ACTIVITY_NOT_FOUND", "Activity not found in this trip.");
  const { itinerary_days: _join, ...activity } = data as Row;
  return normalizeRow(activity);
}

export async function nextSortOrder(db: Db, dayId: string): Promise<number> {
  const { data, error } = await db
    .from("activities")
    .select("sort_order")
    .eq("itinerary_day_id", dayId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) throw mapDbError(error, "Loading activities");
  const top = (data as { sort_order: number }[] | null)?.[0];
  return top ? top.sort_order + 1 : 0;
}
