-- Wipe the cryo demo rows, then load seed.sql again.
-- In the Supabase SQL editor: run this file, then run seed.sql.

truncate table
  public.route_points,
  public.custody_events,
  public.samples,
  public.facilities
restart identity cascade;
