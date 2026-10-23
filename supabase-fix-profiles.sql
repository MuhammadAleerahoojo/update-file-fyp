-- Run this once in Supabase SQL Editor (fixes missing profiles + future signups)

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

-- Create profiles for users that already signed up (like yours)
insert into public.profiles (id, name, email, role, created_at)
select
  id,
  coalesce(raw_user_meta_data->>'name', ''),
  email,
  coalesce(raw_user_meta_data->>'role', 'patient'),
  now()
from auth.users
on conflict (id) do nothing;
