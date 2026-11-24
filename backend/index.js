// Firebase Cloud Functions entry point. One HTTPS function, `api`, serves every
// /api route; Firebase Hosting rewrites /api/** to it (see ../firebase.json).
//
// Secrets: firebase functions:secrets:set LLM_API_KEY   (and BREVO_API_KEY)
// Other settings go in backend/.env.<project-id> (deployed as plain env vars).

import { onRequest } from "firebase-functions/v2/https";
import { handle } from "./app.js";

export const api = onRequest(
  {
    region: process.env.FUNCTION_REGION || "us-central1",
    // AI generation can take a couple of minutes.
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: ["LLM_API_KEY", "BREVO_API_KEY"],
  },
  (req, res) => handle(req, res),
);
