# TripMate AI

[![CI](https://github.com/SUDHEER176/tripmate/actions/workflows/ci.yml/badge.svg)](https://github.com/SUDHEER176/tripmate/actions/workflows/ci.yml)

**An AI travel planner.** Tell it where you're going, for how long and what you enjoy, and it builds a day-by-day itinerary with a budget and a map. You can then edit the plan yourself or just ask the AI assistant to change it.

> Status: MVP

---

## Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Quick start (2 minutes)](#quick-start-2-minutes)
- [Full setup with Firebase](#full-setup-with-firebase)
- [Moving existing data from Supabase](#moving-existing-data-from-supabase)
- [How it works](#how-it-works)
- [Backend API](#backend-api)
- [Testing](#testing)
- [CI/CD](#cicd)
- [App pages](#app-pages)

---

## What it does

| Feature | In short |
|---|---|
| **AI itinerary generator** | Creates a day-by-day plan from your destination, trip length, number of travelers, pace (relaxed, moderate or packed) and interests (culture, food, nature, adventure and more). |
| **AI trip assistant** | A chat that edits your trip for you. Say *"swap the museum for a food tour"* or *"make day 2 relaxed"* and it updates the itinerary and budget. |
| **Route optimization** | One click puts a day's stops in the fastest order, using real travel times. Shows the saving first (e.g. *"save 35 min, 28% less"*) before applying it. |
| **Budget planner** | Tracks costs in INR across accommodation, dining, transport and excursions, and warns you when you go over budget. |
| **Interactive map** | Numbered pins for each day's stops, joined by a route line. |
| **Save and manage trips** | Create, view, edit and delete trips and their stops. |
| **Share link** | Turn on a public, read-only link to a trip and send it on WhatsApp. Notes, expenses and the packing list stay private. Turn it off any time. |
| **Weather** | Forecast for each trip day (Open-Meteo, free, no key). Days more than 16 days ahead show last year's weather as a guide. |
| **Packing list** | AI writes a checklist from the destination, dates, weather and activities. Tick items off, add your own. |
| **Works with or without an account** | Uses Firebase (cloud storage, with login) when configured, or runs as a local demo in your browser when it isn't. |
| **Modern, responsive design** | Tailwind CSS, custom design tokens, Fraunces and Outfit fonts, glassmorphic micro-interactions. |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, JavaScript (JSX) |
| Styling | Tailwind CSS v4, class-variance-authority |
| Routing | React Router v7 |
| Database | Cloud Firestore (one document per trip) |
| Auth | Firebase Authentication (email + password, 6-digit email codes, Google / GitHub / Apple) |
| Backend | One Firebase Cloud Function (`api`), also runnable as a plain Node server for development |
| AI | Any OpenAI-compatible LLM API (default model `gpt-4o-mini`), with a local fallback generator |
| Maps | Google Maps JavaScript API via `@vis.gl/react-google-maps`; Leaflet + OpenStreetMap as fallback |
| Routing data | Google Routes API (`computeRouteMatrix`) |
| Hosting | Vercel (frontend) + Render (API), free; Firebase Hosting + Cloud Functions on the Blaze plan |

---

## Project structure

```
frontend/         React app (Vite): src/, public/, index.html, vite.config.js
backend/          API: index.js (Cloud Function), server.js (local Node server), app.js (routing),
                  functions/ (API handlers + shared code), scripts/ (Supabase import), tests/
firebase.json     Hosting, Functions, Firestore and emulator config
firestore.rules   Denies all direct browser access; the API is the only way in
```

The browser calls the API at `/api` **on the frontend's own origin** and sends the user's Firebase ID token. Firebase Hosting rewrites `/api/**` to the `api` function; in development `npm run dev` proxies `/api` to the local server (`VITE_DEV_API_TARGET`, default `http://localhost:8000`).

The frontend reuses the budget and route-optimizer code from `backend/functions/_shared/`.

---

## Quick start (2 minutes)

You don't need any accounts or API keys to try it. Without Firebase settings the app runs in **local demo mode** and stores everything in your browser.

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

---

## Full setup with Firebase

Do this when you want real accounts, cloud storage and the AI features.

### 1. Create the Firebase project

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) and switch it to the **Blaze** (pay-as-you-go) plan. Cloud Functions require it; the free quotas still apply.
2. **Build → Authentication → Sign-in method:** enable **Email/Password**, and Google / GitHub / Apple if you want them.
3. **Build → Firestore Database:** create a database in production mode.
4. **Project settings → Your apps:** add a Web app and copy its config.
5. Give the Cloud Functions service account the **Service Account Token Creator** role (Google Cloud console → IAM). The email-code sign-in creates custom tokens and needs it.

### 2. Run it locally

You can develop without touching the real project by using the emulators:

```bash
cd backend
npm install
cp .env.example .env.local     # use the emulator lines, add LLM_API_KEY
npm run emulators              # Auth :9099, Firestore :8080 (needs Java 11+)
npm start                      # API on http://localhost:8000
```

```bash
cd frontend
cp .env.example .env.local     # VITE_FIREBASE_PROJECT_ID=demo-tripmate, any API key,
                               # VITE_FIREBASE_AUTH_EMULATOR=http://127.0.0.1:9099
npm run dev
```

Email codes are printed to the backend console when `BREVO_API_KEY` isn't set (and `NODE_ENV` isn't `production`).

| Backend variable | Default | Purpose |
|---|---|---|
| `FIREBASE_PROJECT_ID` | — | Your project id (`demo-tripmate` with the emulators) |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | Service-account key file, for a local server talking to the real project |
| `LLM_API_KEY` | — | Any OpenAI-compatible key (`OPENAI_API_KEY` also works) |
| `BREVO_API_KEY`, `EMAIL_FROM` | — | Sends the 6-digit codes via [Brevo](https://www.brevo.com). `EMAIL_FROM` must be a sender verified in Brevo |
| `LLM_BASE_URL` | OpenAI | Use any OpenAI-compatible API |
| `LLM_MODEL` | `gpt-4o-mini` | Model used for generation and the assistant |
| `AI_RATE_LIMIT_PER_HOUR` / `_PER_DAY` | `5` / `20` | Itinerary generations per user |
| `AI_ASSISTANT_RATE_LIMIT_PER_HOUR` | `30` | Assistant requests per user per hour |
| `WRITE_RATE_LIMIT_PER_MINUTE` | `120` | Write requests per user per minute |
| `GOOGLE_ROUTES_API_KEY` | none | Server key with the Routes API enabled. Without it, travel times are estimated from distance. |

### 3. Deploy (free: Firebase Spark + Render + Vercel)

The free Spark plan has no Cloud Functions, so the API runs on **Render** and the frontend on **Vercel**. Firebase still provides Auth and Firestore.

```
Browser ──> Vercel (frontend)  ──/api/*──>  Render (backend/server.js)  ──>  Firebase Auth + Firestore
```

**a. Firestore rules (once, and after changing them):**

```bash
cd backend
npx firebase login
cd .. && backend/node_modules/.bin/firebase deploy --only firestore
```

**b. Backend on Render:**

1. Push the repo to GitHub.
2. Render dashboard → **New → Blueprint** → pick the repo. It reads `render.yaml` and creates the free `tripmate-api` service.
3. Fill in the values it asks for:
   - `FIREBASE_SERVICE_ACCOUNT`: the **whole contents** of the service-account JSON (Firebase console → Project settings → Service accounts → Generate new private key).
   - `LLM_API_KEY`, `BREVO_API_KEY` and `EMAIL_FROM` (a sender verified in Brevo), and optionally `GOOGLE_ROUTES_API_KEY`.
   - `ALLOWED_ORIGINS`: your Vercel URL.
4. Check `https://<your-service>.onrender.com/health` responds.

If Render gives the service a different URL than `https://tripmate-f76b.onrender.com`, update the destination in `frontend/vercel.json`.

The free instance sleeps after 15 minutes idle; the first request after that takes about 30 seconds.

**c. Frontend on Vercel:**

1. Vercel → **Add New → Project** → import the repo, set **Root Directory** to `frontend` (framework: Vite). Leave "Include files outside the root directory" on: the frontend imports shared code from `backend/functions/_shared/`.
2. Add the environment variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` and optionally `VITE_GOOGLE_MAPS_API_KEY` / `VITE_GOOGLE_MAPS_MAP_ID`.
3. Deploy. `frontend/vercel.json` forwards `/api/*` to Render, so the browser only ever talks to the Vercel domain.
4. Firebase console → **Authentication → Settings → Authorized domains**: add your Vercel domain (needed for Google / GitHub / Apple sign-in).

Render and Vercel redeploy automatically on every push to `main`.

**On the Blaze plan instead?** You can host everything on Firebase: `npx firebase functions:secrets:set LLM_API_KEY`, build the frontend, then `firebase deploy --only hosting,functions,firestore` (see `firebase.json`).

---

## Moving existing data from Supabase

`npm run import-supabase` copies everything from the old Supabase database into Firebase:

- **Users**, with the same ids, names and photos. Supabase's bcrypt password hashes are imported as they are, so passwords keep working.
- **Google / GitHub / Apple** sign-ins (from `auth.identities`).
- **All trips**: each one becomes a single Firestore document with its days, activities and expenses.

Sessions are not copied, so everyone signs in once more. The script is safe to re-run: users and trips that already exist are skipped.

```bash
cd backend
# in .env.local: SUPABASE_DB_URL (Supabase → Project Settings → Database → session pooler URI),
#                FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS
npm run import-supabase
```

Before importing everyone, try it with one test account and sign in with its old password.

---

## How it works

### AI trip assistant

The assistant is a **tool-calling agent**. Instead of rewriting the whole trip, the LLM calls one of **8 tools**: add, update, move or delete a stop; reorder days; manage expenses; or update trip details.

- Every tool runs through **the same validated, ownership-checked code as the REST API**, so the AI can't do anything a user couldn't.
- The model only ever sees short references like `a3` or `e1`, **never real database IDs**. An invented or injected ID therefore can't reach the database.
- Each request is capped at 6 model calls and 12 tool calls.

### Route optimization

1. Fetches real travel times between all of a day's stops from the Google Routes API.
2. Finds the fastest order: an **exact Held-Karp** algorithm for up to 12 stops, and the **2-opt** heuristic for more.
3. Keeps the morning → afternoon → evening order and shifts start times to match.
4. Shows a preview of the time saved; nothing changes until you apply it.

Without a Routes API key it falls back to a distance-based estimate.

### Budget model

- **Every cost lives in the trip's `expenses` list.** Each priced activity owns exactly one linked expense, kept in sync by the API on every change, so nothing is counted twice.
- Each expense has a `cost_basis` that says how it scales: `total`, `per_person`, `per_night`, `per_person_per_night`, `per_day` or `per_person_per_day`.
- The calculation lives in `backend/functions/_shared/budget.js` and is **shared by the backend and the frontend**, so both always show the same totals.

### Security

- Firebase Authentication for login. The API verifies the Firebase ID token on every request, and password accounts must confirm their email with a 6-digit code first.
- **Browsers have no direct Firestore access** (`firestore.rules` denies everything). All data goes through the API, which loads each trip in one place and checks that it belongs to the signed-in user before any read or change.
- Every change is one Firestore transaction on the trip document, so a change and its budget are always saved together.
- Rate limits on AI generation, the assistant and writes.
- AI output is validated before anything is saved.

---

## Backend API

All functions return either `{ "data": ... }` or `{ "error": { "code", "message", "details"? } }`.

All endpoints are under `/api` and need `Authorization: Bearer <Firebase ID token>`, except the email-code endpoints and shared trips:

- `POST /api/auth-codes/send` `{ email, purpose: "sign-in" | "verify" }` emails a 6-digit code.
- `POST /api/auth-codes/verify` `{ email, code, purpose, name? }` returns `{ token }`, a Firebase custom token for `signInWithCustomToken`.
- `GET /api/shared/:shareId` returns the read-only view of a shared trip (404 once sharing is turned off).

### `generate-itinerary`

`POST` — validates the input, applies the rate limit, calls the LLM, validates its output, then saves the trip, days, activities and expenses **in one transaction**.

To regenerate an existing trip, send `{ trip_id, confirm_regenerate: true }`.

### `trip-assistant`

`POST` with `{ trip_id, messages }` — runs the tool-calling agent and returns `{ reply, actions, incomplete, trip }`.

### `trips`

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` / `POST` | `/trips` | List trips / create a trip |
| `GET` / `PATCH` / `DELETE` | `/trips/:id` | Get, update or delete a trip |
| `GET` | `/trips/:id/budget` | Budget summary |
| `POST` | `/trips/:id/activities` | Add an activity |
| `POST` | `/trips/:id/activities/reorder` | Reorder activities |
| `PATCH` / `DELETE` | `/trips/:id/activities/:activityId` | Update or delete an activity |
| `POST` | `/trips/:id/expenses` | Add an expense |
| `PATCH` / `DELETE` | `/trips/:id/expenses/:expenseId` | Update or delete an expense |
| `POST` | `/trips/:id/optimize-route` | Optimize a day's route. Body: `{ itinerary_day_id, apply? }` (omit `apply` for a preview) |
| `POST` / `DELETE` | `/trips/:id/share` | Turn the public link on (returns `{ share_id }`) or off |
| `PATCH` | `/trips/:id/packing-list` | Replace the packing list. Body: `{ items: [{ id?, text, category, packed }] }` |
| `POST` | `/trips/:id/packing-list/generate` | Create a packing list with AI (falls back to rules). Body: `{ weather?: { min_temp, max_temp, rainy_days } }` |

---

## Testing

### Unit tests

Cover budget math, input validation, AI output checks, LLM error handling and route optimization.

```bash
cd backend
npm install
npm test
```

### End-to-end tests

These run against the Firebase emulators with a fake LLM, so no real project or API key is used. Java 11+ is required.

```bash
# Run from backend/
npm run emulators &              # Auth :9099, Firestore :8080
npm run mock-llm &               # mock OpenAI-compatible server on :8787

export FIREBASE_PROJECT_ID=demo-tripmate \
  FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
LLM_API_KEY=mock-llm-key LLM_BASE_URL=http://127.0.0.1:8787/v1 AI_RATE_LIMIT_PER_HOUR=8 npm start &

API_URL=http://127.0.0.1:8000 AI_RATE_LIMIT_PER_HOUR=8 npm run test:integration
```

### Production build

```bash
cd frontend
npm run build
```

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request.

| Job | What it does |
|---|---|
| **checks** | Checks the backend loads, runs unit tests, builds the frontend for production |
| **integration** | Starts the Firebase emulators and the mock LLM, starts the backend, runs the end-to-end tests |
| **deploy** | Only on `main`, and only after both jobs pass: deploys the Firestore rules and indexes. Render and Vercel deploy the app themselves from GitHub. |

- **Dependencies:** Dependabot opens weekly update PRs for npm packages and GitHub Actions.

### Enabling the deploy

Create a GitHub environment named `production` with:

| Name | Kind | Value |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | secret | JSON key of a service account (the Firebase Admin SDK key works) |
| `FIREBASE_PROJECT_ID` | variable | Your project id |

Without the secret and project id, the deploy job is skipped with a notice; checks and tests still run.

---

## App pages

| Page | Route | Login needed | Purpose |
|---|---|---|---|
| Landing | `/` | No | Product overview, features, interactive sample plan |
| Explore | `/explore` | No | Search and discover destinations |
| Pricing | `/pricing` | No | Free Explorer, Pro Wanderer and Lifetime Nomad tiers |
| Login | `/login` | No | Sign in with email or a one-click demo account |
| Signup | `/signup` | No | Create an account |
| Plan a trip | `/plan-trip` | Yes | Enter destination, dates, budget and preferences |
| Trip details | `/trips/:id` | Yes | Day-by-day plan, edit stops, map, budget, weather and packing list |
| Shared trip | `/shared/:shareId` | No | Read-only itinerary from a share link |
| My trips | `/my-trips` | Yes | Manage all saved trips |
