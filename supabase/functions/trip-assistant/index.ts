// Supabase Edge Function: trip-assistant
//
// POST /functions/v1/trip-assistant
//   { trip_id, messages: [{ role: "user" | "assistant", content }] }   (last message from the user)
//
// Flow: verify JWT → validate input → load the caller's trip → rate limit →
// run the tool-calling agent (each tool is an ownership-checked trip action)
// → return the reply, the actions taken and the updated trip.
// The conversation is not stored; the client sends recent history each time.

import { serveJson } from "../_shared/handler.ts";
import { logError, ok, readJsonBody } from "../_shared/http.ts";
import { llmConfigFromEnv } from "../_shared/llm.ts";
import { enforceRateLimit, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { authenticate } from "../_shared/supabase.ts";
import { routesApiKeyFromEnv, travelMatrix } from "../_shared/travel-matrix.ts";
import { getOwnedTrip, getTripDetails } from "../_shared/trips-repo.ts";
import { utcToday } from "../_shared/validation.ts";
import {
  buildAssistantSystemPrompt,
  buildTripSnapshot,
  createTripState,
  createTripToolExecutor,
  parseAssistantRequest,
  runAgent,
  type TripSnapshotSource,
} from "../_shared/assistant.ts";

// Per model call; several calls fit under the Edge Function wall-clock limit.
const MODEL_CALL_TIMEOUT_MS = 40_000;
const MODEL_MAX_TOKENS = 1500;

serveJson(["POST"], async (req, { requestId }) => {
  const { db, user } = await authenticate(req);
  const request = parseAssistantRequest(await readJsonBody(req));
  const trip = await getOwnedTrip(db, user.id, request.trip_id);

  const config = llmConfigFromEnv();
  await enforceRateLimit(db, RATE_LIMITS.assistantPerHour);
  await enforceRateLimit(db, RATE_LIMITS.writes);

  const details = (await getTripDetails(db, trip)) as unknown as TripSnapshotSource;
  const state = createTripState(details);

  const result = await runAgent({
    config: { ...config, timeoutMs: Math.min(config.timeoutMs, MODEL_CALL_TIMEOUT_MS), maxTokens: MODEL_MAX_TOKENS },
    system: buildAssistantSystemPrompt(buildTripSnapshot(details, state), utcToday()),
    history: request.messages,
    execute: createTripToolExecutor({ db, userId: user.id }, trip.id, state, (points, mode) =>
      travelMatrix(points, mode, routesApiKeyFromEnv()),
    ),
  });
  if (result.incomplete) logError(requestId, "ASSISTANT_INCOMPLETE", `${result.actions.length} action(s)`);

  const changed = result.actions.some((action) => action.ok);
  const updated = changed ? await getTripDetails(db, await getOwnedTrip(db, user.id, trip.id)) : details;

  return ok({ reply: result.reply, actions: result.actions, incomplete: result.incomplete, trip: updated });
});
