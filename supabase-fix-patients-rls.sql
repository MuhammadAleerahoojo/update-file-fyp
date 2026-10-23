-- Fix: infinite recursion in patients RLS
-- Run once in Supabase SQL Editor

-- This policy queried appointments, and appointments policies query patients → loop
drop policy if exists "Doctors can read patients they have appointments with" on public.patients;

-- Doctors (and other signed-in users) can read patient rows for booking/lists.
-- Insert/update/delete stay limited to the owning user.
drop policy if exists "Authenticated users can read patients" on public.patients;
create policy "Authenticated users can read patients"
  on public.patients for select
  to authenticated
  using (true);
