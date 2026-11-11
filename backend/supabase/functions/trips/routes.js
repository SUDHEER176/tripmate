// Path routing for the `trips` Edge Function. Pure so it can be unit tested.
//
//   GET    /trips                               list the caller's trips
//   POST   /trips                               create a trip manually (no AI)
//   GET    /trips/:id                           trip + itinerary + expenses + budget
//   PATCH  /trips/:id                           update trip details
//   DELETE /trips/:id                           delete trip and everything under it
//   GET    /trips/:id/budget                    budget summary only
//   POST   /trips/:id/activities                add an activity
//   POST   /trips/:id/activities/reorder        reorder a day's activities
//   PATCH  /trips/:id/activities/:activityId    update / move an activity
//   DELETE /trips/:id/activities/:activityId    delete an activity
//   POST   /trips/:id/expenses                  add an expense
//   PATCH  /trips/:id/expenses/:expenseId       update an expense
//   DELETE /trips/:id/expenses/:expenseId       delete an expense
//   POST   /trips/:id/optimize-route            reorder a day's stops for the least travel time

import { ApiError } from "../_shared/http.js";
import { isUuid } from "../_shared/validation.js";

function pick(method, options) {
  const route = options[method];
  if (!route) {
    const allowed = Object.keys(options).join(", ");
    throw new ApiError(
      405,
      "METHOD_NOT_ALLOWED",
      `Use ${allowed} for this path.`,
      undefined,
      { Allow: allowed },
    );
  }
  return route;
}

function requireId(value, label) {
  if (!isUuid(value))
    throw new ApiError(400, "INVALID_ID", `The ${label} id is not valid.`);
  return value.toLowerCase();
}

export function matchRoute(method, pathname) {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const base = segments.lastIndexOf("trips");
  if (base === -1)
    throw new ApiError(404, "ROUTE_NOT_FOUND", "Unknown endpoint.");
  const [tripSeg, resource, childSeg, ...rest] = segments.slice(base + 1);

  if (rest.length)
    throw new ApiError(404, "ROUTE_NOT_FOUND", "Unknown endpoint.");

  if (tripSeg === undefined) {
    return pick(method, {
      GET: { name: "listTrips" },
      POST: { name: "createTrip" },
    });
  }
  const tripId = requireId(tripSeg, "trip");

  if (resource === undefined) {
    return pick(method, {
      GET: { name: "getTrip", tripId },
      PATCH: { name: "updateTrip", tripId },
      DELETE: { name: "deleteTrip", tripId },
    });
  }

  if (resource === "budget" && childSeg === undefined) {
    return pick(method, { GET: { name: "getBudget", tripId } });
  }

  if (resource === "optimize-route" && childSeg === undefined) {
    return pick(method, { POST: { name: "optimizeRoute", tripId } });
  }

  if (resource === "activities") {
    if (childSeg === undefined)
      return pick(method, { POST: { name: "createActivity", tripId } });
    if (childSeg === "reorder")
      return pick(method, { POST: { name: "reorderActivities", tripId } });
    const activityId = requireId(childSeg, "activity");
    return pick(method, {
      PATCH: { name: "updateActivity", tripId, activityId },
      DELETE: { name: "deleteActivity", tripId, activityId },
    });
  }

  if (resource === "expenses") {
    if (childSeg === undefined)
      return pick(method, { POST: { name: "createExpense", tripId } });
    const expenseId = requireId(childSeg, "expense");
    return pick(method, {
      PATCH: { name: "updateExpense", tripId, expenseId },
      DELETE: { name: "deleteExpense", tripId, expenseId },
    });
  }

  throw new ApiError(404, "ROUTE_NOT_FOUND", "Unknown endpoint.");
}
