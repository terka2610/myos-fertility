-- Synthetic cryo samples. Run after cryo/schema.sql.
-- SMP-0001 is the shared exit check: oocytes leaving Clinic A, still with the courier.

insert into public.facilities (code, kind, name, city, country, lat, lon) values
  ('CLINIC-A', 'fertility_clinic', 'Harbour IVF Clinic', 'Abu Dhabi', 'UAE', 24.4539, 54.3773),
  ('CRYOPORT', 'courier', 'Cryoport courier', 'Abu Dhabi', 'UAE', 24.7600, 54.7000),
  ('CRYONEXT', 'storage', 'CryoNext storage', 'Dubai', 'UAE', 25.2048, 55.2708)
on conflict (code) do nothing;

insert into public.samples (
  public_id, cryo_id, patient_code, specimen_type, specimen_count, condition,
  status, current_step, current_facility, origin_facility, destination_facility, collected_at
) values
  ('SMP-0001', 'CRYO-1700', 'PT-0142', 'oocyte', 8, 'good',
   'in_transit', 'in_transit', 'CRYOPORT', 'CLINIC-A', 'CRYONEXT', '2026-11-19T06:00:00Z'),
  ('SMP-0002', 'CRYO-1612', 'PT-0090', 'oocyte', 12, 'good',
   'in_storage', 'stored', 'CRYONEXT', 'CLINIC-A', 'CRYONEXT', '2021-06-01T08:00:00Z'),
  ('SMP-0003', 'CRYO-1544', 'PT-0077', 'oocyte', 6, 'good',
   'returning', 'in_transit_return', 'CRYOPORT', 'CRYONEXT', 'CLINIC-A', '2019-03-12T08:00:00Z')
on conflict (public_id) do nothing;

insert into public.custody_events (sample_id, facility_code, step, note, recorded_at) values
  ('SMP-0001', 'CLINIC-A', 'collected', 'Eight oocytes frozen at Clinic A.', '2026-11-19T06:00:00Z'),
  ('SMP-0001', 'CLINIC-A', 'consent_recorded', 'Transfer consent is on file.', '2026-11-19T06:40:00Z'),
  ('SMP-0001', 'CLINIC-A', 'released', 'Handed to the courier.', '2026-11-19T07:10:00Z'),
  ('SMP-0001', 'CRYOPORT', 'in_transit', 'En route to CryoNext storage.', '2026-11-19T08:00:00Z'),
  ('SMP-0002', 'CLINIC-A', 'collected', 'Twelve oocytes frozen at Clinic A.', '2021-06-01T08:00:00Z'),
  ('SMP-0002', 'CRYONEXT', 'arrived_storage', 'Received at CryoNext.', '2021-06-01T15:00:00Z'),
  ('SMP-0002', 'CRYONEXT', 'stored', 'In monitored storage.', '2021-06-01T16:00:00Z'),
  ('SMP-0003', 'CRYONEXT', 'stored', 'Held in storage since 2019.', '2019-03-14T10:00:00Z'),
  ('SMP-0003', 'CRYONEXT', 'release_requested', 'Patient asked to use the eggs.', '2026-11-18T09:00:00Z'),
  ('SMP-0003', 'CRYOPORT', 'in_transit_return', 'Returning to Clinic A.', '2026-11-19T09:30:00Z');

insert into public.route_points (sample_id, lat, lon, recorded_at) values
  ('SMP-0001', 24.4539, 54.3773, '2026-11-19T07:10:00Z'),
  ('SMP-0001', 24.6200, 54.5200, '2026-11-19T07:40:00Z'),
  ('SMP-0001', 24.7600, 54.7000, '2026-11-19T08:10:00Z'),
  ('SMP-0003', 25.2048, 55.2708, '2026-11-19T09:30:00Z'),
  ('SMP-0003', 25.0200, 55.0500, '2026-11-19T10:10:00Z'),
  ('SMP-0003', 24.8200, 54.7800, '2026-11-19T10:40:00Z');
