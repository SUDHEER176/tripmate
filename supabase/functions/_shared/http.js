// HTTP helpers shared by all Edge Functions. Uses only web-standard APIs.
//
// Every response uses one envelope:
//   success: { "data": ... }
//   failure: { "error": { "code": "SNAKE_CASE", "message": "...", "details"?: ... } }

export const MAX_BODY_BYTES = 32 * 1024;

export class ApiError extends Error {
  status;
  code;
  details;
  headers;

  constructor(status, code, message, details, headers) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }
}

/** Input that failed server-side validation. `fields` maps field path → problem. */
export class ValidationError extends ApiError {
  constructor(fields, message = "Some fields are invalid.") {
    super(422, "VALIDATION_FAILED", message, { fields });
    this.name = "ValidationError";
  }
}

export function buildCorsHeaders(origin, allowedOrigins) {
  const allowAll = allowedOrigins.length === 0 || allowedOrigins.includes("*");
  const allowOrigin = allowAll
    ? "*"
    : origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function ok(data, status = 200, headers = {}) {
  return jsonResponse({ data }, status, headers);
}

/** Translates a PostgREST / Postgres error into a safe ApiError (no SQL details leak). */
export function mapDbError(error, context = "Database operation") {
  switch (error.code) {
    case "PGRST116":
    case "P0002":
      return new ApiError(
        404,
        "NOT_FOUND",
        "The requested resource was not found.",
      );
    case "23505":
      return new ApiError(
        409,
        "DUPLICATE",
        "A matching record already exists.",
      );
    case "23503":
      return new ApiError(
        409,
        "CONFLICT",
        "A related record no longer exists.",
      );
    case "23514":
    case "23502":
    case "22023":
    case "22P02":
    case "22007":
    case "22008":
      return new ApiError(
        422,
        "CONSTRAINT_VIOLATION",
        "The data was rejected by validation rules.",
      );
    case "42501":
      // RLS rejection: report as not found so other users' resources are not revealed.
      return new ApiError(
        404,
        "NOT_FOUND",
        "The requested resource was not found.",
      );
    case "28000":
    case "PGRST301":
      return new ApiError(
        401,
        "AUTH_INVALID",
        "Your session is invalid or has expired. Please sign in again.",
      );
    default:
      return new ApiError(
        500,
        "DATABASE_ERROR",
        `${context} failed. Please try again.`,
      );
  }
}

export function errorResponse(err, cors, requestId) {
  if (err instanceof ApiError) {
    if (err.status >= 500) logError(requestId, err.code, err.message);
    const body = {
      error: { code: err.code, message: err.message, request_id: requestId },
    };
    if (err.details !== undefined) body.error.details = err.details;
    return jsonResponse(body, err.status, { ...cors, ...(err.headers ?? {}) });
  }
  logError(
    requestId,
    "UNHANDLED",
    err instanceof Error ? `${err.name}: ${err.message}` : "non-error thrown",
  );
  return jsonResponse(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
        request_id: requestId,
      },
    },
    500,
    cors,
  );
}

/** Logs a short, non-sensitive line. Never pass tokens, keys, prompts or request bodies here. */
export function logError(requestId, code, message) {
  console.error(
    JSON.stringify({
      level: "error",
      request_id: requestId,
      code,
      message: message.slice(0, 300),
    }),
  );
}

/** Reads and parses a JSON request body, enforcing content type and size limits. */
export async function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Request body must be JSON (Content-Type: application/json).",
    );
  }
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    throw new ApiError(
      413,
      "PAYLOAD_TOO_LARGE",
      `Request body must be at most ${maxBytes} bytes.`,
    );
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new ApiError(
      413,
      "PAYLOAD_TOO_LARGE",
      `Request body must be at most ${maxBytes} bytes.`,
    );
  }
  if (!text.trim())
    throw new ApiError(400, "INVALID_JSON", "Request body is empty.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body is not valid JSON.");
  }
}

export function bearerToken(req) {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1].trim()) {
    throw new ApiError(401, "AUTH_REQUIRED", "Sign in to continue.");
  }
  return match[1].trim();
}
