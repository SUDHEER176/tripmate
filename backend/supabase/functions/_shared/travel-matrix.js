// Travel times between a day's stops from the Google Routes API
// (computeRouteMatrix), falling back to a straight-line estimate when no key is
// configured or the API fails. The key is a server secret, separate from the
// browser Maps key, and is never sent to the client.

import { estimateMatrix } from "./route-optimizer.js";

const ROUTES_URL =
  "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
const TIMEOUT_MS = 10_000;
/** computeRouteMatrix allows 625 elements (25 × 25) without traffic-aware routing. */
const MAX_POINTS = 25;

function waypoint(point) {
  return {
    waypoint: {
      location: { latLng: { latitude: point.lat, longitude: point.lng } },
    },
  };
}

/** Calls computeRouteMatrix. Pairs without a route keep their estimated cost. */
export async function googleRouteMatrix(
  apiKey,
  points,
  mode,
  fetchImpl = fetch,
) {
  if (points.length > MAX_POINTS)
    throw new Error("too many points for one route matrix");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(ROUTES_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "originIndex,destinationIndex,duration,distanceMeters,condition",
      },
      body: JSON.stringify({
        origins: points.map(waypoint),
        destinations: points.map(waypoint),
        travelMode: mode,
        ...(mode === "DRIVE" ? { routingPreference: "TRAFFIC_UNAWARE" } : {}),
      }),
    });
    if (!response.ok) throw new Error(`Routes API HTTP ${response.status}`);
    const elements = await response.json();
    if (!Array.isArray(elements))
      throw new Error("Routes API returned no elements");

    const matrix = estimateMatrix(points, mode);
    let found = 0;
    for (const el of elements) {
      const i = el.originIndex ?? 0; // proto3 JSON omits zero values
      const j = el.destinationIndex ?? 0;
      if (
        i === j ||
        el.condition !== "ROUTE_EXISTS" ||
        !matrix.seconds[i] ||
        j >= points.length
      )
        continue;
      const seconds = Number.parseInt(el.duration ?? "", 10);
      if (!Number.isFinite(seconds)) continue;
      matrix.seconds[i][j] = seconds;
      matrix.meters[i][j] = el.distanceMeters ?? 0;
      found += 1;
    }
    if (!found) throw new Error("Routes API found no routes");
    return { ...matrix, source: "google" };
  } finally {
    clearTimeout(timer);
  }
}

/** Google travel times when possible, otherwise the estimate. Never throws for API problems. */
export async function travelMatrix(points, mode, apiKey, fetchImpl = fetch) {
  if (!apiKey || points.length < 2 || points.length > MAX_POINTS)
    return estimateMatrix(points, mode);
  try {
    return await googleRouteMatrix(apiKey, points, mode, fetchImpl);
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: "warn",
        code: "ROUTES_API_FALLBACK",
        message: String(err).slice(0, 200),
      }),
    );
    return estimateMatrix(points, mode);
  }
}

/** Reads the server-side Routes API key. Call per request, never at import time. */
export function routesApiKeyFromEnv() {
  return Deno.env.get("GOOGLE_ROUTES_API_KEY")?.trim() || undefined;
}
