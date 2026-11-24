// Per-user sliding-window rate limits stored in Firestore:
// rate_limits/{userId}__{bucket} holds the timestamps (ms) of recent requests.

import { db as firestore } from "./firebase.js";
import { ApiError } from "./http.js";

function envInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const RATE_LIMITS = {
  get aiPerHour() {
    return {
      bucket: "ai_generate_hour",
      max: envInt("AI_RATE_LIMIT_PER_HOUR", 100),
      windowSeconds: 3600,
      label: "itinerary generations per hour",
    };
  },
  get aiPerDay() {
    return {
      bucket: "ai_generate_day",
      max: envInt("AI_RATE_LIMIT_PER_DAY", 500),
      windowSeconds: 86400,
      label: "itinerary generations per day",
    };
  },
  get assistantPerHour() {
    return {
      bucket: "ai_assistant_hour",
      max: envInt("AI_ASSISTANT_RATE_LIMIT_PER_HOUR", 30),
      windowSeconds: 3600,
      label: "assistant messages per hour",
    };
  },
  get routesPerHour() {
    return {
      bucket: "route_optimize",
      max: envInt("ROUTE_OPTIMIZE_RATE_LIMIT_PER_HOUR", 60),
      windowSeconds: 3600,
      label: "route optimisations per hour",
    };
  },
  get writes() {
    return {
      bucket: "api_write",
      max: envInt("WRITE_RATE_LIMIT_PER_MINUTE", 120),
      windowSeconds: 60,
      label: "changes per minute",
    };
  },
};

/** Records one request for this user and bucket, or throws 429 if over the limit. */
async function consume(userId, rule) {
  const ref = firestore().collection("rate_limits").doc(`${userId}__${rule.bucket}`);
  return firestore().runTransaction(async (tx) => {
    const now = Date.now();
    const windowMs = rule.windowSeconds * 1000;
    const snapshot = await tx.get(ref);
    const recent = (snapshot.exists ? snapshot.data().events ?? [] : []).filter(
      (t) => t > now - windowMs,
    );
    if (recent.length >= rule.max) {
      const oldest = Math.min(...recent);
      return { allowed: false, retryAfter: Math.ceil((oldest + windowMs - now) / 1000) };
    }
    recent.push(now);
    tx.set(ref, { user_id: userId, bucket: rule.bucket, events: recent });
    return { allowed: true };
  });
}

export async function enforceRateLimit(db, rule) {
  let row;
  try {
    row = await consume(db.userId, rule);
  } catch (err) {
    console.error("Rate limit check:", err?.message ?? err);
    throw new ApiError(500, "DATABASE_ERROR", "Rate limit check failed. Please try again.");
  }
  if (!row.allowed) {
    const retryAfter = Math.max(1, Number(row.retryAfter) || rule.windowSeconds);
    throw new ApiError(
      429,
      "RATE_LIMITED",
      `Limit reached: ${rule.max} ${rule.label}. Try again in ${formatWait(retryAfter)}.`,
      { retry_after_seconds: retryAfter, limit: rule.max },
      { "Retry-After": String(retryAfter) },
    );
  }
}

function formatWait(seconds) {
  if (seconds < 90) return `${seconds} seconds`;
  if (seconds < 5400) return `${Math.ceil(seconds / 60)} minutes`;
  return `${Math.ceil(seconds / 3600)} hours`;
}
