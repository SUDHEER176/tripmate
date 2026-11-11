// Wraps an Edge Function with CORS, a request id, method checks and uniform
// error responses.

import { ApiError, buildCorsHeaders, errorResponse } from "./http.js";

export function serveJson(allowedMethods, handle) {
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  Deno.serve(async (req) => {
    const cors = buildCorsHeaders(req.headers.get("origin"), allowedOrigins);
    const requestId = crypto.randomUUID();

    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });

    try {
      if (!allowedMethods.includes(req.method)) {
        throw new ApiError(
          405,
          "METHOD_NOT_ALLOWED",
          `Use ${allowedMethods.join(" or ")}.`,
          undefined,
          {
            Allow: allowedMethods.join(", "),
          },
        );
      }
      const response = await handle(req, { cors, requestId });
      for (const [key, value] of Object.entries(cors))
        response.headers.set(key, value);
      return response;
    } catch (err) {
      return errorResponse(err, cors, requestId);
    }
  });
}
