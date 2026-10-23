-- Dr Xora — Phase 1 stabilisation migration
--
-- Run this AFTER supabase-setup.sql, in:
--   Supabase Dashboard → SQL Editor → New query → Run
--
-- It is idempotent: re-running it is safe.

-- ---------------------------------------------------------------------------
-- 1) Doctors could not create appointments at all.
--
-- supabase-setup.sql defines "Patients can create appointments" but no
-- equivalent for doctors, so the doctor-side booking form was blocked by RLS
-- even once it was wired up to the database.
-- ---------------------------------------------------------------------------
drop policy if exists "Doctors can create appointments" on public.appointments;
create policy "Doctors can create appointments"
  on public.appointments for insert
  with check (
    exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2) The "Users can upsert own patient row" policy was declared FOR DELETE.
--
-- That was almost certainly a copy/paste slip: it grants patients the ability
-- to delete their own record while contributing nothing to the upsert path it
-- is named after. Replaced with the delete policy it should have been.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can upsert own patient row" on public.patients;
drop policy if exists "Users can delete own patient row" on public.patients;
create policy "Users can delete own patient row"
  on public.patients for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3) Reports were insert-only.
--
-- Nothing could ever update a report (e.g. a doctor marking AI findings as
-- reviewed), because no UPDATE policy existed.
-- ---------------------------------------------------------------------------
drop policy if exists "Doctors can update own reports" on public.reports;
create policy "Doctors can update own reports"
  on public.reports for update
  using (
    exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Patients can update own reports" on public.reports;
create policy "Patients can update own reports"
  on public.reports for update
  using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Give `reports.status` a usable default.
--
-- The patient dashboard counts reports with status = 'pending', but nothing
-- ever set the column, so the tile was permanently stuck at 0.
-- ---------------------------------------------------------------------------
alter table public.reports
  alter column status set default 'completed';

update public.reports set status = 'completed' where status is null;

-- ---------------------------------------------------------------------------
-- 5) Stop double-booking at the database level.
--
-- Slot availability was only ever filtered in the browser, so two patients
-- loading the booking page at the same time could both take the same slot.
-- ---------------------------------------------------------------------------
create unique index if not exists appointments_doctor_slot_unique
  on public.appointments (doctor_id, appointment_date)
  where status <> 'cancelled';

-- Sorting/filtering by date is done on every appointments screen.
create index if not exists appointments_date_idx
  on public.appointments (appointment_date);
