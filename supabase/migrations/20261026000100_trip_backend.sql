-- ==============================================================================
-- TripMate AI — Trip backend: AI generation, expenses, budget, rate limits
-- ==============================================================================
-- Builds on the baseline schema (profiles, trips, itinerary_days, activities).
-- Existing tables are extended in place; only trip_expenses and
-- rate_limit_events are new. New CHECK constraints on existing tables are added
-- NOT VALID so legacy rows never block the migration, while every new or
-- updated row is still enforced.

-- ------------------------------------------------------------------------------
-- Shared helpers
-- ------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- TRIPS
-- ------------------------------------------------------------------------------
alter table public.trips add column if not exists travel_style text not null default 'mid_range';
alter table public.trips add column if not exists currency text not null default 'INR';
alter table public.trips add column if not exists generation_count integer not null default 0;
alter table public.trips add column if not exists generated_at timestamp with time zone;
alter table public.trips add column if not exists ai_model text;
-- General AI travel tips (visa, weather, transit). Shown with an "unverified" label.
alter table public.trips add column if not exists travel_notes text;

update public.trips set total_estimated_cost = 0 where total_estimated_cost is null;
-- Money columns become numeric(12, 2). Guarded so re-running the migration does not
-- fail once triggers that depend on these columns exist.
do $$ begin
  if (select numeric_precision from information_schema.columns
      where table_schema = 'public' and table_name = 'trips' and column_name = 'budget') is distinct from 12 then
    alter table public.trips alter column budget type numeric(12, 2);
  end if;
end $$;
do $$ begin
  if (select numeric_precision from information_schema.columns
      where table_schema = 'public' and table_name = 'trips' and column_name = 'total_estimated_cost') is distinct from 12 then
    alter table public.trips alter column total_estimated_cost type numeric(12, 2);
  end if;
end $$;
alter table public.trips alter column total_estimated_cost set default 0;
alter table public.trips alter column total_estimated_cost set not null;

do $$ begin
  alter table public.trips add constraint trips_dates_chk check (end_date >= start_date) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.trips add constraint trips_travelers_chk check (travelers between 1 and 50) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.trips add constraint trips_budget_chk check (budget >= 0 and budget <= 100000000) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.trips add constraint trips_total_chk check (total_estimated_cost >= 0) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.trips add constraint trips_status_chk
    check (status in ('draft', 'planned', 'completed', 'archived')) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.trips add constraint trips_pace_chk check (pace in ('relaxed', 'moderate', 'packed')) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.trips add constraint trips_travel_style_chk
    check (travel_style in ('budget', 'mid_range', 'luxury')) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.trips add constraint trips_currency_chk check (currency = 'INR') not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.trips add constraint trips_text_len_chk check (
    char_length(btrim(title)) between 1 and 200
    and char_length(btrim(destination)) between 1 and 120
    and (notes is null or char_length(notes) <= 1000)
    and (travel_notes is null or char_length(travel_notes) <= 4000)
  ) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.trips add constraint trips_coords_chk check (
    (destination_lat is null or destination_lat between -90 and 90)
    and (destination_lng is null or destination_lng between -180 and 180)
  ) not valid;
exception when duplicate_object then null; end $$;

create index if not exists idx_trips_user_created on public.trips(user_id, created_at desc);

drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------------------
-- ITINERARY DAYS
-- ------------------------------------------------------------------------------
alter table public.itinerary_days
  add column if not exists updated_at timestamp with time zone not null default now();

do $$ begin
  alter table public.itinerary_days add constraint itinerary_days_day_number_chk check (day_number >= 1) not valid;
exception when duplicate_object then null; end $$;

create unique index if not exists itinerary_days_trip_day_uidx on public.itinerary_days(trip_id, day_number);

drop trigger if exists itinerary_days_set_updated_at on public.itinerary_days;
create trigger itinerary_days_set_updated_at
  before update on public.itinerary_days
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------------------
-- ACTIVITIES
-- ------------------------------------------------------------------------------
alter table public.activities add column if not exists description text;
alter table public.activities add column if not exists time_slot text;
alter table public.activities add column if not exists duration_minutes integer;
-- 'per_person' = each traveler pays this (tickets, meals); 'total' = one price for the group (taxi, guide).
-- Rows that exist before this migration came from the old client-side planner, which
-- stored group totals, so they get 'total'; new rows default to 'per_person'.
alter table public.activities add column if not exists cost_basis text not null default 'total';
alter table public.activities alter column cost_basis set default 'per_person';
-- AI-supplied prices and opening hours are unverified estimates until a user edits them.
alter table public.activities add column if not exists cost_is_estimate boolean not null default true;
alter table public.activities add column if not exists updated_at timestamp with time zone not null default now();

do $$ begin
  if (select numeric_precision from information_schema.columns
      where table_schema = 'public' and table_name = 'activities' and column_name = 'estimated_cost') is distinct from 12 then
    alter table public.activities alter column estimated_cost type numeric(12, 2);
  end if;
end $$;

do $$ begin
  alter table public.activities add constraint activities_category_chk check (
    category in ('sightseeing', 'food', 'transport', 'accommodation', 'activity', 'nightlife', 'shopping')
  ) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.activities add constraint activities_time_slot_chk
    check (time_slot is null or time_slot in ('morning', 'afternoon', 'evening')) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.activities add constraint activities_start_time_chk
    check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.activities add constraint activities_duration_chk
    check (duration_minutes is null or duration_minutes between 0 and 1440) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.activities add constraint activities_cost_chk
    check (estimated_cost >= 0 and estimated_cost <= 100000000) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.activities add constraint activities_cost_basis_chk
    check (cost_basis in ('per_person', 'total')) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.activities add constraint activities_coords_chk check (
    (lat is null or lat between -90 and 90) and (lng is null or lng between -180 and 180)
  ) not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.activities add constraint activities_text_len_chk check (
    char_length(btrim(name)) between 1 and 200
    and (description is null or char_length(description) <= 2000)
    and (location_name is null or char_length(location_name) <= 300)
    and (notes is null or char_length(notes) <= 1000)
  ) not valid;
exception when duplicate_object then null; end $$;

create index if not exists idx_activities_day_sort on public.activities(itinerary_day_id, sort_order);

drop trigger if exists activities_set_updated_at on public.activities;
create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------------------
-- TRIP EXPENSES
-- ------------------------------------------------------------------------------
-- Single source of truth for the budget. An activity with a cost owns exactly one
-- linked expense (source = 'activity', unique activity_id), kept in sync by a
-- trigger, so activity costs are never counted twice.
--
-- Line total = amount × quantity × (travelers if the basis is per-person, else 1)
--   total                 one price for the whole group (quantity = number of units)
--   per_person            each traveler pays amount
--   per_night             group pays amount per night (quantity = nights), e.g. a room
--   per_person_per_night  each traveler pays amount per night (quantity = nights)
--   per_day               group pays amount per day (quantity = days), e.g. car hire
--   per_person_per_day    each traveler pays amount per day (quantity = days)
create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  activity_id uuid unique references public.activities(id) on delete cascade,
  category text not null check (
    category in ('transport', 'accommodation', 'food', 'activities', 'local_travel', 'miscellaneous')
  ),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  amount numeric(12, 2) not null check (amount >= 0 and amount <= 100000000),
  currency text not null default 'INR' check (currency = 'INR'),
  quantity numeric(10, 2) not null default 1 check (quantity > 0 and quantity <= 1000),
  cost_basis text not null default 'total' check (
    cost_basis in ('total', 'per_person', 'per_night', 'per_person_per_night', 'per_day', 'per_person_per_day')
  ),
  notes text check (notes is null or char_length(notes) <= 1000),
  source text not null default 'user' check (source in ('ai', 'user', 'activity')),
  is_estimate boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint trip_expenses_activity_source_chk check ((source = 'activity') = (activity_id is not null))
);

create index if not exists idx_trip_expenses_trip on public.trip_expenses(trip_id, category);
-- Prevents the same standalone expense being recorded twice for a trip.
create unique index if not exists trip_expenses_dedupe_uidx
  on public.trip_expenses(trip_id, category, lower(btrim(title)))
  where activity_id is null;

drop trigger if exists trip_expenses_set_updated_at on public.trip_expenses;
create trigger trip_expenses_set_updated_at
  before update on public.trip_expenses
  for each row execute function public.set_updated_at();

-- A linked expense must point at an activity of the same trip.
create or replace function public.trip_expenses_check_activity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.activity_id is not null and not exists (
    select 1
    from public.activities a
    join public.itinerary_days d on d.id = a.itinerary_day_id
    where a.id = new.activity_id and d.trip_id = new.trip_id
  ) then
    raise exception 'Linked activity does not belong to this trip' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trip_expenses_check_activity on public.trip_expenses;
create trigger trip_expenses_check_activity
  before insert or update on public.trip_expenses
  for each row execute function public.trip_expenses_check_activity();

-- Keeps each activity's linked expense in sync with the activity's cost.
-- Category mapping must match activityExpenseCategory() in supabase/functions/_shared/budget.ts.
create or replace function public.sync_activity_expense()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_trip_id uuid;
begin
  if coalesce(new.estimated_cost, 0) <= 0 then
    delete from public.trip_expenses where activity_id = new.id;
    return new;
  end if;

  select trip_id into v_trip_id from public.itinerary_days where id = new.itinerary_day_id;

  insert into public.trip_expenses
    (trip_id, activity_id, category, title, amount, quantity, cost_basis, source, is_estimate)
  values (
    v_trip_id,
    new.id,
    case new.category
      when 'food' then 'food'
      when 'transport' then 'local_travel'
      when 'accommodation' then 'accommodation'
      when 'shopping' then 'miscellaneous'
      else 'activities'
    end,
    new.name,
    new.estimated_cost,
    1,
    new.cost_basis,
    'activity',
    new.cost_is_estimate
  )
  on conflict (activity_id) do update set
    trip_id = excluded.trip_id,
    category = excluded.category,
    title = excluded.title,
    amount = excluded.amount,
    cost_basis = excluded.cost_basis,
    is_estimate = excluded.is_estimate;
  return new;
end;
$$;

drop trigger if exists activities_sync_expense on public.activities;
create trigger activities_sync_expense
  after insert or update of estimated_cost, category, name, cost_basis, cost_is_estimate, itinerary_day_id
  on public.activities
  for each row execute function public.sync_activity_expense();

-- Backfill linked expenses for activities that already carry a cost.
insert into public.trip_expenses (trip_id, activity_id, category, title, amount, quantity, cost_basis, source, is_estimate)
select
  d.trip_id,
  a.id,
  case a.category
    when 'food' then 'food'
    when 'transport' then 'local_travel'
    when 'accommodation' then 'accommodation'
    when 'shopping' then 'miscellaneous'
    else 'activities'
  end,
  left(a.name, 200),
  a.estimated_cost,
  1,
  a.cost_basis,
  'activity',
  a.cost_is_estimate
from public.activities a
join public.itinerary_days d on d.id = a.itinerary_day_id
where a.estimated_cost > 0
on conflict (activity_id) do nothing;

-- Refresh the cached trip totals from expenses (the API recalculates on every change).
update public.trips t
set total_estimated_cost = totals.total
from (
  select tr.id, coalesce(sum(e.amount * e.quantity * case when e.cost_basis like 'per_person%' then tr.travelers else 1 end), 0) as total
  from public.trips tr
  left join public.trip_expenses e on e.trip_id = tr.id
  group by tr.id
) totals
where totals.id = t.id and t.total_estimated_cost is distinct from round(totals.total, 2);

alter table public.trip_expenses enable row level security;

drop policy if exists "Users can select own trip expenses" on public.trip_expenses;
create policy "Users can select own trip expenses"
  on public.trip_expenses for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_expenses.trip_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own trip expenses" on public.trip_expenses;
create policy "Users can insert own trip expenses"
  on public.trip_expenses for insert
  with check (
    exists (
      select 1 from public.trips
      where trips.id = trip_expenses.trip_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own trip expenses" on public.trip_expenses;
create policy "Users can update own trip expenses"
  on public.trip_expenses for update
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_expenses.trip_id
      and trips.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips
      where trips.id = trip_expenses.trip_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own trip expenses" on public.trip_expenses;
create policy "Users can delete own trip expenses"
  on public.trip_expenses for delete
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_expenses.trip_id
      and trips.user_id = auth.uid()
    )
  );

-- Baseline UPDATE policies had no WITH CHECK, which would let an owner move a row
-- into another user's trip. Tighten them.
drop policy if exists "Users can update own trips" on public.trips;
create policy "Users can update own trips"
  on public.trips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own itinerary days" on public.itinerary_days;
create policy "Users can update own itinerary days"
  on public.itinerary_days for update
  using (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_days.trip_id
      and trips.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips
      where trips.id = itinerary_days.trip_id
      and trips.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own activities" on public.activities;
create policy "Users can update own activities"
  on public.activities for update
  using (
    exists (
      select 1 from public.itinerary_days
      join public.trips on trips.id = itinerary_days.trip_id
      where itinerary_days.id = activities.itinerary_day_id
      and trips.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.itinerary_days
      join public.trips on trips.id = itinerary_days.trip_id
      where itinerary_days.id = activities.itinerary_day_id
      and trips.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------------------
-- RATE LIMITING
-- ------------------------------------------------------------------------------
-- Sliding-window counters. No RLS policies: the table is reachable only through
-- consume_rate_limit(), which always acts on the caller's own auth.uid().
create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_rate_limit_events_lookup
  on public.rate_limit_events(user_id, bucket, created_at desc);

alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from anon, authenticated;

create or replace function public.consume_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_oldest timestamp with time zone;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if p_bucket !~ '^[a-z_:]{1,40}$' or p_max not between 1 and 10000 or p_window_seconds not between 1 and 604800 then
    raise exception 'Invalid rate limit parameters' using errcode = '22023';
  end if;

  -- Serialise concurrent requests for the same user + bucket.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_bucket, 0));

  select count(*), min(e.created_at) into v_count, v_oldest
  from public.rate_limit_events e
  where e.user_id = v_uid
    and e.bucket = p_bucket
    and e.created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return query select
      false,
      0,
      greatest(1, ceil(extract(epoch from (v_oldest + make_interval(secs => p_window_seconds) - now())))::integer);
    return;
  end if;

  insert into public.rate_limit_events (user_id, bucket) values (v_uid, p_bucket);
  delete from public.rate_limit_events
  where user_id = v_uid and bucket = p_bucket and created_at < now() - interval '7 days';

  return query select true, p_max - v_count - 1, 0;
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

-- ------------------------------------------------------------------------------
-- TRANSACTIONAL WRITES
-- ------------------------------------------------------------------------------
-- Saves a validated AI itinerary in one transaction: either the whole trip
-- (days, activities, linked + standalone expenses) is stored, or nothing is.
-- With p_trip_id it regenerates an existing trip: AI days/activities/expenses are
-- replaced, user-added standalone expenses are kept.
-- SECURITY INVOKER: every statement runs under the caller's RLS policies.
create or replace function public.save_generated_trip(
  p_trip jsonb,
  p_days jsonb,
  p_activities jsonb,
  p_expenses jsonb,
  p_trip_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip_id uuid;
  v_t public.trips;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0
     or jsonb_typeof(p_activities) <> 'array' or jsonb_typeof(p_expenses) <> 'array' then
    raise exception 'Itinerary payload is incomplete' using errcode = '22023';
  end if;

  v_t := jsonb_populate_record(null::public.trips, p_trip);

  if p_trip_id is null then
    insert into public.trips (
      user_id, title, destination, destination_lat, destination_lng, start_date, end_date,
      budget, currency, travelers, interests, pace, travel_style, notes, travel_notes, status,
      ai_model, generated_at, generation_count
    ) values (
      v_uid, v_t.title, v_t.destination, v_t.destination_lat, v_t.destination_lng, v_t.start_date, v_t.end_date,
      v_t.budget, 'INR', v_t.travelers, coalesce(v_t.interests, '{}'), v_t.pace, v_t.travel_style, v_t.notes, v_t.travel_notes, 'planned',
      v_t.ai_model, now(), 1
    )
    returning id into v_trip_id;
  else
    perform 1 from public.trips where id = p_trip_id and user_id = v_uid for update;
    if not found then
      raise exception 'Trip not found' using errcode = 'P0002';
    end if;

    delete from public.itinerary_days where trip_id = p_trip_id;  -- cascades to activities and linked expenses
    delete from public.trip_expenses where trip_id = p_trip_id and source = 'ai';

    update public.trips set
      title = v_t.title,
      destination = v_t.destination,
      destination_lat = v_t.destination_lat,
      destination_lng = v_t.destination_lng,
      start_date = v_t.start_date,
      end_date = v_t.end_date,
      budget = v_t.budget,
      travelers = v_t.travelers,
      interests = coalesce(v_t.interests, '{}'),
      pace = v_t.pace,
      travel_style = v_t.travel_style,
      notes = v_t.notes,
      travel_notes = v_t.travel_notes,
      status = 'planned',
      ai_model = v_t.ai_model,
      generated_at = now(),
      generation_count = generation_count + 1
    where id = p_trip_id;
    v_trip_id := p_trip_id;
  end if;

  insert into public.itinerary_days (id, trip_id, day_number, date, title, summary)
  select d.id, v_trip_id, d.day_number, d.date, d.title, d.summary
  from jsonb_populate_recordset(null::public.itinerary_days, p_days) d;

  insert into public.activities (
    id, itinerary_day_id, name, description, category, time_slot, start_time, duration_minutes,
    location_name, lat, lng, estimated_cost, cost_basis, cost_is_estimate, notes, sort_order
  )
  select
    a.id, a.itinerary_day_id, a.name, a.description, a.category, a.time_slot, a.start_time, a.duration_minutes,
    a.location_name, a.lat, a.lng, a.estimated_cost, coalesce(a.cost_basis, 'per_person'), true, a.notes, a.sort_order
  from jsonb_populate_recordset(null::public.activities, p_activities) a
  where a.itinerary_day_id in (select id from public.itinerary_days where trip_id = v_trip_id);

  get diagnostics v_count = row_count;
  if v_count <> jsonb_array_length(p_activities) then
    raise exception 'Activity references a day outside this trip' using errcode = '22023';
  end if;

  insert into public.trip_expenses (trip_id, category, title, amount, quantity, cost_basis, notes, source, is_estimate)
  select v_trip_id, e.category, e.title, e.amount, coalesce(e.quantity, 1), coalesce(e.cost_basis, 'total'), e.notes, 'ai', true
  from jsonb_populate_recordset(null::public.trip_expenses, p_expenses) e
  on conflict do nothing;  -- a user expense with the same title already covers it

  return v_trip_id;
end;
$$;

revoke execute on function public.save_generated_trip(jsonb, jsonb, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.save_generated_trip(jsonb, jsonb, jsonb, jsonb, uuid) to authenticated;

-- Atomically rewrites sort_order for one day. p_activity_ids must list exactly
-- the day's activities, in the new order.
create or replace function public.reorder_activities(p_day_id uuid, p_activity_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing uuid[];
  v_requested uuid[];
begin
  select coalesce(array_agg(id order by id), '{}') into v_existing
  from public.activities where itinerary_day_id = p_day_id;

  select coalesce(array_agg(x order by x), '{}') into v_requested
  from unnest(p_activity_ids) as x;

  if v_existing = '{}' or v_requested is distinct from v_existing then
    raise exception 'Order must list every activity of the day exactly once' using errcode = '22023';
  end if;

  update public.activities a
  set sort_order = o.ord - 1
  from unnest(p_activity_ids) with ordinality as o(id, ord)
  where a.id = o.id and a.itinerary_day_id = p_day_id;
end;
$$;

revoke execute on function public.reorder_activities(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_activities(uuid, uuid[]) to authenticated;
