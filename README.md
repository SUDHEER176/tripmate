# TripMate AI

[![CI](https://github.com/YOUR_GITHUB_USER/YOUR_REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_GITHUB_USER/YOUR_REPO/actions/workflows/ci.yml)

**An AI travel planner.** Tell it where you're going, for how long and what you enjoy, and it builds a day-by-day itinerary with a budget and a map. You can then edit the plan yourself or just ask the AI assistant to change it.

> Status: MVP

---

## Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Quick start (2 minutes)](#quick-start-2-minutes)
- [Full setup with Supabase](#full-setup-with-supabase)
- [How it works](#how-it-works)
- [Backend API (Edge Functions)](#backend-api-edge-functions)
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
| **Works with or without an account** | Uses Supabase (cloud, with login) when configured, or runs as a local demo in your browser when it isn't. |
| **Modern, responsive design** | Tailwind CSS, custom design tokens, Fraunces and Outfit fonts, glassmorphic micro-interactions. |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, JavaScript (JSX) |
| Styling | Tailwind CSS v4, class-variance-authority |
| Routing | React Router v7 |
| Database and auth | Supabase (PostgreSQL + Supabase Auth) |
| Backend | Supabase Edge Functions |
| AI | Any OpenAI-compatible LLM API (default model `gpt-4o-mini`), with a local fallback generator |
| Maps | Google Maps JavaScript API via `@vis.gl/react-google-maps`; Leaflet + OpenStreetMap as fallback |
| Routing data | Google Routes API (`computeRouteMatrix`) |
| Hosting | Vercel (frontend) + Supabase (backend) |

---

## Quick start (2 minutes)

You don't need any accounts or API keys to try it. Without Supabase credentials the app runs in **local demo mode** and stores everything in your browser.

```bash
npm install
npm run dev
```

Open **http://localhost:5173**.

---

## Full setup with Supabase

Do this when you want real accounts, cloud storage and the AI features.

### 1. Add your environment variables

```bash
cp .env.example .env.local
```

Then fill in `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Google Maps. Without it, the map uses OpenStreetMap + Leaflet.
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key
```

### 2. Create the database

The schema lives in `supabase/migrations/`. Migrations are idempotent, so they are safe to run on a database where the old `schema.sql` was already applied.

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

| Migration | What it adds |
|---|---|
| `20261026000000_baseline_schema.sql` | Tables `profiles`, `trips`, `itinerary_days`, `activities`, with Row Level Security (same as the old `schema.sql`) |
| `20261026000100_trip_backend.sql` | New trip and activity columns and constraints, the `trip_expenses` table, a trigger that syncs activities to expenses, rate limiting (`rate_limit_events` + `consume_rate_limit()`), the `save_generated_trip()` and `reorder_activities()` functions, and tighter RLS |

### 3. Set server secrets and deploy the Edge Functions

```bash
npx supabase secrets set LLM_API_KEY=your-api-key     # OPENAI_API_KEY also works

npx supabase functions deploy generate-itinerary
npx supabase functions deploy trips
npx supabase functions deploy trip-assistant
```

Optional server settings:

| Secret | Default | Purpose |
|---|---|---|
| `LLM_BASE_URL` | OpenAI | Use any OpenAI-compatible API |
| `LLM_MODEL` | `gpt-4o-mini` | Model used for generation and the assistant |
| `AI_RATE_LIMIT_PER_HOUR` | `5` | Itinerary generations per user per hour |
| `AI_RATE_LIMIT_PER_DAY` | `20` | Itinerary generations per user per day |
| `AI_ASSISTANT_RATE_LIMIT_PER_HOUR` | `30` | Assistant requests per user per hour |
| `WRITE_RATE_LIMIT_PER_MINUTE` | `120` | Write requests per user per minute |
| `ALLOWED_ORIGINS` | `*` | Comma-separated list of allowed CORS origins |
| `GOOGLE_ROUTES_API_KEY` | none | Server key with the Routes API enabled. Without it, travel times are estimated from distance. |

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

- **Every cost lives in one table, `trip_expenses`.** Each priced activity owns exactly one linked expense, kept in sync by a database trigger, so nothing is counted twice.
- Each expense has a `cost_basis` that says how it scales: `total`, `per_person`, `per_night`, `per_person_per_night`, `per_day` or `per_person_per_day`.
- The calculation lives in `supabase/functions/_shared/budget.js` and is **shared by the backend and the frontend**, so both always show the same totals.

### Security

- Supabase Auth for login; PostgreSQL **Row Level Security** so users can only see their own trips.
- All Edge Functions verify the caller's JWT and run every query under that caller's RLS policies.
- Rate limits on AI generation, the assistant and writes.
- AI output is validated before anything is saved.

---

## Backend API (Edge Functions)

All functions return either `{ "data": ... }` or `{ "error": { "code", "message", "details"? } }`.

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

---

## Testing

### Unit tests

Cover budget math, input validation, AI output checks, LLM error handling and route optimization.

```bash
npm test
```

### End-to-end tests

These run against a local Supabase stack with a fake LLM, so no real API key is used. **Docker is required.**

```bash
# 1. Start local Supabase
npx supabase start

# 2. Start the mock OpenAI-compatible server (port 8787)
npm run mock-llm

# 3. Serve the Edge Functions, using an env file containing:
#      LLM_API_KEY=mock-llm-key
#      LLM_BASE_URL=http://host.docker.internal:8787/v1
#      AI_RATE_LIMIT_PER_HOUR=8
npx supabase functions serve --env-file <your-env-file>

# 4. Run the tests
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_ANON_KEY=<local anon key> \
AI_RATE_LIMIT_PER_HOUR=8 \
npm run test:integration
```

### Production build

```bash
npm run build
```

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request.

| Job | What it does |
|---|---|
| **checks** | Type-checks the Edge Functions (`deno check`), runs unit tests, builds for production |
| **integration** | Starts local Supabase and the mock LLM in the runner, serves the Edge Functions, runs the end-to-end tests |
| **deploy** | Only on `main`, and only after both jobs pass: runs `supabase db push` and `supabase functions deploy` |

- **Frontend:** deployed by Vercel's Git integration, with a preview URL for every pull request and production on `main`.
- **Dependencies:** Dependabot opens weekly update PRs for npm packages and GitHub Actions.

### Enabling the backend deploy

Create a GitHub environment named `production` with these secrets:

| Secret | Where to find it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens |
| `SUPABASE_PROJECT_REF` | Project Settings → General → Reference ID |
| `SUPABASE_DB_PASSWORD` | The database password you set when creating the project |

Without them, the deploy job is skipped with a notice; checks and tests still run.

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
| Trip details | `/trips/:id` | Yes | Day-by-day plan, edit stops, map and budget |
| My trips | `/my-trips` | Yes | Manage all saved trips |
