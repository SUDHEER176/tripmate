-- NOTE: This is the original schema, kept for reference. The source of truth is now
-- supabase/migrations/ (apply with `supabase db push`). The migrations include
-- everything below plus trip_expenses, rate limiting, constraints and RPCs.

-- ==============================================================================
-- TripMate AI — Supabase Database Schema & Row Level Security (RLS)
-- ==============================================================================

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. TRIPS TABLE
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  destination text not null,
  destination_lat double precision,
  destination_lng double precision,
  start_date date not null,
  end_date date not null,
  budget numeric not null default 0,
  travelers integer not null default 1,
  interests text[] default '{}'::text[],
  pace text not null default 'moderate',
  notes text,
  status text not null default 'planned',
  total_estimated_cost numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. ITINERARY_DAYS TABLE
create table if not exists public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade not null,
  day_number integer not null,
  date date not null,
  title text not null,
  summary text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. ACTIVITIES TABLE
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  itinerary_day_id uuid references public.itinerary_days(id) on delete cascade not null,
  name text not null,
  category text not null default 'activity',
  start_time text,
  location_name text,
  lat double precision,
  lng double precision,
  estimated_cost numeric not null default 0,
  notes text,
  sort_order integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
create index if not exists idx_trips_user_id on public.trips(user_id);
create index if not exists idx_itinerary_days_trip_id on public.itinerary_days(trip_id);
create index if not exists idx_activities_day_id on public.activities(itinerary_day_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.itinerary_days enable row level security;
alter table public.activities enable row level security;

-- Profiles Policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trips Policies
create policy "Users can select own trips"
  on public.trips for select
  using (auth.uid() = user_id);

create policy "Users can insert own trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

create policy "Users can update own trips"
  on public.trips for update
  using (auth.uid() = user_id);

create policy "Users can delete own trips"
  on public.trips for delete
  using (auth.uid() = user_id);

-- Itinerary Days Policies
create policy "Users can select own itinerary days"
  on public.itinerary_days for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_days.trip_id
      and trips.user_id = auth.uid()
    )
  );

create policy "Users can insert own itinerary days"
  on public.itinerary_days for insert
  with check (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_days.trip_id
      and trips.user_id = auth.uid()
    )
  );

create policy "Users can update own itinerary days"
  on public.itinerary_days for update
  using (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_days.trip_id
      and trips.user_id = auth.uid()
    )
  );

create policy "Users can delete own itinerary days"
  on public.itinerary_days for delete
  using (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_days.trip_id
      and trips.user_id = auth.uid()
    )
  );

-- Activities Policies
create policy "Users can select own activities"
  on public.activities for select
  using (
    exists (
      select 1 from public.itinerary_days
      join public.trips on trips.id = itinerary_days.trip_id
      where itinerary_days.id = activities.itinerary_day_id
      and trips.user_id = auth.uid()
    )
  );

create policy "Users can insert own activities"
  on public.activities for insert
  with check (
    exists (
      select 1 from public.itinerary_days
      join public.trips on trips.id = itinerary_days.trip_id
      where itinerary_days.id = activities.itinerary_day_id
      and trips.user_id = auth.uid()
    )
  );

create policy "Users can update own activities"
  on public.activities for update
  using (
    exists (
      select 1 from public.itinerary_days
      join public.trips on trips.id = itinerary_days.trip_id
      where itinerary_days.id = activities.itinerary_day_id
      and trips.user_id = auth.uid()
    )
  );

create policy "Users can delete own activities"
  on public.activities for delete
  using (
    exists (
      select 1 from public.itinerary_days
      join public.trips on trips.id = itinerary_days.trip_id
      where itinerary_days.id = activities.itinerary_day_id
      and trips.user_id = auth.uid()
    )
  );

-- ==============================================================================
-- AUTH AUTOMATION: Create profile on auth.users insert
-- ==============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
