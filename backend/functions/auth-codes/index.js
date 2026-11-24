// API: auth-codes. 6-digit email codes on top of Firebase Auth.
//
// POST /api/auth-codes/send    { email, purpose: "sign-in" | "verify" }
// POST /api/auth-codes/verify  { email, code, purpose, name? }  -> { token }
//
//   sign-in  Passwordless sign-in. Creates the account if it doesn't exist yet.
//   verify   Confirms the email of a password account after sign-up.
//
// On success the server returns a Firebase custom token, and the browser signs
// in with signInWithCustomToken(). Codes are stored hashed, expire after 10
// minutes, allow 5 wrong attempts, and can be re-sent every 30 seconds.

import { createHash, randomInt, randomBytes, timingSafeEqual } from "node:crypto";
import { serveJson } from "../_shared/handler.js";
import { ApiError, ok, readJsonBody, ValidationError } from "../_shared/http.js";
import { auth, db } from "../_shared/firebase.js";
import { sendOtpEmail } from "../_shared/email.js";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_AFTER_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const PURPOSES = ["sign-in", "verify"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parse(body, withCode) {
  const src = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const fields = {};
  const email = typeof src.email === "string" ? src.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) fields.email = "must be a valid email";
  if (!PURPOSES.includes(src.purpose)) fields.purpose = `must be one of ${PURPOSES.join(", ")}`;
  if (withCode && !/^\d{6}$/.test(String(src.code ?? "").trim()))
    fields.code = "must be 6 digits";
  const name = typeof src.name === "string" ? src.name.trim().slice(0, 100) : "";
  if (Object.keys(fields).length) throw new ValidationError(fields);
  return { email, purpose: src.purpose, code: String(src.code ?? "").trim(), name };
}

const codeRef = (email) =>
  db().collection("email_codes").doc(createHash("sha256").update(email).digest("hex"));
const hashCode = (code, salt) => createHash("sha256").update(`${salt}:${code}`).digest();

async function findUser(email) {
  try {
    return await auth().getUserByEmail(email);
  } catch (err) {
    if (err?.code === "auth/user-not-found") return null;
    throw err;
  }
}

async function send({ email, purpose }) {
  const ref = codeRef(email);
  const previous = await ref.get();
  if (previous.exists && Date.now() - previous.data().sent_at < RESEND_AFTER_MS) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Please wait a few seconds before asking for another code.",
      { retry_after_seconds: 30 },
      { "Retry-After": "30" },
    );
  }

  // A verify code only makes sense for an existing, unverified account. The
  // response is the same either way, so it doesn't reveal which emails exist.
  if (purpose === "verify") {
    const user = await findUser(email);
    if (!user || user.emailVerified || user.disabled) return;
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  await ref.set({
    email,
    purpose,
    salt,
    code_hash: hashCode(code, salt).toString("hex"),
    attempts: 0,
    sent_at: Date.now(),
    expires_at: Date.now() + CODE_TTL_MS,
  });
  await sendOtpEmail(email, code, purpose === "verify" ? "email-verification" : "sign-in");
}

function invalidCode() {
  return new ApiError(400, "INVALID_CODE", "Invalid or expired verification code.");
}

async function verify({ email, purpose, code, name }) {
  const ref = codeRef(email);
  // Check and consume the code atomically, so it can only be used once.
  const matched = await db().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return false;
    const saved = snapshot.data();
    if (saved.purpose !== purpose || saved.expires_at < Date.now() || saved.attempts >= MAX_ATTEMPTS) {
      return false;
    }
    const good = timingSafeEqual(hashCode(code, saved.salt), Buffer.from(saved.code_hash, "hex"));
    if (good) tx.delete(ref);
    else tx.update(ref, { attempts: saved.attempts + 1 });
    return good;
  });
  if (!matched) throw invalidCode();

  let user = await findUser(email);
  if (user?.disabled) throw invalidCode();
  if (!user) {
    if (purpose !== "sign-in") throw invalidCode();
    user = await auth().createUser({
      email,
      emailVerified: true,
      displayName: name || email.split("@")[0],
    });
  } else if (!user.emailVerified) {
    // The code proves the person controls this inbox.
    await auth().updateUser(user.uid, { emailVerified: true });
  }
  return { token: await auth().createCustomToken(user.uid) };
}

export default serveJson(["POST"], async (req) => {
  const action = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  const body = await readJsonBody(req);
  if (action === "send") {
    await send(parse(body, false));
    return ok({ sent: true });
  }
  if (action === "verify") return ok(await verify(parse(body, true)));
  throw new ApiError(404, "ROUTE_NOT_FOUND", "Unknown endpoint.");
});
