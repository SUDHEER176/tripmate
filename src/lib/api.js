import { generateLocalPlan } from "./itinerary";
import { supabase } from "./supabase";
import { activityExpenseCategory, calculateBudget } from "./budget";
import {
  chooseTravelMode,
  estimateMatrix,
  locatedPoints,
  planDayRoute,
} from "./route-optimizer";

const TRIPS_KEY = "tripmate.trips";
const USER_KEY = "tripmate.user";

/** A trip as stored by local demo mode; the budget is always derived on read. */

function readTrips() {
  const raw = localStorage.getItem(TRIPS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function writeTrips(trips) {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
}

export function getDemoUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setDemoUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export async function signUp(email, password, fullName) {
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (
        msg.includes("error sending confirmation") ||
        msg.includes("error sending") ||
        error.status === 500
      ) {
        throw new Error(
          "Supabase email delivery failed. To fix: In Supabase Dashboard -> Authentication -> Providers -> Email, toggle OFF 'Confirm email' so accounts activate instantly without waiting for SMTP.",
        );
      }
      if (msg.includes("database error")) {
        throw new Error(
          "Database trigger error: Please open Supabase Dashboard -> SQL Editor and run supabase/schema.sql to ensure the profiles table exists.",
        );
      }
      throw error;
    }
    return data;
  }
  const user = { id: crypto.randomUUID(), email, fullName };
  setDemoUser(user);
  return { user };
}

export async function signIn(email, password) {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }
  if (!password) throw new Error("Password is required.");
  const existing = getDemoUser();
  const user = existing ?? {
    id: crypto.randomUUID(),
    email,
    fullName: email.split("@")[0],
  };
  user.email = email;
  setDemoUser(user);
  return { user };
}

export async function signInWithOAuth(provider) {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/my-trips`,
      },
    });
    if (error) throw error;
    return data;
  }
  const user = {
    id: crypto.randomUUID(),
    email: `${provider.toLowerCase()}@tripmate.ai`,
    fullName: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Traveler`,
  };
  setDemoUser(user);
  return { user };
}

export async function sendOtp(email, fullName) {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: fullName ? { full_name: fullName } : undefined,
        shouldCreateUser: true,
      },
    });
    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (msg.includes("error sending") || error.status === 500) {
        throw new Error(
          "Supabase email delivery rate limit. In Supabase Dashboard -> Authentication -> Providers -> Email, check your email rate limits or configure SMTP.",
        );
      }
      throw error;
    }
    return data;
  }
  return { success: true };
}

export async function verifyOtp(email, token, type = "signup") {
  if (supabase) {
    const cleanToken = token.trim();
    // Try primary type
    let { data, error } = await supabase.auth.verifyOtp({
      email,
      token: cleanToken,
      type,
    });
    // If error, try fallback type (signup <-> email)
    if (error && (type === "signup" || type === "email")) {
      const fallbackType = type === "signup" ? "email" : "signup";
      const retry = await supabase.auth.verifyOtp({
        email,
        token: cleanToken,
        type: fallbackType,
      });
      if (!retry.error) {
        data = retry.data;
        error = null;
      }
    }
    if (error) throw error;
    return data;
  }
  // Demo fallback mode
  const user = {
    id: crypto.randomUUID(),
    email,
    fullName: email.split("@")[0] || "Traveler",
  };
  setDemoUser(user);
  return { user };
}

export async function signOut() {
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return;
  }
  setDemoUser(null);
}

export async function fetchSession() {
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? "",
      fullName:
        data.user.user_metadata.full_name ?? data.user.email ?? "Traveler",
    };
  }
  return getDemoUser();
}

// =============================================================================
// Trips — Supabase mode talks to the `trips` and `generate-itinerary` Edge
// Functions (the server verifies ownership from the JWT; no user id is sent).
// Without Supabase credentials, the same operations run against localStorage.
// =============================================================================

export class ApiRequestError extends Error {
  status;
  code;
  fields;

  constructor(message, status, code, fields) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function toApiError(error) {
  const response = error?.context;
  if (response instanceof Response) {
    try {
      const body = await response.clone().json();
      const err = body?.error;
      if (err?.message) {
        const fields = err.details?.fields;
        const detail = fields
          ? ` ${Object.entries(fields)
              .map(
                ([field, problem]) => `${field.replace(/_/g, " ")} ${problem}`,
              )
              .join("; ")}.`
          : "";
        return new ApiRequestError(
          `${err.message}${detail}`,
          response.status,
          err.code ?? "ERROR",
          fields,
        );
      }
    } catch {
      // fall through to the generic message
    }
    if (response.status === 401) {
      return new ApiRequestError(
        "Your session has expired. Please sign in again.",
        401,
        "AUTH_INVALID",
      );
    }
    return new ApiRequestError(
      "The request failed. Please try again.",
      response.status,
      "HTTP_ERROR",
    );
  }
  return new ApiRequestError(
    "Could not reach the server. Check your connection and try again.",
    0,
    "NETWORK_ERROR",
  );
}

async function request(path, options = {}) {
  const { data, error } = await supabase.functions.invoke(path, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    body: options.body,
  });
  if (error) throw await toApiError(error);
  return data.data;
}

// ---- Local demo mode helpers -------------------------------------------------

function localExpenses(trip) {
  const linked = trip.itinerary_days.flatMap((day) =>
    day.activities
      .filter((activity) => activity.estimated_cost > 0)
      .map((activity) => ({
        id: `activity-${activity.id}`,
        trip_id: trip.id,
        activity_id: activity.id,
        category: activityExpenseCategory(activity.category),
        title: activity.name,
        amount: activity.estimated_cost,
        quantity: 1,
        // The local planner prices activities for the whole group.
        cost_basis: activity.cost_basis ?? "total",
        notes: null,
        source: "activity",
        is_estimate: activity.cost_is_estimate ?? true,
      })),
  );
  return [...linked, ...(trip.expenses ?? [])];
}

function withLocalBudget(trip) {
  const expenses = localExpenses(trip);
  const budget_summary = calculateBudget({
    budget: trip.budget,
    travelers: trip.travelers,
    expenses: expenses,
  });
  return {
    ...trip,
    expenses,
    budget_summary,
    total_estimated_cost: budget_summary.estimated_total,
  };
}

function updateLocalTrip(tripId, change) {
  let updated = null;
  writeTrips(
    readTrips().map((trip) => {
      if (trip.id !== tripId) return trip;
      const next = change(trip);
      const total = withLocalBudget(next).budget_summary.estimated_total;
      updated = {
        ...next,
        total_estimated_cost: total,
        updated_at: new Date().toISOString(),
      };
      return updated;
    }),
  );
  if (!updated)
    throw new ApiRequestError("Trip not found.", 404, "TRIP_NOT_FOUND");
  return withLocalBudget(updated);
}

function buildLocalTrip(userId, values, base) {
  const plan = generateLocalPlan(values);
  const id = base?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    id,
    user_id: userId,
    title: plan.title,
    destination: values.destination,
    destination_lat: plan.destination_lat,
    destination_lng: plan.destination_lng,
    start_date: values.start_date,
    end_date: values.end_date,
    budget: values.budget,
    travelers: values.travelers,
    interests: values.interests,
    pace: values.pace,
    travel_style: values.travel_style,
    notes: values.notes || null,
    status: "planned",
    total_estimated_cost: plan.total_estimated_cost,
    generation_count: (base?.generation_count ?? 0) + 1,
    created_at: base?.created_at ?? now,
    updated_at: now,
    itinerary_days: plan.itinerary_days.map((day) => ({ ...day, trip_id: id })),
    expenses: base?.expenses ?? [],
  };
}

function activityPatch(activity) {
  return {
    name: activity.name,
    category: activity.category,
    start_time: activity.start_time || null,
    time_slot: activity.time_slot ?? null,
    duration_minutes: activity.duration_minutes ?? null,
    description: activity.description?.trim() || null,
    location_name: activity.location_name?.trim() || null,
    estimated_cost: activity.estimated_cost,
    cost_basis: activity.cost_basis ?? "per_person",
    notes: activity.notes?.trim() || null,
  };
}

// ---- Trips -------------------------------------------------------------------

export async function listTrips(userId) {
  if (supabase) return request("trips");
  return readTrips()
    .filter((trip) => trip.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getTrip(id) {
  if (supabase) {
    try {
      return await request(`trips/${encodeURIComponent(id)}`);
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        (err.status === 404 || err.status === 400)
      )
        return null;
      throw err;
    }
  }
  const trip = readTrips().find((item) => item.id === id);
  return trip ? withLocalBudget(trip) : null;
}

/** Generates an AI itinerary on the server and saves it. Nothing is saved if generation fails. */
export async function createTrip(userId, values) {
  if (supabase) {
    const result = await request("generate-itinerary", {
      body: {
        destination: values.destination.trim(),
        start_date: values.start_date,
        end_date: values.end_date,
        travelers: values.travelers,
        budget: values.budget,
        travel_style: values.travel_style,
        interests: values.interests,
        pace: values.pace,
        preferences: values.notes.trim() || null,
      },
    });
    return result.trip;
  }
  const trip = buildLocalTrip(userId, values);
  writeTrips([trip, ...readTrips()]);
  return withLocalBudget(trip);
}

/** Replaces the itinerary with a fresh AI plan. Callers must confirm with the user first. */
export async function regenerateTrip(tripId) {
  if (supabase) {
    const result = await request("generate-itinerary", {
      body: { trip_id: tripId, confirm_regenerate: true },
    });
    return result.trip;
  }
  const existing = readTrips().find((trip) => trip.id === tripId);
  if (!existing)
    throw new ApiRequestError("Trip not found.", 404, "TRIP_NOT_FOUND");
  return updateLocalTrip(tripId, (trip) =>
    buildLocalTrip(
      trip.user_id,
      {
        destination: trip.destination,
        start_date: trip.start_date,
        end_date: trip.end_date,
        budget: trip.budget,
        travelers: trip.travelers,
        interests: trip.interests,
        pace: trip.pace,
        travel_style: trip.travel_style ?? "mid_range",
        notes: trip.notes ?? "",
      },
      trip,
    ),
  );
}

export async function updateTrip(tripId, patch) {
  if (supabase)
    return request(`trips/${tripId}`, { method: "PATCH", body: patch });
  return updateLocalTrip(tripId, (trip) => ({ ...trip, ...patch }));
}

export async function deleteTrip(id) {
  if (supabase) {
    await request(`trips/${id}`, { method: "DELETE" });
    return;
  }
  writeTrips(readTrips().filter((trip) => trip.id !== id));
}

// ---- Activities --------------------------------------------------------------

export async function addActivity(tripId, dayId) {
  const draft = {
    name: "New stop",
    category: "activity",
    start_time: "12:00",
    time_slot: "afternoon",
    estimated_cost: 0,
  };
  if (supabase) {
    const result = await request(`trips/${tripId}/activities`, {
      body: { itinerary_day_id: dayId, ...draft },
    });
    return result.activity;
  }
  const activity = {
    ...draft,
    id: crypto.randomUUID(),
    itinerary_day_id: dayId,
    location_name: null,
    lat: null,
    lng: null,
    notes: null,
    cost_basis: "total",
    cost_is_estimate: false,
    sort_order: 99,
  };
  updateLocalTrip(tripId, (trip) => ({
    ...trip,
    itinerary_days: trip.itinerary_days.map((day) =>
      day.id === dayId
        ? {
            ...day,
            activities: [
              ...day.activities,
              { ...activity, sort_order: day.activities.length },
            ],
          }
        : day,
    ),
  }));
  return activity;
}

export async function updateActivity(tripId, activity) {
  if (supabase) {
    await request(`trips/${tripId}/activities/${activity.id}`, {
      method: "PATCH",
      body: activityPatch(activity),
    });
    return;
  }
  updateLocalTrip(tripId, (trip) => ({
    ...trip,
    itinerary_days: trip.itinerary_days.map((day) => ({
      ...day,
      activities: day.activities.map((item) =>
        item.id === activity.id
          ? { ...activity, cost_is_estimate: false }
          : item,
      ),
    })),
  }));
}

export async function deleteActivity(tripId, activityId) {
  if (supabase) {
    await request(`trips/${tripId}/activities/${activityId}`, {
      method: "DELETE",
    });
    return;
  }
  updateLocalTrip(tripId, (trip) => ({
    ...trip,
    itinerary_days: trip.itinerary_days.map((day) => ({
      ...day,
      activities: day.activities.filter((item) => item.id !== activityId),
    })),
  }));
}

/** Saves a new order for one day. `activityIds` must list every activity of that day. */
export async function reorderActivities(tripId, dayId, activityIds) {
  if (supabase) {
    await request(`trips/${tripId}/activities/reorder`, {
      body: { itinerary_day_id: dayId, activity_ids: activityIds },
    });
    return;
  }
  updateLocalTrip(tripId, (trip) => ({
    ...trip,
    itinerary_days: trip.itinerary_days.map((day) =>
      day.id !== dayId
        ? day
        : {
            ...day,
            activities: activityIds
              .map((id, index) => {
                const item = day.activities.find(
                  (activity) => activity.id === id,
                );
                return item ? { ...item, sort_order: index } : null;
              })
              .filter((item) => item !== null),
          },
    ),
  }));
}

/**
 * Finds the order of a day's stops with the least travel time. Returns a
 * preview; pass `apply` to save the new order and start times.
 */
export async function optimizeDayRoute(tripId, dayId, apply = false) {
  if (supabase) {
    return request(`trips/${tripId}/optimize-route`, {
      body: { itinerary_day_id: dayId, apply },
    });
  }
  const trip = readTrips().find((item) => item.id === tripId);
  const day = trip?.itinerary_days.find((item) => item.id === dayId);
  if (!trip || !day)
    throw new ApiRequestError("Trip not found.", 404, "TRIP_NOT_FOUND");

  const stops = day.activities.map((a) => ({
    id: a.id,
    lat: a.lat,
    lng: a.lng,
    time_slot: a.time_slot ?? null,
    start_time: a.start_time,
  }));
  const points = locatedPoints(stops);
  const mode = chooseTravelMode(points);
  const plan = planDayRoute(stops, estimateMatrix(points, mode));
  if (apply && plan.changed) {
    updateLocalTrip(tripId, (current) => ({
      ...current,
      itinerary_days: current.itinerary_days.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              activities: plan.order.map((id, index) => {
                const activity = d.activities.find((a) => a.id === id);
                return {
                  ...activity,
                  sort_order: index,
                  start_time: plan.start_times[id] ?? activity.start_time,
                };
              }),
            },
      ),
    }));
  }
  return {
    itinerary_day_id: dayId,
    ...plan,
    travel_mode: mode,
    source: "estimate",
    applied: apply && plan.changed,
  };
}

// ---- Expenses ----------------------------------------------------------------

export async function addExpense(tripId, input) {
  if (supabase) {
    const result = await request(`trips/${tripId}/expenses`, { body: input });
    return result.expense;
  }
  const expense = {
    id: crypto.randomUUID(),
    trip_id: tripId,
    activity_id: null,
    quantity: 1,
    notes: null,
    ...input,
    source: "user",
    is_estimate: false,
  };
  updateLocalTrip(tripId, (trip) => {
    const existing = trip.expenses ?? [];
    const duplicate = existing.some(
      (item) =>
        item.category === input.category &&
        item.title.trim().toLowerCase() === input.title.trim().toLowerCase(),
    );
    if (duplicate) {
      throw new ApiRequestError(
        "An expense with this title already exists in that category.",
        409,
        "DUPLICATE_EXPENSE",
      );
    }
    return { ...trip, expenses: [...existing, expense] };
  });
  return expense;
}

export async function updateExpense(tripId, expenseId, patch) {
  if (supabase) {
    await request(`trips/${tripId}/expenses/${expenseId}`, {
      method: "PATCH",
      body: patch,
    });
    return;
  }
  updateLocalTrip(tripId, (trip) => ({
    ...trip,
    expenses: (trip.expenses ?? []).map((item) =>
      item.id === expenseId ? { ...item, ...patch } : item,
    ),
  }));
}

export async function deleteExpense(tripId, expenseId) {
  if (supabase) {
    await request(`trips/${tripId}/expenses/${expenseId}`, {
      method: "DELETE",
    });
    return;
  }
  updateLocalTrip(tripId, (trip) => ({
    ...trip,
    expenses: (trip.expenses ?? []).filter((item) => item.id !== expenseId),
  }));
}

// ---- AI assistant ------------------------------------------------------------

/** Whether the AI trip assistant can run (it needs the server; demo mode has no LLM). */
export const assistantAvailable = Boolean(supabase);

/**
 * Sends the conversation to the trip assistant, which edits the trip with tools
 * on the server. Returns its reply and the updated trip.
 */
export async function askTripAssistant(tripId, messages) {
  if (!supabase) {
    throw new ApiRequestError(
      "The AI assistant needs a Supabase connection. It is not available in demo mode.",
      0,
      "DEMO_MODE",
    );
  }
  return request("trip-assistant", { body: { trip_id: tripId, messages } });
}
