// Local backend server: runs the same three Edge Functions that are deployed to
// Supabase, but with Node, so `npm start` works without Docker.
//
//   POST /functions/v1/generate-itinerary
//   POST /functions/v1/trip-assistant
//   *    /functions/v1/trips/...
//
// The functions are written for Deno (Supabase's runtime). This file adds the
// two Deno APIs they use (Deno.env.get and Deno.serve), and node/npm-specifier-loader.js
// lets Node load their `npm:` imports. The database and auth stay on your
// Supabase project, configured in backend/.env.

import { createServer } from "node:http";
import { register } from "node:module";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

register("./node/npm-specifier-loader.js", import.meta.url);

try {
  process.loadEnvFile(fileURLToPath(new URL("./.env", import.meta.url)));
} catch {
  console.warn("No backend/.env found. Copy .env.example to .env and fill it in.");
}

const FUNCTIONS = ["generate-itinerary", "trip-assistant", "trips"];
const PORT = Number(process.env.PORT) || 8000;

// Minimal Deno shim: each function calls Deno.serve(handler) when imported.
const handlers = new Map();
let loading = null;
globalThis.Deno = {
  env: { get: (name) => process.env[name] },
  serve(handler) {
    handlers.set(loading, typeof handler === "function" ? handler : handler.handler);
  },
};

for (const name of FUNCTIONS) {
  loading = name;
  await import(`./supabase/functions/${name}/index.js`);
}

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/" || url.pathname === "/health") {
    return json(res, 200, { status: "ok", functions: FUNCTIONS });
  }

  // Accept both /functions/v1/<name>/... (same as Supabase) and /<name>/...
  const segments = url.pathname.split("/").filter(Boolean);
  const name = segments[0] === "functions" && segments[1] === "v1" ? segments[2] : segments[0];
  const handler = handlers.get(name);
  if (!handler) {
    return json(res, 404, { error: { code: "ROUTE_NOT_FOUND", message: "Unknown endpoint." } });
  }

  try {
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const request = new Request(url, {
      method: req.method,
      headers: Object.entries(req.headers).flatMap(([key, value]) =>
        Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]],
      ),
      body: hasBody ? Readable.toWeb(req) : undefined,
      duplex: hasBody ? "half" : undefined,
    });

    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    console.error(err);
    json(res, 500, { error: { code: "INTERNAL", message: "Unexpected server error." } });
  }
});

server.listen(PORT, () => {
  console.log(`TripMate backend running on http://localhost:${PORT}`);
  for (const name of FUNCTIONS) console.log(`  http://localhost:${PORT}/functions/v1/${name}`);
});
