-- X_Ray_Lytics_updated — one-time Supabase setup
-- Run this entire script in: Supabase Dashboard → SQL Editor → New query → Run

-- 1) Tables
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role text not null check (role in ('patient', 'doctor', 'admin')),
  created_at timestamptz default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  date_of_birth date,
  gender text,
  contact_number text,
  address text,
  medical_history text,
  age int
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  specialization text,
  license_number text,
  experience_years int,
  contact_number text,
  avatar_url text
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_date timestamptz not null,
  status text not null default 'scheduled',
  reason text
);

create table public.doctor_available_slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  available_weekdays text[] not null,
  start_time time not null,
  end_time time not null
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete set null,
  doctor_id uuid references public.doctors(id) on delete set null,
  xray_image_url text,
  ai_analysis_result jsonb,
  created_at timestamptz default now(),
  status text
);

-- Helpful indexes
create index appointments_doctor_id_idx on public.appointments(doctor_id);
create index appointments_patient_id_idx on public.appointments(patient_id);
create index reports_patient_id_idx on public.reports(patient_id);
create index reports_doctor_id_idx on public.reports(doctor_id);
create index doctor_available_slots_doctor_id_idx on public.doctor_available_slots(doctor_id);

-- 2) RLS
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.doctors enable row level security;
alter table public.appointments enable row level security;
alter table public.doctor_available_slots enable row level security;
alter table public.reports enable row level security;

-- profiles
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- patients
-- Note: do NOT select from appointments here — appointments policies
-- also read patients, which causes infinite RLS recursion.
create policy "Authenticated users can read patients"
  on public.patients for select
  to authenticated
  using (true);

create policy "Users can insert own patient row"
  on public.patients for insert
  with check (auth.uid() = user_id);

create policy "Users can update own patient row"
  on public.patients for update
  using (auth.uid() = user_id);

create policy "Users can upsert own patient row"
  on public.patients for delete
  using (auth.uid() = user_id);

-- doctors (patients need to list doctors when booking)
create policy "Authenticated users can read doctors"
  on public.doctors for select
  to authenticated
  using (true);

create policy "Users can insert own doctor row"
  on public.doctors for insert
  with check (auth.uid() = user_id);

create policy "Users can update own doctor row"
  on public.doctors for update
  using (auth.uid() = user_id);

-- doctor_available_slots
create policy "Authenticated users can read slots"
  on public.doctor_available_slots for select
  to authenticated
  using (true);

create policy "Doctors can insert own slots"
  on public.doctor_available_slots for insert
  with check (
    exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.user_id = auth.uid()
    )
  );

create policy "Doctors can update own slots"
  on public.doctor_available_slots for update
  using (
    exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.user_id = auth.uid()
    )
  );

create policy "Doctors can delete own slots"
  on public.doctor_available_slots for delete
  using (
    exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.user_id = auth.uid()
    )
  );

-- appointments
create policy "Patients can read own appointments"
  on public.appointments for select
  using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  );

create policy "Doctors can read own appointments"
  on public.appointments for select
  using (
    exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.user_id = auth.uid()
    )
  );

create policy "Patients can create appointments"
  on public.appointments for insert
  with check (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  );

create policy "Patients can update own appointments"
  on public.appointments for update
  using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  );

create policy "Doctors can update own appointments"
  on public.appointments for update
  using (
    exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.user_id = auth.uid()
    )
  );

create policy "Patients can delete own appointments"
  on public.appointments for delete
  using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  );

create policy "Doctors can delete own appointments"
  on public.appointments for delete
  using (
    exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.user_id = auth.uid()
    )
  );

-- reports
create policy "Patients can read own reports"
  on public.reports for select
  using (
    exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  );

create policy "Doctors can read own reports"
  on public.reports for select
  using (
    exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.user_id = auth.uid()
    )
  );

create policy "Patients can insert own reports"
  on public.reports for insert
  with check (
    patient_id is not null and exists (
      select 1 from public.patients p
      where p.id = patient_id and p.user_id = auth.uid()
    )
  );

create policy "Doctors can insert own reports"
  on public.reports for insert
  with check (
    doctor_id is not null and exists (
      select 1 from public.doctors d
      where d.id = doctor_id and d.user_id = auth.uid()
    )
  );

-- 3) Storage bucket for X-ray images
insert into storage.buckets (id, name, public)
values ('xrays', 'xrays', true)
on conflict (id) do update set public = true;

create policy "Authenticated users can upload xrays"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'xrays');

create policy "Public can read xrays"
  on storage.objects for select
  using (bucket_id = 'xrays');

create policy "Authenticated users can update xray uploads"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'xrays');

create policy "Authenticated users can delete xray uploads"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'xrays');

-- 4) Auto-create profile on signup (email confirm has no session yet,
--    so client-side profile insert is often blocked by RLS)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'patient'),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any users created before the trigger existed
insert into public.profiles (id, name, email, role, created_at)
select
  id,
  coalesce(raw_user_meta_data->>'name', ''),
  email,
  coalesce(raw_user_meta_data->>'role', 'patient'),
  now()
from auth.users
on conflict (id) do nothing;
