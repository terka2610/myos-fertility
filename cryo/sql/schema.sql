-- Cryogenic custody tables for the MyOS logistics demo.
-- Run this in the Supabase SQL editor AFTER myos-supabase-schema.sql.
-- Then run seed.sql. To wipe and load again, run reset.sql.

create table if not exists public.facilities (
  code text primary key,
  kind text not null check (kind in ('fertility_clinic', 'courier', 'storage')),
  name text not null,
  city text not null,
  country text not null,
  lat double precision not null,
  lon double precision not null
);

create table if not exists public.samples (
  public_id text primary key,
  cryo_id text not null unique,
  patient_code text not null,
  specimen_type text not null,
  specimen_count integer not null check (specimen_count > 0),
  condition text not null,
  status text not null,
  current_step text not null,
  current_facility text not null references public.facilities(code),
  origin_facility text not null references public.facilities(code),
  destination_facility text not null references public.facilities(code),
  collected_at timestamptz not null
);

create table if not exists public.custody_events (
  id bigint generated always as identity primary key,
  sample_id text not null references public.samples(public_id) on delete cascade,
  facility_code text not null references public.facilities(code),
  step text not null,
  note text not null default '',
  recorded_at timestamptz not null
);

create table if not exists public.route_points (
  id bigint generated always as identity primary key,
  sample_id text not null references public.samples(public_id) on delete cascade,
  lat double precision not null,
  lon double precision not null,
  recorded_at timestamptz not null
);

create index if not exists custody_events_sample_time
  on public.custody_events (sample_id, recorded_at);
create index if not exists route_points_sample_time
  on public.route_points (sample_id, recorded_at);

alter table public.facilities enable row level security;
alter table public.samples enable row level security;
alter table public.custody_events enable row level security;
alter table public.route_points enable row level security;

grant select on public.facilities, public.samples, public.custody_events, public.route_points
  to anon, authenticated;
grant all on public.facilities, public.samples, public.custody_events, public.route_points
  to service_role;

drop policy if exists "demo read facilities" on public.facilities;
create policy "demo read facilities" on public.facilities
  for select to anon, authenticated using (true);
drop policy if exists "demo read samples" on public.samples;
create policy "demo read samples" on public.samples
  for select to anon, authenticated using (true);
drop policy if exists "demo read custody" on public.custody_events;
create policy "demo read custody" on public.custody_events
  for select to anon, authenticated using (true);
drop policy if exists "demo read route" on public.route_points;
create policy "demo read route" on public.route_points
  for select to anon, authenticated using (true);

create or replace function public.sample_snapshot(sample_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'public_id', s.public_id,
    'cryo_id', s.cryo_id,
    'patient_code', s.patient_code,
    'specimen_type', s.specimen_type,
    'count', s.specimen_count,
    'condition', s.condition,
    'status', s.status,
    'current_step', s.current_step,
    'collected_at', s.collected_at,
    'facility', jsonb_build_object(
      'code', f.code, 'kind', f.kind, 'name', f.name,
      'city', f.city, 'country', f.country, 'lat', f.lat, 'lon', f.lon
    ),
    'origin', jsonb_build_object(
      'code', o.code, 'name', o.name, 'lat', o.lat, 'lon', o.lon
    ),
    'destination', jsonb_build_object(
      'code', d.code, 'name', d.name, 'lat', d.lat, 'lon', d.lon
    )
  )
  from public.samples s
  join public.facilities f on f.code = s.current_facility
  join public.facilities o on o.code = s.origin_facility
  join public.facilities d on d.code = s.destination_facility
  where s.public_id = sample_code;
$$;

grant execute on function public.sample_snapshot(text) to anon, authenticated;
