-- Allow authenticated users to create/update only their own profile.
drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
