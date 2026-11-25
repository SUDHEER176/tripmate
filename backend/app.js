// Routes Node HTTP requests to the API handlers. Used by server.js (local / any
// Node host) and by index.js (Firebase Cloud Functions).
//
//   POST /api/auth-codes/send | /verify   6-digit email codes
//   POST /api/generate-itinerary
//   POST /api/trip-assistant
//   *    /api/trips/...
//   GET  /api/shared/:shareId            public read-only trip (no sign-in)
//   GET  /health

import { Readable } from "node:stream";
import authCodes from "./functions/auth-codes/index.js";
import generateItinerary from "./functions/generate-itinerary/index.js";
import tripAssistant from "./functions/trip-assistant/index.js";
import trips from "./functions/trips/index.js";
import shared from "./functions/shared/index.js";

const handlers = new Map([
  ["auth-codes", authCodes],
  ["generate-itinerary", generateItinerary],
  ["trip-assistant", tripAssistant],
  ["trips", trips],
  ["shared", shared],
]);

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function toWebRequest(req, url) {
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const headers = Object.entries(req.headers).flatMap(([key, value]) =>
    Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]],
  );
  // Cloud Functions has already read the body into req.rawBody.
  if (hasBody && req.rawBody !== undefined) {
    return new Request(url, { method: req.method, headers, body: req.rawBody });
  }
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

export async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/" || url.pathname === "/health") {
    return json(res, 200, { status: "ok" });
  }

  const [prefix, name] = url.pathname.split("/").filter(Boolean);
  const handler = prefix === "api" ? handlers.get(name) : undefined;
  if (!handler) {
    return json(res, 404, { error: { code: "ROUTE_NOT_FOUND", message: "Unknown endpoint." } });
  }

  try {
    const response = await handler(toWebRequest(req, url));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error(err);
    json(res, 500, { error: { code: "INTERNAL", message: "Unexpected server error." } });
  }
}
