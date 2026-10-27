// Per-user sliding-window rate limits backed by public.consume_rate_limit().

import { ApiError, mapDbError } from "./http.ts";
import type { Db } from "./supabase.ts";

export type RateRule = { bucket: string; max: number; windowSeconds: number; label: string };

function envInt(name: string, fallback: number): number {
  const value = Number(Deno.env.get(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const RATE_LIMITS = {
  get aiPerHour(): RateRule {
    return {
      bucket: "ai_generate_hour",
      max: envInt("AI_RATE_LIMIT_PER_HOUR", 100),
      windowSeconds: 3600,
      label: "itinerary generations per hour",
    };
  },
  get aiPerDay(): RateRule {
    return {
      bucket: "ai_generate_day",
      max: envInt("AI_RATE_LIMIT_PER_DAY", 500),
      windowSeconds: 86400,
      label: "itinerary generations per day",
    };
  },
  get assistantPerHour(): RateRule {
    return {
      bucket: "ai_assistant_hour",
      max: envInt("AI_ASSISTANT_RATE_LIMIT_PER_HOUR", 30),
      windowSeconds: 3600,
      label: "assistant messages per hour",
    };
  },
  get routesPerHour(): RateRule {
    return {
      bucket: "route_optimize",
      max: envInt("ROUTE_OPTIMIZE_RATE_LIMIT_PER_HOUR", 60),
      windowSeconds: 3600,
      label: "route optimisations per hour",
    };
  },
  get writes(): RateRule {
    return {
      bucket: "api_write",
      max: envInt("WRITE_RATE_LIMIT_PER_MINUTE", 120),
      windowSeconds: 60,
      label: "changes per minute",
    };
  },
};

export async function enforceRateLimit(db: Db, rule: RateRule): Promise<void> {
  const { data, error } = await db.rpc("consume_rate_limit", {
    p_bucket: rule.bucket,
    p_max: rule.max,
    p_window_seconds: rule.windowSeconds,
  });
  if (error) throw mapDbError(error, "Rate limit check");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    const retryAfter = Math.max(1, Number(row?.retry_after_seconds) || rule.windowSeconds);
    throw new ApiError(
      429,
      "RATE_LIMITED",
      `Limit reached: ${rule.max} ${rule.label}. Try again in ${formatWait(retryAfter)}.`,
      { retry_after_seconds: retryAfter, limit: rule.max },
      { "Retry-After": String(retryAfter) },
    );
  }
}

function formatWait(seconds: number): string {
  if (seconds < 90) return `${seconds} seconds`;
  if (seconds < 5400) return `${Math.ceil(seconds / 60)} minutes`;
  return `${Math.ceil(seconds / 3600)} hours`;
}
