// One-time copy of users and trips from a Supabase database into Firebase.
//
//   npm run import-supabase
//
// Reads SUPABASE_DB_URL (Supabase > Project Settings > Database > Connection
// string, session pooler) and Firebase Admin credentials (GOOGLE_APPLICATION_CREDENTIALS
// or FIREBASE_SERVICE_ACCOUNT, plus FIREBASE_PROJECT_ID) from backend/.env.local or .env.
//
// What is copied:
//   auth.users      -> Firebase Auth users with the SAME uid, email, name, photo
//                      and bcrypt password hash, so passwords keep working
//   auth.identities -> linked Google / GitHub / Apple sign-ins
//   trips + itinerary_days + activities + trip_expenses -> one trips/{id} document each
// Not copied: sessions (everyone signs in once more), rate limits.
//
// Safe to re-run: users and trips that already exist in Firebase are skipped.

import { fileURLToPath } from "node:url";
import pg from "pg";

for (const file of ["../.env.local", "../.env"]) {
  try {
    process.loadEnvFile(fileURLToPath(new URL(file, import.meta.url)));
  } catch {
    // optional
  }
}

const { auth, db } = await import("../functions/_shared/firebase.js");
const { summarizeTrip } = await import("../functions/_shared/trips-repo.js");

pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

if (!process.env.SUPABASE_DB_URL) {
  console.error("Set SUPABASE_DB_URL in backend/.env.local first.");
  process.exit(1);
}

const PROVIDER_IDS = { google: "google.com", github: "github.com", apple: "apple.com" };
const NUMERIC = ["budget", "total_estimated_cost", "estimated_cost", "amount", "quantity"];
const TIMESTAMPS = ["created_at", "updated_at", "generated_at"];

/** Converts a SQL row to the shape stored in Firestore (numbers, ISO strings). */
function clean(row) {
  const out = { ...row };
  for (const key of NUMERIC) if (out[key] != null) out[key] = Number(out[key]);
  for (const key of TIMESTAMPS) if (out[key] instanceof Date) out[key] = out[key].toISOString();
  return out;
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row[key])) map.set(row[key], []);
    map.get(row[key]).push(row);
  }
  return map;
}

function chunks(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const source = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await source.connect();

try {
  // ---- Users -----------------------------------------------------------------
  const { rows: users } = await source.query(`
    select u.id::text as uid,
           lower(u.email) as email,
           coalesce(nullif(p.full_name, ''),
                    nullif(u.raw_user_meta_data->>'full_name', ''),
                    nullif(u.raw_user_meta_data->>'name', '')) as name,
           coalesce(p.avatar_url, u.raw_user_meta_data->>'avatar_url') as photo,
           u.email_confirmed_at is not null as verified,
           nullif(u.encrypted_password, '') as password_hash
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.email is not null
       and u.deleted_at is null
       and coalesce(u.is_anonymous, false) = false`);
  const { rows: identities } = await source.query(
    `select user_id::text as uid, provider,
            coalesce(identity_data->>'sub', provider_id) as provider_uid
       from auth.identities
      where provider = any($1)`,
    [Object.keys(PROVIDER_IDS)],
  );
  const socialByUser = groupBy(identities, "uid");

  let imported = 0;
  let skipped = 0;
  const failures = [];
  for (const batch of chunks(users, 100)) {
    const existing = await auth().getUsers(batch.map((u) => ({ uid: u.uid })));
    const known = new Set(existing.users.map((u) => u.uid));
    const fresh = batch.filter((u) => !known.has(u.uid));
    skipped += batch.length - fresh.length;
    if (!fresh.length) continue;

    const records = fresh.map((u) => ({
      uid: u.uid,
      email: u.email,
      emailVerified: u.verified,
      displayName: u.name ?? undefined,
      photoURL: u.photo ?? undefined,
      passwordHash: u.password_hash ? Buffer.from(u.password_hash) : undefined,
      providerData: (socialByUser.get(u.uid) ?? []).map((s) => ({
        uid: s.provider_uid,
        providerId: PROVIDER_IDS[s.provider],
        email: u.email,
      })),
    }));
    // Supabase stores bcrypt hashes, which Firebase can import directly.
    const result = await auth().importUsers(records, { hash: { algorithm: "BCRYPT" } });
    imported += result.successCount;
    for (const error of result.errors) {
      failures.push(`${fresh[error.index].email}: ${error.error.message}`);
    }
  }
  console.log(`Users: ${imported} imported, ${skipped} already existed, ${failures.length} failed.`);
  for (const failure of failures) console.log(`  ${failure}`);

  // Only trips whose owner now exists in Firebase Auth.
  const owners = new Set();
  for (const batch of chunks(users, 100)) {
    const found = await auth().getUsers(batch.map((u) => ({ uid: u.uid })));
    for (const u of found.users) owners.add(u.uid);
  }

  // ---- Trips -----------------------------------------------------------------
  const query = async (sql) => (await source.query(sql)).rows.map(clean);
  const trips = await query(`
    select id::text, user_id::text, title, destination, destination_lat, destination_lng,
           start_date, end_date, budget, currency, travelers, coalesce(interests, '{}') as interests,
           pace, travel_style, notes, travel_notes, status, total_estimated_cost,
           generation_count, generated_at, ai_model, created_at, updated_at
      from public.trips`);
  const days = groupBy(
    await query(`select id::text, trip_id::text, day_number, date, title, summary, created_at, updated_at
                   from public.itinerary_days`),
    "trip_id",
  );
  const activities = groupBy(
    await query(`select id::text, itinerary_day_id::text, name, description, category, time_slot,
                        start_time, duration_minutes, location_name, lat, lng, estimated_cost,
                        cost_basis, cost_is_estimate, notes, sort_order, created_at, updated_at
                   from public.activities`),
    "itinerary_day_id",
  );
  const expenses = groupBy(
    await query(`select id::text, trip_id::text, activity_id::text, category, title, amount, currency,
                        quantity, cost_basis, notes, source, is_estimate, created_at, updated_at
                   from public.trip_expenses`),
    "trip_id",
  );

  const writer = db().bulkWriter();
  let created = 0;
  let existed = 0;
  let orphaned = 0;
  const tripFailures = [];
  writer.onWriteError((error) => {
    if (error.code === 6) existed += 1; // ALREADY_EXISTS: imported on an earlier run
    else tripFailures.push(`${error.documentRef.id}: ${error.message}`);
    return false;
  });
  writer.onWriteResult(() => {
    created += 1;
  });

  for (const trip of trips) {
    if (!owners.has(trip.user_id)) {
      orphaned += 1;
      continue;
    }
    const doc = {
      ...trip,
      itinerary_days: (days.get(trip.id) ?? []).map((day) => ({
        ...day,
        activities: activities.get(day.id) ?? [],
      })),
      expenses: expenses.get(trip.id) ?? [],
    };
    doc.total_estimated_cost = summarizeTrip(doc).budget.estimated_total;
    // Failures are reported through onWriteError above.
    writer.create(db().collection("trips").doc(trip.id), doc).catch(() => {});
  }
  await writer.close();

  console.log(
    `Trips: ${created} imported, ${existed} already existed, ${orphaned} skipped (owner not imported), ` +
      `${tripFailures.length} failed.`,
  );
  for (const failure of tripFailures) console.log(`  ${failure}`);
  if (failures.length || tripFailures.length) process.exitCode = 1;
  else console.log("Done. Users sign in again with the same email and password.");
} finally {
  await source.end();
}
