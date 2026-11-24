// Firebase Admin SDK: Firestore and Auth.
//
// Credentials:
//   - On Cloud Functions, the default service account is used automatically.
//   - Locally, set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file,
//     or FIREBASE_SERVICE_ACCOUNT to its contents.
//   - With the emulators, FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST
//     are enough (plus FIREBASE_PROJECT_ID).
//
// The Admin SDK bypasses Firestore Security Rules, so every trip read and write
// goes through the ownership checks in trips-repo.js. Browsers have no direct
// Firestore access at all (see firestore.rules).

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function app() {
  const existing = getApps()[0];
  if (existing) return existing;
  const options = {};
  if (process.env.FIREBASE_PROJECT_ID) options.projectId = process.env.FIREBASE_PROJECT_ID;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    options.credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  }
  return initializeApp(options);
}

let firestore = null;

export function db() {
  if (!firestore) {
    firestore = getFirestore(app());
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
}

export function auth() {
  return getAuth(app());
}
