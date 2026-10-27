# TripMate AI — MVP

[![CI](https://github.com/YOUR_GITHUB_USER/YOUR_REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_GITHUB_USER/YOUR_REPO/actions/workflows/ci.yml)

> An AI-powered travel planner that helps users create personalized itineraries, estimate trip costs, and save their travel blueprints.

---

## 🌟 Features

- **AI Itinerary Generator:** Generates day-by-day travel plans customized by destination, duration, traveler count, pace (relaxed, moderate, packed), and interests (culture, food, nature, adventure, etc.).
- **AI Trip Assistant (tool-calling agent):** Chat on any trip ("swap the museum for a food tour", "make day 2 relaxed") and the assistant edits the itinerary and budget itself. The LLM calls 8 tools (add/update/move/delete stops, reorder days, manage expenses, update trip details) that run through the same validated, ownership-checked code as the REST API. The model only sees short refs (`a3`, `e1`), never database ids, so invented or injected ids cannot reach the database.
- **Route Optimization:** One click finds the fastest order for a day's stops using real travel times from the Google Routes API (`computeRouteMatrix`). Exact Held-Karp dynamic programming for up to 12 stops, 2-opt beyond, with morning → afternoon → evening order kept and start times shifted to match. Shows a preview ("save 35 min, 28% less") before applying. Falls back to a distance estimate without an API key.
- **Budget Planner:** Real-time expense forecasting categorizing accommodation, dining, transportation, and excursions in INR with over-budget alerts.
- **Interactive Google Maps:** Numbered pins for each day's stops with a route line, via `@vis.gl/react-google-maps`. Falls back to OpenStreetMap + Leaflet when no `VITE_GOOGLE_MAPS_API_KEY` is set.
- **Save & Manage Trips:** Full CRUD operations allowing users to create, view, edit activity stops, delete items, and track travel plans.
- **Dual-Mode Persistence:** 
  - **Supabase Cloud Mode:** Fully authenticated with Supabase Auth and PostgreSQL protected with Row Level Security (RLS).
  - **Local Demo Mode:** Instant zero-config demo with browser local storage if Supabase credentials are not yet entered.
- **Responsive & Modern Design:** Styled with Tailwind CSS, custom design tokens, Fraunces serif & Outfit sans typography, and glassmorphic micro-interactions.

---

## 🛠 Tech Stack

| Part | Technology |
|---|---|
| **Frontend** | React 19 + Vite + TypeScript |
| **Styling** | Tailwind CSS v4 + class-variance-authority |
| **Routing** | React Router v7 |
| **Database & Auth** | Supabase (PostgreSQL + Supabase Auth) |
| **AI Itinerary** | LLM API + Supabase Edge Functions / Local Fallback Generator |
| **Maps** | Google Maps JavaScript API (`@vis.gl/react-google-maps`), Leaflet + OpenStreetMap fallback |
| **Deployment** | Vercel + Supabase |

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables (Optional)

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Add your Supabase project credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

*(Note: If you leave these blank, TripMate AI automatically runs in local demo mode so you can test all features immediately without Supabase setup.)*

### 3. Run Locally

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 🗄 Database & Supabase Setup

Schema changes live in `supabase/migrations/` (idempotent, safe on a database where the old `schema.sql` was already run):

| Migration | Contents |
|---|---|
| `20261026000000_baseline_schema.sql` | profiles, trips, itinerary_days, activities + RLS (same as the old `schema.sql`) |
| `20261026000100_trip_backend.sql` | new trip/activity columns & constraints, `trip_expenses`, activity→expense sync trigger, `rate_limit_events` + `consume_rate_limit()`, `save_generated_trip()` and `reorder_activities()` RPCs, tightened RLS |

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Budget data model: every cost lives in `trip_expenses`. Each priced activity owns exactly one linked expense (kept in sync by a trigger), so nothing is counted twice. `cost_basis` says how an amount scales: `total`, `per_person`, `per_night`, `per_person_per_night`, `per_day`, `per_person_per_day`. The calculation in `supabase/functions/_shared/budget.ts` is shared by the Edge Functions and the frontend.

---

## 🤖 Edge Functions

| Function | Endpoints |
|---|---|
| `generate-itinerary` | `POST` — validate input, rate limit, call the LLM, validate the output, save trip/days/activities/expenses in one transaction. Regenerate with `{ trip_id, confirm_regenerate: true }`. |
| `trip-assistant` | `POST` — `{ trip_id, messages }`: runs the tool-calling agent (max 6 model calls / 12 tool calls), returns `{ reply, actions, incomplete, trip }`. Rate limited by `AI_ASSISTANT_RATE_LIMIT_PER_HOUR` (30). |
| `trips` | `GET/POST /trips`, `GET/PATCH/DELETE /trips/:id`, `GET /trips/:id/budget`, `POST /trips/:id/activities`, `POST /trips/:id/activities/reorder`, `PATCH/DELETE /trips/:id/activities/:activityId`, `POST /trips/:id/expenses`, `PATCH/DELETE /trips/:id/expenses/:expenseId`, `POST /trips/:id/optimize-route` (`{ itinerary_day_id, apply? }`) |

Both verify the caller's JWT, run every query under the caller's RLS policies, and return `{ "data": ... }` or `{ "error": { "code", "message", "details"? } }`.

```bash
npx supabase secrets set LLM_API_KEY=your-api-key      # OPENAI_API_KEY also works
# optional: LLM_BASE_URL (any OpenAI-compatible API), LLM_MODEL (default gpt-4o-mini),
#           AI_RATE_LIMIT_PER_HOUR (5), AI_RATE_LIMIT_PER_DAY (20), WRITE_RATE_LIMIT_PER_MINUTE (120),
#           ALLOWED_ORIGINS (comma-separated, default *)
#           GOOGLE_ROUTES_API_KEY (server key with Routes API enabled; without it, travel times are estimated)
npx supabase functions deploy generate-itinerary
npx supabase functions deploy trips
npx supabase functions deploy trip-assistant
```

---

## 🧪 Tests

```bash
npm test                      # unit tests: budget math, validation, AI output checks, LLM errors, routing

# end-to-end against a local stack (Docker required)
npx supabase start
npm run mock-llm              # fake OpenAI-compatible server on :8787
npx supabase functions serve --env-file <file with LLM_API_KEY=mock-llm-key, LLM_BASE_URL=http://host.docker.internal:8787/v1, AI_RATE_LIMIT_PER_HOUR=8>
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=<local anon key> AI_RATE_LIMIT_PER_HOUR=8 npm run test:integration
```

---

## 🔁 CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request:

| Job | What it does |
|---|---|
| **checks** | Type-checks the frontend (`tsc`) and the Edge Functions (`deno check`), runs the unit tests, builds for production |
| **integration** | Starts a local Supabase stack and a mock LLM in the runner, serves the Edge Functions, runs the end-to-end API tests |
| **deploy** | On `main` only, after both pass: `supabase db push` (migrations) and `supabase functions deploy` |

The frontend deploys through Vercel's Git integration: a preview URL for every pull request, production on `main`. Dependabot opens weekly update PRs for npm packages and Actions.

To enable the backend deploy, create a GitHub environment named `production` with these secrets:

| Secret | Where to find it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens |
| `SUPABASE_PROJECT_REF` | Project Settings → General → Reference ID |
| `SUPABASE_DB_PASSWORD` | The database password set when the project was created |

Without them the deploy job is skipped with a notice; checks and tests still run.

```bash
npm run typecheck              # frontend
npm run typecheck:functions    # Edge Functions with Deno 2.1 (same as the Supabase runtime)
```

---

## 🗺 Application Routes

| Page | Route | Access | Purpose |
|---|---|---|---|
| **Landing Page** | `/` | Public | Product overview, features, interactive sample plan |
| **Explore** | `/explore` | Public | Search and discover global destinations |
| **Pricing** | `/pricing` | Public | Free Explorer, Pro Wanderer, Lifetime Nomad tiers |
| **Login** | `/login` | Public | Sign in with email or 1-click demo account |
| **Signup** | `/signup` | Public | Create new traveler account |
| **Trip Planner** | `/plan-trip` | Authenticated | Enter destination, dates, budget & preferences |
| **Trip Details** | `/trips/:id` | Authenticated | View day-by-day plan, edit stops, map & budget |
| **My Trips** | `/my-trips` | Authenticated | Manage all saved travel plans |
