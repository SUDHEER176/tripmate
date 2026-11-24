import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

// Firebase web config (Firebase console > Project settings > Your apps). These
// values are public by design; access is controlled by the API and the
// Firestore rules. Without them the app runs in local demo mode.
const config = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || "").trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "").trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || "").trim(),
};

export const isBackendConfigured = Boolean(config.apiKey && config.projectId);

export const auth = isBackendConfigured ? getAuth(initializeApp(config)) : null;

// Local development against the Auth emulator (npm run emulators in backend/).
const emulator = (import.meta.env.VITE_FIREBASE_AUTH_EMULATOR || "").trim();
if (auth && emulator) {
  connectAuthEmulator(auth, emulator, { disableWarnings: true });
}
