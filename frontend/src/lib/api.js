import { generateLocalPlan } from "./itinerary";
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase";
import { activityExpenseCategory, calculateBudget } from "./budget";
import { basePackingList, parsePackingList } from "./packing";
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

// ---- Firebase auth helpers --------------------------------------------------

const PROVIDERS = {
  google: () => new GoogleAuthProvider(),
  github: () => new GithubAuthProvider(),
  apple: () => new OAuthProvider("apple.com"),
};

const AUTH_MESSAGES = {
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/invalid-credential": "Invalid email or password.",
  "auth/wrong-password": "Invalid email or password.",
  "auth/user-not-found": "Invalid email or password.",
  "auth/weak-password": "Choose a password with at least 6 characters.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/popup-closed-by-user": "The sign-in window was closed before finishing.",
  "auth/account-exists-with-different-credential":
    "This email is already registered with another sign-in method.",
  "auth/operation-not-allowed": "This sign-in method is not enabled for this app.",
};

function authError(error, fallback) {
  return new Error(AUTH_MESSAGES[error?.code] || error?.message || fallback);
}

/** Calls the backend's 6-digit email code endpoints (no sign-in needed). */
async function codeRequest(action, body) {
  let response;
  try {
    response = await fetch(`/api/auth-codes/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw await toApiError(null);
  }
  if (!response.ok) throw await toApiError(response);
  return (await response.json()).data;
}

export function toAppUser(user) {
  return {
    id: user.uid,
    email: user.email ?? "",
    fullName: user.displayName || user.email || "Traveler",
  };
}

/** A password account counts as signed in only after its email is verified. */
function isUsable(user) {
  if (!user) return false;
  const passwordOnly = user.providerData.every((p) => p.providerId === "password");
  return user.emailVerified || !passwordOnly;
}

// ---- Auth ---------------------------------------------------------------------

export async function signUp(email, password, fullName) {
  if (auth) {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      if (fullName) await updateProfile(user, { displayName: fullName });
    } catch (error) {
      throw authError(error, "Could not create your account.");
    }
    // No session until the emailed 6-digit code is entered (verifyOtp "signup").
    await firebaseSignOut(auth);
    await codeRequest("send", { email, purpose: "verify" });
    return { user: null };
  }
  const user = { id: crypto.randomUUID(), email, fullName };
  setDemoUser(user);
  return { user };
}

export async function signIn(email, password) {
  if (auth) {
    let user;
    try {
      ({ user } = await signInWithEmailAndPassword(auth, email, password));
    } catch (error) {
      throw authError(error, "Invalid email or password.");
    }
    if (!isUsable(user)) {
      await firebaseSignOut(auth);
      await codeRequest("send", { email, purpose: "verify" }).catch(() => {});
      const err = new Error(
        "Please verify your email first. We've sent you a new 6-digit code.",
      );
      err.code = "EMAIL_NOT_VERIFIED";
      throw err;
    }
    return { user: toAppUser(user) };
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
  if (auth) {
    const makeProvider = PROVIDERS[provider];
    if (!makeProvider) throw new Error(`Sign-in with ${provider} is not supported.`);
    try {
      const { user } = await signInWithPopup(auth, makeProvider());
      return { user: toAppUser(user) };
    } catch (error) {
      throw authError(error, `Could not sign in with ${provider}.`);
    }
  }
  const user = {
    id: crypto.randomUUID(),
    email: `${provider.toLowerCase()}@tripmate.ai`,
    fullName: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Traveler`,
  };
  setDemoUser(user);
  return { user };
}

/**
 * Emails a 6-digit code. `mode` "email" is a passwordless sign-in code;
 * "signup" re-sends the code that verifies a new account's email.
 */
export async function sendOtp(email, _fullName, mode = "email") {
  if (auth) {
    return codeRequest("send", {
      email,
      purpose: mode === "signup" ? "verify" : "sign-in",
    });
  }
  return { success: true };
}

export async function verifyOtp(email, token, type = "signup", fullName) {
  if (auth) {
    const { token: customToken } = await codeRequest("verify", {
      email,
      code: token.trim(),
      purpose: type === "signup" ? "verify" : "sign-in",
      name: fullName,
    });
    try {
      const { user } = await signInWithCustomToken(auth, customToken);
      // Picks up email_verified in the ID token sent to the API.
      await user.getIdToken(true);
      return { user: toAppUser(user) };
    } catch (error) {
      throw authError(error, "Invalid or expired verification code.");
    }
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
  if (auth) {
    await firebaseSignOut(auth);
    return;
  }
  setDemoUser(null);
}

export async function fetchSession() {
  if (auth) {
    await auth.authStateReady();
    return isUsable(auth.currentUser) ? toAppUser(auth.currentUser) : null;
  }
  return getDemoUser();
}

/** Calls back on every sign-in / sign-out. Returns an unsubscribe function. */
export function onSessionChange(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, (user) =>
    callback(isUsable(user) ? toAppUser(user) : null),
  );
}

// =============================================================================
// Trips — with Firebase configured, these call the `trips`, `generate-itinerary`
// and `trip-assistant` APIs at /api with the user's Firebase ID token (the server
// identifies the user from it; no user id is sent). In demo mode the same operations run against
// localStorage.
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

async function toApiError(response) {
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
  const method =
    options.method ?? (options.body === undefined ? "GET" : "POST");
  let response;
  try {
    const token = await auth.currentUser?.getIdToken();
    response = await fetch(`/api/${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw await toApiError(null);
  }
  if (!response.ok) throw await toApiError(response);
  return (await response.json()).data;
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
  if (auth) return request("trips");
  return readTrips()
    .filter((trip) => trip.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getTrip(id) {
  if (auth) {
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
  if (auth) {
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
  if (auth) {
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
  if (auth)
    return request(`trips/${tripId}`, { method: "PATCH", body: patch });
  return updateLocalTrip(tripId, (trip) => ({ ...trip, ...patch }));
}

export async function deleteTrip(id) {
  if (auth) {
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
  if (auth) {
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
  if (auth) {
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
  if (auth) {
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
  if (auth) {
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
  if (auth) {
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
  if (auth) {
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
  if (auth) {
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
  if (auth) {
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

// ---- Share link ----------------------------------------------------------------

/** Whether trips can be shared publicly (needs the server; demo trips live in this browser only). */
export const sharingAvailable = Boolean(auth);

export function shareUrl(shareId) {
  return `${window.location.origin}/shared/${shareId}`;
}

/** Turns on the public read-only link and returns its share id. */
export async function shareTrip(tripId) {
  if (!auth) {
    throw new ApiRequestError(
      "Sharing needs an account. Demo trips are stored only in this browser.",
      0,
      "DEMO_MODE",
    );
  }
  const result = await request(`trips/${tripId}/share`, { body: {} });
  return result.share_id;
}

/** Turns the link off; anyone who has it will see "link turned off". */
export async function unshareTrip(tripId) {
  if (!auth) return;
  await request(`trips/${tripId}/share`, { method: "DELETE" });
}

/** Loads a shared trip by its link (no sign-in). Returns null if the link is off. */
export async function getSharedTrip(shareId) {
  let response;
  try {
    response = await fetch(`/api/shared/${encodeURIComponent(shareId)}`);
  } catch {
    throw await toApiError(null);
  }
  if (response.status === 404) return null;
  if (!response.ok) throw await toApiError(response);
  return (await response.json()).data;
}

// ---- Packing list --------------------------------------------------------------

/** Saves the whole packing list (after a tick, add or delete). Returns the saved list. */
export async function savePackingList(tripId, items) {
  if (auth) {
    const result = await request(`trips/${tripId}/packing-list`, {
      method: "PATCH",
      body: { items },
    });
    return result.packing_list;
  }
  const clean = parsePackingList({ items });
  updateLocalTrip(tripId, (trip) => ({ ...trip, packing_list: clean }));
  return clean;
}

/**
 * Builds a new packing list (AI on the server, rules in demo mode) and saves it,
 * replacing the current one. `weather` is an optional { min_temp, max_temp, rainy_days }.
 */
export async function generatePackingList(tripId, weather) {
  if (auth) {
    const result = await request(`trips/${tripId}/packing-list/generate`, {
      body: { weather: weather ?? null },
    });
    return result.packing_list;
  }
  const trip = readTrips().find((item) => item.id === tripId);
  if (!trip) throw new ApiRequestError("Trip not found.", 404, "TRIP_NOT_FOUND");
  const items = basePackingList(trip, weather);
  updateLocalTrip(tripId, (current) => ({ ...current, packing_list: items }));
  return items;
}

// ---- AI assistant ------------------------------------------------------------

/** Whether the AI trip assistant can run (it needs the server; demo mode has no LLM). */
export const assistantAvailable = Boolean(auth);

/**
 * Sends the conversation to the trip assistant, which edits the trip with tools
 * on the server. Returns its reply and the updated trip.
 */
export async function askTripAssistant(tripId, messages) {
  if (!auth) {
    throw new ApiRequestError(
      "The AI assistant needs the backend. It is not available in demo mode.",
      0,
      "DEMO_MODE",
    );
  }
  return request("trip-assistant", { body: { trip_id: tripId, messages } });
}
