// API: generate-itinerary
//
// POST /api/generate-itinerary
//   New trip:    { destination, start_date, end_date, travelers, budget, travel_style?, interests?, pace?, preferences? }
//   Regenerate:  { trip_id, confirm_regenerate: true, ...optional field overrides }
//
// Flow: verify session → validate input → rate limit → call LLM → validate output
// → save trip, days, activities and expenses in one transaction → return the saved trip.
// An invalid or incomplete AI response is never saved.

import { serveJson } from "../_shared/handler.js";
import {
  ApiError,
  logError,
  ok,
  readJsonBody,
} from "../_shared/http.js";
import {
  buildItineraryPrompt,
  llmConfigFromEnv,
  requestItineraryJson,
} from "../_shared/llm.js";
import { enforceRateLimit, RATE_LIMITS } from "../_shared/rate-limit.js";
import { authenticate } from "../_shared/auth.js";
import {
  ESTIMATE_DISCLAIMER,
  getOwnedTrip,
  getTripDetails,
  hasDuplicateExpense,
  insertTrip,
  mutateTrip,
  newId,
  nowIso,
  pick,
  syncActivityExpense,
  ACTIVITY_FIELDS,
  DAY_FIELDS,
  EXPENSE_FIELDS,
} from "../_shared/trips-repo.js";
import {
  AiOutputError,
  parseGenerateRequest,
  parseTripInput,
  validateAiItinerary,
} from "../_shared/validation.js";

const MAX_ATTEMPTS = 2;

/**
 * Writes a validated AI itinerary into a trip (new, or regenerated in place).
 * Regeneration replaces the days, activities, their linked expenses and earlier
 * AI expenses; expenses the user added are kept, and an AI expense with the same
 * category and title as one of them is skipped.
 */
function applyItinerary(trip, fields, itinerary) {
  const now = nowIso();
  Object.assign(trip, fields, {
    status: "planned",
    generated_at: now,
    generation_count: (trip.generation_count ?? 0) + 1,
  });
  trip.expenses = (trip.expenses ?? []).filter((e) => e.source === "user");

  trip.itinerary_days = itinerary.days.map((day) => ({
    ...pick(day, DAY_FIELDS),
    trip_id: trip.id,
    created_at: now,
    updated_at: now,
    activities: [],
  }));
  const daysById = new Map(trip.itinerary_days.map((day) => [day.id, day]));
  for (const raw of itinerary.activities) {
    const day = daysById.get(raw.itinerary_day_id);
    if (!day) throw new AiOutputError(["an activity references a day outside this trip"]);
    const activity = {
      ...pick(raw, ACTIVITY_FIELDS),
      cost_basis: raw.cost_basis ?? "per_person",
      cost_is_estimate: true,
      created_at: now,
      updated_at: now,
    };
    day.activities.push(activity);
    syncActivityExpense(trip, activity);
  }
  for (const raw of itinerary.expenses) {
    if (hasDuplicateExpense(trip, raw.category, raw.title)) continue;
    trip.expenses.push({
      ...pick(raw, EXPENSE_FIELDS),
      id: newId(),
      trip_id: trip.id,
      activity_id: null,
      currency: "INR",
      quantity: raw.quantity ?? 1,
      cost_basis: raw.cost_basis ?? "total",
      source: "ai",
      is_estimate: true,
      created_at: now,
      updated_at: now,
    });
  }
  return trip;
}
// Upper bound for the whole AI step, so a slow provider cannot hold a request forever.
const TOTAL_AI_BUDGET_MS = 140_000;

async function generateItinerary(config, input, requestId) {
  const prompt = buildItineraryPrompt(input);
  const deadline = Date.now() + TOTAL_AI_BUDGET_MS;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (attempt > 1 && remaining < 20_000) break;
    try {
      const raw = await requestItineraryJson(
        { ...config, timeoutMs: Math.min(config.timeoutMs, remaining) },
        prompt,
      );
      return validateAiItinerary(raw, input);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 503 &&
        attempt < MAX_ATTEMPTS
      ) {
        logError(
          requestId,
          "AI_BUSY_RETRY",
          `attempt ${attempt} busy, retrying in 2.5s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2500));
        continue;
      }
      if (!(err instanceof AiOutputError)) throw err;
      lastError = err;
      logError(
        requestId,
        "AI_INVALID_OUTPUT",
        `attempt ${attempt}: ${err.problems.length} problem(s)`,
      );
    }
  }
  throw lastError ?? new AiOutputError(["no valid response"]);
}

export default serveJson(["POST"], async (req, { requestId }) => {
  const { db, user } = await authenticate(req);
  const request = parseGenerateRequest(await readJsonBody(req));

  let existing = null;
  let input;
  if (request.trip_id) {
    existing = await getOwnedTrip(db, user.id, request.trip_id);
    if (!request.confirm_regenerate) {
      throw new ApiError(
        409,
        "CONFIRMATION_REQUIRED",
        "Regenerating replaces this trip's itinerary, activities and AI-estimated expenses. " +
          "Expenses you added yourself are kept. Send confirm_regenerate: true to continue.",
      );
    }
    input = parseTripInput(
      {
        destination: existing.destination,
        start_date: existing.start_date,
        end_date: existing.end_date,
        travelers: existing.travelers,
        budget: existing.budget,
        travel_style: existing.travel_style,
        interests: existing.interests,
        pace: existing.pace,
        preferences: existing.notes,
        ...request.fields,
      },
      { allowPastStart: true },
    );
  } else {
    input = parseTripInput(request.fields);
  }

  const config = llmConfigFromEnv();
  await enforceRateLimit(db, RATE_LIMITS.aiPerDay);
  await enforceRateLimit(db, RATE_LIMITS.aiPerHour);

  const itinerary = await generateItinerary(config, input, requestId);

  const tripFields = {
      title: itinerary.title,
      destination: input.destination,
      destination_lat: itinerary.destination_lat,
      destination_lng: itinerary.destination_lng,
      start_date: input.start_date,
      end_date: input.end_date,
      budget: input.budget,
      travelers: input.travelers,
      interests: input.interests ?? [],
      pace: input.pace,
      travel_style: input.travel_style,
      notes: input.preferences,
      travel_notes: itinerary.travel_notes,
      ai_model: config.model,
  };
  const trip = existing
    ? (await mutateTrip(db, existing.id, (trip) => applyItinerary(trip, tripFields, itinerary),
        "Saving the itinerary")).trip
    : await insertTrip(
        applyItinerary(
          {
            id: newId(),
            user_id: user.id,
            currency: "INR",
            total_estimated_cost: 0,
            generation_count: 0,
            created_at: nowIso(),
            expenses: [],
          },
          tripFields,
          itinerary,
        ),
      );
  const tripId = trip.id;
  const details = await getTripDetails(db, trip);

  return ok(
    {
      trip_id: tripId,
      regenerated: Boolean(existing),
      trip: details,
      budget_summary: details.budget_summary,
      warnings: itinerary.warnings,
      disclaimer: ESTIMATE_DISCLAIMER,
    },
    existing ? 200 : 201,
  );
});
