-- Dr Xora — Phase 2 security & integrity migration
--
-- Run this AFTER supabase-setup.sql and supabase-phase1-fixes.sql, in:
--   Supabase Dashboard → SQL Editor → New query → Run
--
-- Idempotent: re-running it is safe.
--
-- To make someone an admin, run (as the project owner, in the SQL editor):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- Admin can no longer be obtained from the browser.

-- ---------------------------------------------------------------------------
-- 1) Privilege escalation: anyone could become an admin.
--
-- a) handle_new_user() copied `raw_user_meta_data->>'role'` straight into
--    profiles. That metadata is supplied by the user at signup, so calling
--    supabase.auth.signUp({ options: { data: { role: 'admin' } } }) created an
--    admin account.
-- b) "Users can update own profile" let a signed-in user set role = 'admin'
--    on their own row.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := new.raw_user_meta_data->>'role';
begin
  insert into public.profiles (id, name, email, role, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    case when requested in ('patient', 'doctor') then requested else 'patient' end,
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id and role in ('patient', 'doctor'));

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- auth.uid() is null for the SQL editor / service role, so those can still
-- promote an admin; end users cannot change their role.
create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'profiles.role cannot be changed from the client'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_profile_role_change();

-- Role helpers. SECURITY DEFINER so policies can call them without recursing
-- through profiles' own RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_doctor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Must key off profiles.role: a doctors row alone proves nothing, because
  -- any signed-in user can insert one for themselves.
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'doctor');
$$;

-- Only accounts whose profile role is 'doctor' may create a doctors row.
drop policy if exists "Users can insert own doctor row" on public.doctors;
create policy "Users can insert own doctor row"
  on public.doctors for insert
  with check (auth.uid() = user_id and public.is_doctor());

-- ---------------------------------------------------------------------------
-- 2) Patient records (PHI) were readable by every signed-in user.
--
-- "Authenticated users can read patients" used `using (true)`, so any patient
-- could list every other patient's name, date of birth, address and medical
-- history. Now: your own row, any doctor (doctors pick patients when booking
-- and reporting), or an admin.
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can read patients" on public.patients;
drop policy if exists "Read own patient row, doctors and admins" on public.patients;
create policy "Read own patient row, doctors and admins"
  on public.patients for select
  to authenticated
  using (user_id = auth.uid() or public.is_doctor() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 3) Admin dashboard counted rows it was not allowed to see.
--
-- Admins had no SELECT policy on reports or appointments, so those tiles were
-- permanently 0.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can read all reports" on public.reports;
create policy "Admins can read all reports"
  on public.reports for select
  using (public.is_admin());

drop policy if exists "Admins can read all appointments" on public.appointments;
create policy "Admins can read all appointments"
  on public.appointments for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4) Storage: any signed-in user could overwrite or delete anyone's scan.
--
-- Restrict update/delete to the uploader. (The bucket itself is still public
-- so report images load by URL; moving it to private + signed URLs is a larger
-- change — see the README.)
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can update xray uploads" on storage.objects;
create policy "Authenticated users can update xray uploads"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'xrays' and owner = auth.uid());

drop policy if exists "Authenticated users can delete xray uploads" on storage.objects;
create policy "Authenticated users can delete xray uploads"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'xrays' and owner = auth.uid());

-- ---------------------------------------------------------------------------
-- 5) Booking: patients couldn't see slots taken by other patients.
--
-- appointments RLS only exposes your own rows, so the booking page's
-- "what's already booked" query could never see anyone else's bookings and
-- offered slots that would then fail on the unique index. This returns ONLY
-- the booked timestamps for a doctor in a window — no patient data.
-- ---------------------------------------------------------------------------
create or replace function public.get_booked_slots(
  p_doctor_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (appointment_date timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.appointment_date
  from public.appointments a
  where a.doctor_id = p_doctor_id
    and a.status is distinct from 'cancelled'
    and a.appointment_date >= p_from
    and a.appointment_date <= p_to
    and p_to - p_from <= interval '2 days'  -- a day's slots, not a whole schedule
    and auth.uid() is not null;
$$;

revoke all on function public.get_booked_slots(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_booked_slots(uuid, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Appointments could be reassigned.
--
-- The update policies check the OLD row only in practice, so a patient could
-- move their booking onto another doctor (or a doctor onto another patient).
-- Only the date, status and reason are legitimately editable from the client.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_appointment_reassignment()
returns trigger
language plpgsql
as $$
begin
  if (new.doctor_id is distinct from old.doctor_id
      or new.patient_id is distinct from old.patient_id)
     and auth.uid() is not null then
    raise exception 'appointment doctor/patient cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_prevent_reassignment on public.appointments;
create trigger appointments_prevent_reassignment
  before update on public.appointments
  for each row execute function public.prevent_appointment_reassignment();
