-- ReClaim Admin Console incremental migration.
-- Assumes profiles, items, and claims already exist.
-- Only admin metadata/policies are added; existing rows are preserved.

alter table public.profiles
  add column if not exists role text not null default 'user';

-- Keep the existing profiles.full_name column for new Auth users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case
          when nullif(excluded.full_name, '') is null then public.profiles.full_name
          else excluded.full_name
        end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(coalesce(role, '')) in ('admin', 'administrator', 'superadmin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.claims enable row level security;

drop policy if exists "admins can read profiles" on public.profiles;
create policy "admins can read profiles"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin() or id = auth.uid());

drop policy if exists "admins can manage items" on public.items;
create policy "admins can manage items"
  on public.items
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can manage claims" on public.claims;
create policy "admins can manage claims"
  on public.claims
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.profiles, public.items, public.claims
  to authenticated;

-- Grant access after replacing the email with an existing Supabase Auth account:
-- update public.profiles
-- set role = 'Admin'
-- where lower(email) = lower('admin@plm.edu.ph');
