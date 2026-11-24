// Verifies the Firebase ID token sent by the browser (Authorization: Bearer ...).

import { auth } from "./firebase.js";
import { ApiError } from "./http.js";

function bearerToken(req) {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1].trim()) {
    throw new ApiError(401, "AUTH_REQUIRED", "Sign in to continue.");
  }
  return match[1].trim();
}

/**
 * Returns the signed-in user. Password accounts must have verified their email
 * with the 6-digit code first; social sign-ins arrive verified by the provider.
 */
export async function authenticate(req) {
  const token = bearerToken(req);
  let decoded;
  try {
    decoded = await auth().verifyIdToken(token, true);
  } catch {
    throw new ApiError(
      401,
      "AUTH_INVALID",
      "Your session is invalid or has expired. Please sign in again.",
    );
  }
  if (decoded.firebase?.sign_in_provider === "password" && !decoded.email_verified) {
    throw new ApiError(
      403,
      "EMAIL_NOT_VERIFIED",
      "Verify your email with the 6-digit code before continuing.",
    );
  }
  const user = { id: decoded.uid, email: decoded.email ?? null };
  // `db` is the caller's context for the data layer; it carries the user id
  // so every repository call is scoped to that user.
  return { db: { userId: user.id }, user };
}
