// Per-request Supabase client bound to the caller's JWT. Every query therefore
// runs under the caller's Row Level Security policies; the service-role key is
// never used by these functions.

import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.118.0";
import { ApiError, bearerToken } from "./http.ts";

export type Db = SupabaseClient;

export type AuthContext = { db: Db; user: User };

function requireEnv(name: string, fallback?: string): string {
  const value = Deno.env.get(name) ?? (fallback ? Deno.env.get(fallback) : undefined);
  if (!value) throw new ApiError(500, "SERVER_MISCONFIGURED", "The server is not configured correctly.");
  return value;
}

/** Verifies the bearer token with Supabase Auth and returns a user-scoped client. */
export async function authenticate(req: Request): Promise<AuthContext> {
  const token = bearerToken(req);
  const url = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");

  if (token === anonKey) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to continue.");

  const db = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    throw new ApiError(401, "AUTH_INVALID", "Your session is invalid or has expired. Please sign in again.");
  }
  return { db, user: data.user };
}
