// Supabase Edge Function: generate-itinerary
//
// POST /functions/v1/generate-itinerary
//   New trip:    { destination, start_date, end_date, travelers, budget, travel_style?, interests?, pace?, preferences? }
//   Regenerate:  { trip_id, confirm_regenerate: true, ...optional field overrides }
//
// Flow: verify JWT → validate input → rate limit → call LLM → validate output
// → save trip, days, activities and expenses in one transaction → return the saved trip.
// An invalid or incomplete AI response is never saved.

import { serveJson } from "../_shared/handler.ts";
import { ApiError, logError, mapDbError, ok, readJsonBody } from "../_shared/http.ts";
import { buildItineraryPrompt, llmConfigFromEnv, requestItineraryJson, type LlmConfig } from "../_shared/llm.ts";
import { enforceRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { authenticate } from "../_shared/supabase.ts";
import { ESTIMATE_DISCLAIMER, getOwnedTrip, getTripDetails, type TripRow } from "../_shared/trips-repo.ts";
import {
  AiOutputError,
  parseGenerateRequest,
  parseTripInput,
  validateAiItinerary,
  type NormalizedItinerary,
  type TripInput,
} from "../_shared/validation.ts";

const MAX_ATTEMPTS = 2;
// Leaves headroom under the Edge Function wall-clock limit (150 s on the free plan).
const TOTAL_AI_BUDGET_MS = 140_000;

async function generateItinerary(config: LlmConfig, input: TripInput, requestId: string): Promise<NormalizedItinerary> {
  const prompt = buildItineraryPrompt(input);
  const deadline = Date.now() + TOTAL_AI_BUDGET_MS;
  let lastError: AiOutputError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (attempt > 1 && remaining < 20_000) break;
    try {
      const raw = await requestItineraryJson({ ...config, timeoutMs: Math.min(config.timeoutMs, remaining) }, prompt);
      return validateAiItinerary(raw, input);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503 && attempt < MAX_ATTEMPTS) {
        logError(requestId, "AI_BUSY_RETRY", `attempt ${attempt} busy, retrying in 2.5s...`);
        await new Promise((resolve) => setTimeout(resolve, 2500));
        continue;
      }
      if (!(err instanceof AiOutputError)) throw err;
      lastError = err;
      logError(requestId, "AI_INVALID_OUTPUT", `attempt ${attempt}: ${err.problems.length} problem(s)`);
    }
  }
  throw lastError ?? new AiOutputError(["no valid response"]);
}

serveJson(["POST"], async (req, { requestId }) => {
  const { db, user } = await authenticate(req);
  const request = parseGenerateRequest(await readJsonBody(req));

  let existing: TripRow | null = null;
  let input: TripInput;
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

  const { data: tripId, error } = await db.rpc("save_generated_trip", {
    p_trip: {
      title: itinerary.title,
      destination: input.destination,
      destination_lat: itinerary.destination_lat,
      destination_lng: itinerary.destination_lng,
      start_date: input.start_date,
      end_date: input.end_date,
      budget: input.budget,
      travelers: input.travelers,
      interests: input.interests,
      pace: input.pace,
      travel_style: input.travel_style,
      notes: input.preferences,
      travel_notes: itinerary.travel_notes,
      ai_model: config.model,
    },
    p_days: itinerary.days,
    p_activities: itinerary.activities,
    p_expenses: itinerary.expenses,
    p_trip_id: existing?.id ?? null,
  });
  if (error || typeof tripId !== "string") throw mapDbError(error ?? {}, "Saving the itinerary");

  const trip = await getOwnedTrip(db, user.id, tripId);
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
